// O integration: project prebuilt families without changing recipe metadata.
import {mountCompactMethodPicker} from './compact-method-dom.mjs?v=0.49.0';

export function completeChooserGroups(groups,records,baseTitle){
  if(groups)return groups;
  if(!records.length)throw Error('No synthesis method is available');
  // Old standalone records may not have material-level grouping. Keep their
  // source order and neutral labels, and still use the compact interaction.
  const papers=new Map();
  for(const r of records){
    const key=r.doi||r.record_id;
    if(!papers.has(key))papers.set(key,{citation:r.source_citation||r.title||baseTitle,record_ids:[]});
    papers.get(key).record_ids.push(r.record_id);
  }
  return {schema:'mattersyn-method-families-compact/1',default_record_id:records[0].record_id,
    families:[{id:'other-methods',label:'Other methods',paper_count:papers.size,papers:[...papers.values()]}]};
}

export function mountReaderMethodChooser(selector,options){
  const {groups,records,baseTitle,onSelect,pendingVariants,decoratePending}=options;
  const metadata=new Map(records.map(x=>[x.record_id,x]));
  return mountCompactMethodPicker(selector,{groups:completeChooserGroups(groups,records,baseTitle),records,onSelect,
    decorateCard(card,ids){if(ids.some(id=>pendingVariants(metadata.get(id)?.pending_variants).length))decoratePending(card);},
  });
}

export function revealSelectedRecipe(root,recordId){
  if(root.dataset.readerReady!==recordId)return false;
  const section=root.querySelector('#precursors');
  if(!section||section.hidden)return false;
  const title=section.querySelector('h2')||section;
  title.setAttribute('tabindex','-1');title.focus({preventScroll:true});
  section.scrollIntoView({block:'start',behavior:'instant'});
  return true;
}
