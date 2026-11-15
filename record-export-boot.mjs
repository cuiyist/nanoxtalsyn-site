import {collectRecordExport} from './record-export.mjs';

const link = document.getElementById('record-export-download');
const status = document.getElementById('record-export-status');
let busy = false;
link?.addEventListener('click', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true; link.setAttribute('aria-disabled', 'true');
  try {
    const result = await collectRecordExport(link.href, {progress: text => { status.textContent = text; }});
    const objectUrl = URL.createObjectURL(result.blob);
    const download = document.createElement('a');
    download.href = objectUrl; download.download = result.filename;
    document.body.append(download); download.click(); download.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    status.textContent = `Verified download prepared: ${result.recordCount} records.`;
  } catch (error) {
    status.textContent = `${error.message} You can download all individual parts below and concatenate them in order.`;
  } finally {
    busy = false; link.removeAttribute('aria-disabled');
  }
});
