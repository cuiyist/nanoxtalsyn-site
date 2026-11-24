// Card thumbnails from pinned existing coordinates only (not paper images).
import {drawStillReference,thumbnailLayout} from './coordinate-still.mjs?v=0.52.0';
import {assembleCellView} from './closed-cell-display.mjs?v=0.52.0';

const pinnedPath=/^models\/[A-Za-z0-9][A-Za-z0-9._/-]*\.json$/;
const valid=(p,h)=>typeof p==='string'&&pinnedPath.test(p)&&!p.split('/').some(x=>x==='..'||x==='.')&&/^[a-f0-9]{64}$/.test(h||'');
const models=new Map();

async function modelFrom(url,sha){
  const key=url.href+'?sha='+sha;
  if(!models.has(key))models.set(key,(async()=>{
    const response=await fetch(key);if(!response.ok)throw Error('Pinned reference coordinates unavailable');
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength>3_000_000)throw Error('Reference thumbnail asset exceeds supported size');
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==sha)throw Error('Reference thumbnail checksum changed');
    return JSON.parse(new TextDecoder().decode(bytes));
  })().catch(error=>{models.delete(key);throw error;}));
  return models.get(key);
}

export function referenceStillSource(viewerEntry){
  const ref=viewerEntry?.readerAmbientReference;
  if(ref&&valid(ref.modelPath,ref.modelSha256)&&ref.referenceOnly===true&&ref.trainingEligible===false)
    return {path:ref.modelPath,sha:ref.modelSha256,kind:'crystal'};
  const mol=viewerEntry?.model3dPath,sha=viewerEntry?.assetHashes?.model3dPath;
  if(valid(mol,sha))return {path:mol,sha,kind:'molecule'};
  return null;
}

function upgradeReferenceStill(picture,entry,{chemicalBase,crystalBase,cellVectors,label,onUnavailable}){
  const source=referenceStillSource(entry);if(!source)return false;
  async function replace(){
    if(!picture.isConnected)return;
    const isCrystal=source.kind==='crystal',url=new URL(source.path,isCrystal?crystalBase:chemicalBase);
    const model=await modelFrom(url,source.sha);
    if(!picture.isConnected)return;
    const geometry=isCrystal?assembleCellView(model,await cellVectors(model)):{atoms:model.atoms,bonds:(model.bonds||[]).map(b=>[b.a,b.b])};
    if(!picture.isConnected)return;
    const copied=drawStillReference(picture.ownerDocument,thumbnailLayout(geometry.atoms,geometry.bonds,{crystal:isCrystal}),label);
    picture.replaceWith(copied);
  }
  function reveal(){void replace().catch(()=>{if(picture.isConnected)onUnavailable(picture);});}
  // Let the owner append the original fallback before wiring lazy visibility.
  queueMicrotask(()=>{
    if(!picture.isConnected)return;
    if(!globalThis.IntersectionObserver){reveal();return;}
    const observer=new IntersectionObserver(items=>{
      if(!items.some(i=>i.isIntersecting))return;
      observer.disconnect();reveal();
    },{rootMargin:'160px'});
    observer.observe(picture);
  });
  return true;
}

export function precursorReferencePicture(document,entry,options,picture2d){
  const note=text=>{
    const p=document.createElement('p');p.className='reader-note chemical-reference-picture-note';
    p.style.fontSize='13px';p.textContent=text;return p;
  };
  if(!referenceStillSource(entry)){
    // Keep a genuine 2D molecular drawing when no eligible 3D coordinates
    // are listed. Text-only SVGs are not a chemical picture.
    if(entry?.depictionKind==='molecule'&&valid(entry.model2dPath,entry.assetHashes?.model2dPath))return picture2d();
    return note(entry?.component3dModels?.length?'Individual component references are available in the viewer.':
                                               'No reference drawing is assigned.');
  }
  const picture=document.createElement('div');
  picture.className='chemical-preview chemical-coordinate-pending';picture.setAttribute('aria-hidden','true');
  upgradeReferenceStill(picture,entry,{...options,onUnavailable:part=>part.replaceWith(note('Reference drawing unavailable.'))});
  return picture;
}
