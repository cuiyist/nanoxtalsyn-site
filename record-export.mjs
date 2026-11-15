// Transport validation only: canonical record objects and scientific scope are unchanged.
const LIMIT = 80 * 1024 * 1024;
const need = (ok, message) => { if (!ok) throw Error(message); };
const integer = value => Number.isSafeInteger(value) && value >= 0;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sha = async (raw, cryptoImpl) => Array.from(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', raw)), b => b.toString(16).padStart(2, '0')).join('');

export async function collectRecordExport(manifestUrl, {fetcher = fetch, cryptoImpl = crypto, progress = () => {}} = {}) {
  const url = new URL(manifestUrl);
  const response = await fetcher(url.href);
  need(response.ok, 'Could not load the record export manifest.');
  const manifest = await response.json();
  need(manifest.schema === 'nanoxtalsyn-record-export/1' && manifest.download_name === 'records.jsonl' && manifest.encoding === 'utf-8', 'Unknown record export format.');
  need(integer(manifest.bytes) && integer(manifest.record_count) && hash(manifest.sha256), 'Invalid record export totals.');
  need(Array.isArray(manifest.parts) && manifest.parts.length > 0, 'No record export parts.');
  let bytes = 0, count = 0;
  const single = manifest.parts.length === 1 && manifest.parts[0].path === 'records.jsonl';
  for (const [i, part] of manifest.parts.entries()) {
    const name = single ? 'records.jsonl' : `records.part${String(i + 1).padStart(4, '0')}.jsonl`;
    need(part.path === name && integer(part.bytes) && part.bytes <= LIMIT && integer(part.record_count) && hash(part.sha256), 'Invalid or unordered record export part.');
    bytes += part.bytes; count += part.record_count;
  }
  need(bytes === manifest.bytes && count === manifest.record_count, 'Record export totals disagree.');
  const chunks = [];
  for (const [i, part] of manifest.parts.entries()) {
    progress(`Downloading part ${i + 1} of ${manifest.parts.length}…`);
    const result = await fetcher(new URL(part.path, url).href);
    need(result.ok, `Could not download part ${i + 1}.`);
    const raw = new Uint8Array(await result.arrayBuffer());
    need(raw.byteLength === part.bytes && await sha(raw, cryptoImpl) === part.sha256, `Part ${i + 1} failed its byte/checksum verification.`);
    need(!raw.length || raw.at(-1) === 10, 'Incomplete JSONL record.');
    need(raw.reduce((n, b) => n + (b === 10 ? 1 : 0), 0) === part.record_count, 'Record part count disagrees.');
    chunks.push(raw);
  }
  progress('Verifying complete download…');
  const blob = new Blob(chunks, {type: 'application/x-ndjson;charset=utf-8'});
  need(blob.size === manifest.bytes && await sha(await blob.arrayBuffer(), cryptoImpl) === manifest.sha256, 'Complete record export checksum disagrees.');
  return {blob, filename: manifest.download_name, recordCount: manifest.record_count};
}
