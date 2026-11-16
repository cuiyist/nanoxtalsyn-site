// One shared promise cache for monolith, legacy split and bounded verified parts.
const BASE='reader-presentation.json';
const MARKER='_reader_registry_split';
const TABLES=['records','materials','figures_by_source'];
const MAX_PART_BYTES=80*1024*1024;
const MAX_PARTS=1024;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function tables(value){if(!object(value)||TABLES.some(k=>!object(value[k])))throw Error('Invalid Reader tables');}
function partRefs(marker){
 if(!object(marker))throw Error('Invalid public Reader split marker');
 let refs;
 if(Object.keys(marker).sort().join(',')==='part,schema,sha256'&&marker.schema==='reader-presentation-two-part/1')refs=[{part:marker.part,sha256:marker.sha256}];
 else if(Object.keys(marker).sort().join(',')==='parts,schema'&&marker.schema==='reader-presentation-parts/1')refs=marker.parts;
 else throw Error('Invalid public Reader split marker');
 if(!Array.isArray(refs)||!refs.length||refs.length>MAX_PARTS)throw Error('Invalid public Reader split marker count');
 for(const [i,ref]of refs.entries())if(!object(ref)||Object.keys(ref).sort().join(',')!=='part,sha256'||ref.part!==`reader-presentation.part${i+2}.json`||typeof ref.sha256!=='string'||!(/^[0-9a-f]{64}$/).test(ref.sha256))throw Error('Invalid public Reader split marker');
 return refs;
}
export function createReaderPresentationLoader({fetcher=(...a)=>globalThis.fetch(...a),crypto=globalThis.crypto}={}){
 const cache=new Map();
 async function bytes(url){const response=await fetcher(url,{cache:'no-store'});if(!response.ok)throw Error('Unavailable '+url);const raw=new Uint8Array(await response.arrayBuffer());if(raw.byteLength>=MAX_PART_BYTES)throw Error('Reader part exceeds byte limit');return raw;}
 const parse=raw=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
 async function read(url){
  const base=parse(await bytes(url));tables(base);
  if(!own(base,MARKER))return base;
  const refs=partRefs(base[MARKER]);
  if(!crypto?.subtle)throw Error('Reader checksum verification unavailable');
  const result={...base};delete result[MARKER];
  for(const ref of refs){
  const raw=await bytes(new URL(ref.part,url).href);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==ref.sha256)throw Error('Reader part checksum differs');
  const part=parse(raw);tables(part);
  if(Object.keys(part).sort().join(',')!==[...TABLES].sort().join(','))throw Error('Unexpected Reader part fields');
  for(const table of TABLES){
   if(Object.keys(part[table]).some(key=>own(result[table],key)))throw Error('Duplicate Reader keys across parts');
   result[table]={...result[table],...part[table]};
  }
  }
  return result;
 }
 return function load(url){
  const key=new URL(String(url),import.meta.url);
  if(!key.pathname.endsWith('/'+BASE))return Promise.reject(Error('Use the fixed public Reader path'));
  if(!cache.has(key.href))cache.set(key.href,read(key.href));
  return cache.get(key.href);
 };
}
export const loadReaderPresentations=createReaderPresentationLoader();
