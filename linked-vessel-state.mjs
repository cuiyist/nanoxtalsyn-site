// R1 draft. Scene annotations only; callers keep the step's own condition cards.
const TEMP_RESET=/\b(?:cool|cooling|quench|heat|heating|ramp|anneal|warm|dry|evaporat)/i;
const GAS_RESET=/\b(?:purge|vent|degass|evacuat|backfill|air exposure|pressure release)/i;
const transfer=/\b(?:inject|add|feed|transfer|addition)\b/i;
const mixtureKinds=new Set(['reaction_batch','mixture','solution','dispersion','suspension','stock_solution']);

export function sceneState(record,index){
  const ops=record.operations||[],cur=ops[index];if(!cur)throw Error('Unknown synthesis operation');
  const states=new Map((record.material_states||[]).map(s=>[s.id,s]));
  const mats=new Map((record.materials||[]).map(m=>[m.id,m]));
  const stocks=new Map((record.stocks||[]).map(s=>[s.id,s]));
  const preceding=new Map(ops.slice(0,index).map((o,i)=>[o.id,{o,i}]));
  const producer=new Map();for(const x of preceding.values())for(const id of x.o.outputs||[]){if(producer.has(id))producer.set(id,null);else producer.set(id,x);}
  const reported=x=>x&&x.status==='reported'&&(x.value!==null&&x.value!==undefined||x.minimum!==null&&x.minimum!==undefined||x.maximum!==null&&x.maximum!==undefined);
  const action=o=>String(o.action||'').replace(/[_-]/g,' ');
  const knownStart=op=>typeof op.stage==='string'&&op.stage!=='synthesis';
  function depends(o){
    const found=new Set(),queue=[...(o.depends_on||[])];
    while(queue.length){const id=queue.pop();if(found.has(id)||!preceding.has(id))continue;found.add(id);queue.push(...(preceding.get(id).o.depends_on||[]));}
    return found;
  }
  function namedStock(id){
    const direct=stocks.get(id);if(direct?.name)return direct.name;
    const state=states.get(id),op=producer.get(id)?.o;
    if(!state||!op||!(/\bstock\b/i.test(action(op))||state.kind==='stock_solution'))return null;
    const parents=new Set(state.parent_ids||[]);
    const matches=[...stocks.values()].filter(stock=>{
      const keys=new Set((stock.components||[]).map(x=>x.material_id).filter(Boolean));
      return keys.size>0&&keys.size===parents.size&&[...keys].every(k=>parents.has(k));
    });
    return matches.length===1?matches[0].name:null;
  }
  function exactMixture(o,earlier){
    const dep=depends(o),out=[];
    for(const id of o.inputs||[]){
      if(!mixtureKinds.has(states.get(id)?.kind)||namedStock(id))continue;
      const previous=producer.get(id);
      if(previous&&previous.i<earlier&&dep.has(previous.o.id))out.push(previous);
    }
    return out.length===1?out[0]:null;
  }
  const carry={};
  for(const [key,input,disruption] of [
    ['temperature',o=>o.parameters?.temperature,TEMP_RESET],
    ['atmosphere',o=>o.environment,GAS_RESET],
  ]){
    if(reported(input(cur))||disruption.test(action(cur))||knownStart(cur))continue;
    let next=exactMixture(cur,index);
    while(next){
      const {o,i}=next;
      if(knownStart(o))break;
      if(reported(input(o))){carry[key]={sourceStep:i+1,label:`from step ${i+1}`,quantity:input(o)};break;}
      if(disruption.test(action(o)))break;
      next=exactMixture(o,i);
    }
  }
  const additions=[];
  if(transfer.test(action(cur))){
    for(const id of cur.inputs||[]){
      const name=mats.get(id)?.name||namedStock(id);
      if(name&&!additions.includes(name))additions.push(name);
    }
  }
  return {carry,inletLabel:additions.join(' + ')||null,ownTemperatureReported:!!reported(cur.parameters?.temperature),ownAtmosphereReported:!!reported(cur.environment)};
}
