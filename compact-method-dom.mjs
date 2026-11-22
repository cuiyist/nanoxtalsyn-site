// O draft renderer, to integrate only after the preceding F6/Y3 releases.
import {methodPicker} from './compact-method-state.mjs?v=0.49.0';

export function mountCompactMethodPicker(host,{groups,records,onSelect,decorateCard,document:doc=globalThis.document}){
  const state=methodPicker(groups,records),byId=new Map(records.map(x=>[x.record_id,x]));
  let active=groups.default_record_id,focusBefore=null;
  const create=(tag,cls,text)=>{
    const x=doc.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;
  };
  const btn=(text,handler,cls='reader-chip')=>{
    const b=create('button',cls,text);b.type='button';b.addEventListener('click',handler);return b;
  };
  const root=create('div','reader-method-families reader-method-compact');
  root.dataset.initialFamilyLimit='3';root.dataset.initialPapersPerFamily='2';
  const preview=create('div','reader-method-preview');
  const sheet=create('dialog','reader-method-dialog');sheet.id='reader-method-dialog';
  sheet.setAttribute('aria-labelledby','reader-method-dialog-heading');
  const panel=create('div','reader-method-panel'),title=create('h2',null,'Choose a synthesis method');
  title.id='reader-method-dialog-heading';
  const filter=create('input','reader-method-search');filter.type='search';filter.id='reader-method-search';
  filter.placeholder='Author, year, method family, or chemical source';
  const label=create('label','reader-method-filter-label','Filter methods');label.htmlFor=filter.id;
  const panelTop=create('div','reader-method-panel-top');
  const selectedInfo=create('p','reader-method-selected-detail');
  const result=create('p','reader-method-result');result.setAttribute('role','status');
  const list=create('div','reader-method-panel-list');list.tabIndex=0;
  list.setAttribute('aria-label','Available method families');
  const close=btn('Close methods',()=>sheet.close(),'reader-chip reader-method-panel-close');
  panelTop.append(title,close,selectedInfo,label,filter,result);panel.append(panelTop,list);sheet.append(panel);
  sheet.addEventListener('close',()=>{
    list.replaceChildren();all.setAttribute('aria-expanded','false');change.setAttribute('aria-expanded','false');
    if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});
  });
  sheet.addEventListener('click',event=>{if(event.target===sheet)sheet.close();});

  function open(event){
    if(sheet.open)return;
    focusBefore=event?.currentTarget||doc.activeElement;
    filter.value='';sheet.showModal();renderVisiblePanel();
    all.setAttribute('aria-expanded','true');change.setAttribute('aria-expanded','true');
    filter.focus({preventScroll:true});
  }
  const all=btn('Show all',open,'reader-family-toggle');
  const bar=create('div','reader-selected-recipe');bar.id='reader-selected-recipe';
  bar.setAttribute('role','region');bar.setAttribute('aria-label','Selected synthesis recipe');
  const caption=create('span','reader-selected-citation');caption.setAttribute('aria-live','polite');
  const previous=btn('Previous',()=>selectNeighbor('previous'),'reader-chip reader-method-previous');
  const next=btn('Next',()=>selectNeighbor('next'),'reader-chip reader-method-next');
  const change=btn('Change method',open,'reader-chip reader-method-change');
  for(const b of [change,all]){b.setAttribute('aria-controls',sheet.id);b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-expanded','false');}
  bar.append(caption,previous,next,change);

  function turn(id,fromPanel){
    if(fromPanel){
      focusBefore=null;sheet.close();
    }
    return onSelect(id,{scrollToRecipe:fromPanel});
  }
  function selectNeighbor(dir){const id=state.selected(active)[dir];if(id)return onSelect(id,{scrollToRecipe:true});}
  function card(paper,panelMode){
    const current=paper.record_ids.includes(active)?active:paper.record_ids[0];
    const node=create('article','reader-method-card reader-paper-card');node.dataset.paperCard='true';
    node.dataset.recordIds=JSON.stringify(paper.record_ids);node.dataset.activeRecord=paper.record_ids.includes(active)?active:'';
    const choose=btn(paper.citation,()=>turn(current,panelMode),'reader-paper-choice');choose.dataset.recordId=current;
    choose.setAttribute('aria-pressed',String(paper.record_ids.includes(active)));node.append(choose);
    if(paper.record_ids.length>1){
      const variant=create('label','reader-variant-label','Variant');const dropdown=create('select');
      dropdown.setAttribute('aria-label',`Variant from ${paper.citation}`);
      for(const [i,id] of paper.record_ids.entries()){
        const row=byId.get(id),option=create('option',null,`Variant ${i+1}${row.title?' - '+row.title:''}`);
        option.value=id;dropdown.append(option);
      }
      dropdown.value=current;dropdown.addEventListener('change',()=>turn(dropdown.value,panelMode));
      variant.append(dropdown);node.append(variant);
    }
    decorateCard?.(node,paper.record_ids);
    return node;
  }
  function sections(groups,panelMode){
    const f=doc.createDocumentFragment();
    for(const {family,cards} of groups){
      const section=create('section','reader-method-family');section.dataset.familyId=family.id;
      const grid=create('div','reader-methods');
      for(const p of cards)grid.append(card(p,panelMode));
      section.append(create('h3',null,family.label),create('p','reader-family-adoption',`${family.paper_count} ${family.paper_count===1?'paper':'papers'}`),grid);
      f.append(section);
    }
    return f;
  }
  function renderVisiblePanel(){
    const matches=state.filter(filter.value),n=matches.reduce((sum,x)=>sum+x.cards.length,0);
    result.textContent=n?`${n} ${n===1?'paper':'papers'}`:'No methods match this filter.';
    list.replaceChildren(sections(matches,true));
  }
  filter.addEventListener('input',()=>{renderVisiblePanel();list.scrollTop=0;});
  const total=groups.families.reduce((n,x)=>n+x.paper_count,0);
  function select(rid){
    active=rid;const shown=state.preview(active);
    preview.replaceChildren(sections(shown,false));
    all.hidden=shown.reduce((n,x)=>n+x.cards.length,0)===total;
    const q=state.selected(active),name=`${q.citation} · ${q.family}`;
    caption.textContent=name;caption.title=name;
    selectedInfo.textContent=`Selected: ${name}`;
    previous.disabled=!q.previous;next.disabled=!q.next;
    if(sheet.open)renderVisiblePanel();
  }
  root.append(preview,all,sheet);host.append(root);select(active);
  return {select,root,bar,open,familyCount:groups.families.length,cardCount:total};
}
