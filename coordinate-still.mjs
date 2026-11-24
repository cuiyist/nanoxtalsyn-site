import {smallMoleculeThumbnailScale} from './closed-cell-geometry.mjs?v=0.52.0';

// Small offline stills of existing pinned references. No caption, coordinates,
// or chemical assertion is added to a record. The DOM caller owns all wording.
const PALETTE={C:'#566e86',H:'#c8d3df',N:'#445dca',O:'#c63f54',P:'#c57925',S:'#b39e30',
               Cd:'#257f90',Na:'#745bc1',Cl:'#40905a',In:'#546ca9',As:'#a66bb5',Se:'#ce8842'};
const NS='http://www.w3.org/2000/svg';
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const point=a=>[a.x,a.y,a.z];
const norm=a=>{const n=Math.hypot(...a);return n>1e-9?a.map(x=>x/n):[1,0,0];};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const defaults=[[.70710678,-.70710678,0],[-.40824829,-.40824829,.81649658]];

export function thumbnailLayout(atoms,bonds,{width=300,height=146,crystal=false}={}) {
  if(!Array.isArray(atoms)||!atoms.length||atoms.length>400)throw Error('Reference thumbnail atom inventory out of range');
  const points=atoms.map(point);if(!points.every(p=>p.every(Number.isFinite)))throw Error('Invalid thumbnail coordinates');
  if(!Array.isArray(bonds)||bonds.length>1600||bonds.some(([a,b])=>!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||a>=points.length||b>=points.length||a===b))throw Error('Invalid thumbnail bonds');
  let axes=defaults;
  if(!crystal&&points.length>1&&points.length<=3){
    const pairs=bonds.length?bonds:[[0,1]];
    const vectors=pairs.map(([i,j])=>points[i].map((x,k)=>x-points[j][k]));
    vectors.sort((a,b)=>Math.hypot(...b)-Math.hypot(...a));const x=norm(vectors[0]);
    axes=[x,norm(cross(x,Math.abs(x[2])<.8?[0,0,1]:[0,1,0]))];
  }
  const projected=points.map(p=>axes.map(axis=>dot(p,axis)));
  const min=axes.map((_,i)=>Math.min(...projected.map(p=>p[i]))),max=axes.map((_,i)=>Math.max(...projected.map(p=>p[i])));
  const center=min.map((x,i)=>(x+max[i])/2);
  const scale=smallMoleculeThumbnailScale(points,axes,bonds,width-50,height-36,48);
  const depth=cross(...axes);
  const xy=projected.map((p,i)=>({x:width/2+scale*(p[0]-center[0]),y:height/2-scale*(p[1]-center[1]),
    z:dot(points[i],depth),element:atoms[i].element??atoms[i].elem,uncertain:atoms[i].mixed_site||Object.hasOwn(atoms[i],'occupancy')&&atoms[i].occupancy!==1}));
  return {width,height,atoms:xy,bonds,radius:crystal?5:points.length<=3?9:6};
}

export function drawStillReference(document,layout,accessibleLabel){
  const make=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
  const s=make('svg',{viewBox:`0 0 ${layout.width} ${layout.height}`,class:'chemical-preview chemical-coordinate-still',
                       role:'img','aria-label':accessibleLabel,preserveAspectRatio:'xMidYMid meet'});
  const {atoms,radius}=layout;
  const layers=layout.bonds.map(([i,j])=>({kind:'bond',z:(atoms[i].z+atoms[j].z)/2,ends:[i,j]}));
  for(const atom of atoms)layers.push({kind:'atom',z:atom.z,atom});
  for(const shape of layers.sort((a,b)=>a.z-b.z)){
    if(shape.kind==='bond'){
      const[a,b]=shape.ends.map(i=>atoms[i]);
      s.append(make('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#8b9bad','stroke-width':radius<=5?1.4:3,'stroke-linecap':'round'}));
    }else{
      const a=shape.atom;
      s.append(make('circle',{cx:a.x,cy:a.y,r:radius,fill:PALETTE[a.element]||'#8295a9',
                              opacity:a.uncertain?.52:1,stroke:'#fff','stroke-width':.8}));
    }
  }
  return s;
}
