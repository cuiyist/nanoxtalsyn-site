// R2/R3 draft geometry. Display expansion never changes reference data files.
const dot=(a,b)=>a.reduce((r,x,i)=>r+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const xyz=a=>[a.x,a.y,a.z];

export function closedCrystalCell(model,repeats=1){
  if(!Number.isSafeInteger(repeats)||repeats<1||repeats>3)throw Error('Invalid display repeats');
  const vectors=model.cellVectors;
  if(vectors?.length!==3||!vectors.every(v=>v.length===3&&v.every(Number.isFinite)))throw Error('Invalid reference lattice');
  const [a,b,c]=vectors,volume=dot(a,cross(b,c));if(Math.abs(volume)<1e-8)throw Error('Degenerate reference lattice');
  if(!Array.isArray(model.atoms)||!model.atoms.length||model.atoms.length>500)throw Error('Unsupported reference atom inventory');
  const eps=1e-6;
  const normal=x=>{const y=x-Math.floor(x);return y<eps||1-y<eps?0:y;};
  const cart=f=>vectors[0].map((_,k)=>f.reduce((acc,x,i)=>acc+x*vectors[i][k],0));
  const unique=new Map();
  for(const atom of model.atoms){
    const p=xyz(atom);if(!p.every(Number.isFinite))throw Error('Invalid reference coordinates');
    const fractional=[dot(p,cross(b,c)),dot(p,cross(c,a)),dot(p,cross(a,b))].map(x=>normal(x/volume));
    const species=atom.element??atom.elem;if(!species)throw Error('Missing atom species');
    const key=species+' '+fractional.map(x=>x.toFixed(6)).join(' ');
    if(!unique.has(key))unique.set(key,{atom,fractional,species});
  }
  const base=[...unique.values()];
  const primary=base.map(site=>cart(site.fractional));
  const nearest=base.map(()=>Infinity), translations=[], squaredEps=eps*eps;
  for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1])translations.push(cart([x,y,z]));
  // Compute the nearest reference separation with periodic neighbours, but
  // draw only links whose two endpoints are visible in the closed cell.
  for(let i=0;i<base.length;i++)for(let j=0;j<base.length;j++){
    const [x,y,z]=primary[i].map((value,k)=>value-primary[j][k]);
    for(const [tx,ty,tz] of translations){
      const d=(x-tx)**2+(y-ty)**2+(z-tz)**2;
      if(d>squaredEps&&d<nearest[i])nearest[i]=d;
    }
  }
  const copies=[],origin=[],bounds=v=>Array.from({length:repeats+(v===0?1:0)},(_,i)=>i);
  for(const [site,{atom,species,fractional:f}] of base.entries()){
    for(const i of bounds(f[0]))for(const j of bounds(f[1]))for(const k of bounds(f[2])){
      const frac=[f[0]+i,f[1]+j,f[2]+k],boundary=frac.some(x=>x===0||x===repeats);
      const [x,y,z]=cart(frac);copies.push({...atom,elem:species,x,y,z,serial:copies.length,boundaryReplica:boundary,bonds:[],bondOrder:[]});origin.push(site);
    }
  }
  // Existing dense perovskite references have over 3,000 display sites
  // in a supported 2×2×2 view. Keep the guard and index visible neighbours.
  if(copies.length>4500)throw Error('Reference view exceeds display size limit');
  const bonds=[];
  const shortest=Math.sqrt(Math.min(...nearest));
  const uncertain=atom=>atom.mixed_site||Object.hasOwn(atom,'occupancy')&&atom.occupancy!==1;
  const toleranceSquared=1.025**2;
  const width=Math.sqrt(Math.max(...nearest)*toleranceSquared);
  if(Number.isFinite(width)&&width>0){
    const positions=copies.map(atom=>xyz(atom).map(value=>Math.floor(value/width)));
    const visible=new Map();
    for(const [i,p] of positions.entries()){
      if(uncertain(copies[i]))continue;
      const key=p.join(',');if(!visible.has(key))visible.set(key,[]);visible.get(key).push(i);
    }
    for(const [i,[x,y,z]] of positions.entries()){
      if(uncertain(copies[i]))continue;
      const candidates=[];
      for(const a of [-1,0,1])for(const b of [-1,0,1])for(const c of [-1,0,1]){
        for(const j of visible.get([x+a,y+b,z+c].join(','))||[])if(j>i)candidates.push(j);
      }
      for(const j of candidates.sort((a,b)=>a-b)){
        const a=copies[i],b=copies[j];
        const d=(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;
        if(d<=squaredEps||d>Math.min(nearest[origin[i]],nearest[origin[j]])*toleranceSquared)continue;
        a.bonds.push(j);a.bondOrder.push(1);b.bonds.push(i);b.bondOrder.push(1);bonds.push([i,j]);
      }
    }
  }
  return {atoms:copies,bonds,originalAtomCount:base.length,nearestReferenceDistance:shortest};
}

export function smallMoleculeThumbnailScale(points,axes,bonds,availableWidth,availableHeight,maximumBond){
  if(!points.length||![availableWidth,availableHeight,maximumBond].every(x=>Number.isFinite(x)&&x>0))throw Error('Invalid card geometry');
  const xy=points.map(p=>axes.map(axis=>dot(p,axis)));
  const extent=i=>Math.max(...xy.map(p=>p[i]))-Math.min(...xy.map(p=>p[i]));
  const longest=bonds.length?Math.max(...bonds.map(([x,y])=>dist(xy[x],xy[y]))):0;
  return Math.min(availableWidth/Math.max(extent(0),1e-6),availableHeight/Math.max(extent(1),1e-6),points.length<=3&&longest?maximumBond/longest:Infinity);
}
