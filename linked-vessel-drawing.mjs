// Apply linked vessel state to the drawing, not the operation or condition cards.
import {sceneState} from './linked-vessel-state.mjs?v=0.52.0';

const HOT_SCENES=new Set(['inject','solution','reflux','degas']);
const GAS_TEXT=/\bnitrogen\b|\bargon\b|\bhelium\b|\bhydrogen\b|\boxygen\b|\bn2\b|\bar\b|\bo2\b|vacuum|inert gas/i;
const normalized=x=>String(x||'').toLowerCase().replace(/\s+/g,' ').trim();

export function overlayVesselState(spec,record,operation,describe,formatQuantity) {
  const index=(record.operations||[]).findIndex(s=>s.id===operation.id);
  if(!spec||index<0||!HOT_SCENES.has(spec.kind))return spec;
  const {carry,inletLabel}=sceneState(record,index);
  const changes=Object.create(null),notes=[];
  for(const [key,item] of Object.entries(carry)){
    const prior=describe(record.operations[item.sourceStep-1]);
    if(!prior||!HOT_SCENES.has(prior.kind))continue;
    if(spec.vessel?.value&&prior.vessel?.value&&normalized(spec.vessel.value)!==normalized(prior.vessel.value))continue;
    if(prior.vessel?.value&&!spec.vessel?.value){changes.vessel=prior.vessel;changes.vesselKind=prior.vesselKind;}
    if(key==='temperature'&&prior.heating){
      changes.heating=true;
      const text=formatQuantity(item.quantity);
      if(text&&!/not reported/i.test(text))notes.push({label:'Vessel temperature',value:text+' · '+item.label});
    }
    if(key==='atmosphere'&&prior.gasLine){
      const text=String(item.quantity.value||'');
      if(GAS_TEXT.test(text)){
        changes.gasLine=true;changes.environment=text;
        notes.push({label:'Vessel atmosphere',value:text+' · '+item.label});
      }
    }
  }
  let syringeInput=null;
  if(spec.kind==='inject'){
    syringeInput=spec.added?.length?spec.added.join(' + '):inletLabel;
    if(syringeInput&&!spec.added?.length){
      changes.added=[syringeInput];changes.addedLabels=[syringeInput];changes.addedFormulas=[null];
    }
  }
  return {...spec,...changes,carriedDrawingNotes:notes,syringeInput,
          syringeInputUnstated:spec.kind==='inject'&&!syringeInput};
}
