// Draft pure state for the compact method chooser. No record or site writes.
const normalize = x => String(x??'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en');
const join = xs => xs.filter(x=>typeof x==='string'&&x).join(' ');

export function methodPicker(groups,records,familyLimit=3,paperLimit=2) {
  if (!Number.isSafeInteger(familyLimit)||familyLimit<1||!Number.isSafeInteger(paperLimit)||paperLimit<1) throw TypeError('Bad preview limits');
  if (!Array.isArray(groups?.families)||!Array.isArray(records))throw TypeError('Missing method families');
  const known=new Map(records.map(x=>[x.record_id,x]));
  if(known.size!==records.length)throw Error('Repeated record metadata');
  const membership=new Map();
  const families=groups.families.map((family,fi)=>{
    if(!family.id||!family.label||!Array.isArray(family.papers)||family.paper_count!==family.papers.length)throw Error('Bad family metadata');
    const records=[];
    const items=family.papers.map((paper,pi)=>{
      if(!paper.citation||!paper.record_ids?.length)throw Error('Bad paper metadata');
      const matches=paper.record_ids.map(id=>{
        if(!known.has(id)||membership.has(id))throw Error('Repeated or unknown record membership');
        membership.set(id,{fi,pi,order:records.length});records.push(id);return known.get(id);
      });
      return {paper,preview:fi<familyLimit&&pi<paperLimit,search:normalize(join([
        family.label,family.metal_source,family.nonmetal_source,paper.citation,
        ...matches.flatMap(r=>[String(r.year??''),...(Array.isArray(r.method_source_names)?r.method_source_names:[])])
      ]))};
    });
    return {family,records,items};
  });
  if(membership.size!==known.size)throw Error('Incomplete method-family membership');
  function position(id){const p=membership.get(id);if(!p)throw Error('Unknown method record');return p;}
  return {
    preview(id){
      const {fi,pi}=position(id);
      return families.flatMap(({family,items},i)=>{
        const cards=items.flatMap((x,j)=>x.preview||(i===fi&&j===pi)?[x.paper]:[]);
        return cards.length?[{family,cards}]:[];
      });
    },
    filter(text){
      const words=normalize(text).trim().split(/\s+/).filter(Boolean);
      return families.flatMap(({family,items})=>{
        const cards=items.filter(x=>words.every(w=>x.search.includes(w))).map(x=>x.paper);
        return cards.length?[{family,cards}]:[];
      });
    },
    selected(id){
      const {fi,pi,order}=position(id),{family,records,items}=families[fi];
      return {citation:items[pi].paper.citation,family:family.label,previous:records[order-1]??null,next:records[order+1]??null};
    },
  };
}
