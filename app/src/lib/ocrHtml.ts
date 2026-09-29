export type OcrPaths = { script: string; workerPath?: string; corePath?: string; langPath?: string };

export const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

/**
 * Page that runs Tesseract (WebAssembly) inside a WebView, so photos can be read
 * in Expo Go without native OCR. Messages go out via ReactNativeWebView.postMessage.
 */
export function ocrHtml({ script, ...paths }: OcrPaths) {
  const options = JSON.stringify(Object.fromEntries(Object.entries(paths).filter(([, v]) => v)));
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script src="${script}"></script>
<script>
function post(m) {
  var s = JSON.stringify(m);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else if (window.__out) window.__out(s);
}
var workerP = null;
function getWorker() {
  if (!workerP) {
    if (!window.Tesseract) { post({ type: 'fatal', error: 'tesseract-not-loaded' }); return Promise.reject(new Error('tesseract-not-loaded')); }
    var opts = Object.assign(${options}, {
      logger: function (m) { if (m.status && typeof m.progress === 'number') post({ type: 'progress', status: m.status, progress: m.progress }); }
    });
    workerP = Tesseract.createWorker('eng', 1, opts).then(function (w) { post({ type: 'ready' }); return w; });
    workerP.catch(function (e) { workerP = null; post({ type: 'fatal', error: String(e && e.message || e) }); });
  }
  return workerP;
}
window.ocr = function (id, dataUrl) {
  getWorker()
    .then(function (w) { return w.recognize(dataUrl); })
    .then(function (r) { post({ type: 'result', id: id, text: r.data.text }); })
    .catch(function (e) { post({ type: 'result', id: id, error: String(e && e.message || e) }); });
};
getWorker();
</script></body></html>`;
}
