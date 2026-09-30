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
    // Latin for INCI lists + Cyrillic for Russian labels ("Состав: вода, глицерин…").
    workerP = Tesseract.createWorker(['rus', 'eng'], 1, opts).then(function (w) { post({ type: 'ready' }); return w; });
    workerP.catch(function (e) { workerP = null; post({ type: 'fatal', error: String(e && e.message || e) }); });
  }
  return workerP;
}
// Grayscale + contrast stretch: glossy packaging and coloured print read much better.
function prepare(dataUrl) {
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      try {
        var c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        var x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        var d = x.getImageData(0, 0, c.width, c.height), p = d.data, lo = 255, hi = 0, i, g;
        for (i = 0; i < p.length; i += 4) {
          g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
          p[i] = g; if (g < lo) lo = g; if (g > hi) hi = g;
        }
        var k = 255 / Math.max(1, hi - lo);
        for (i = 0; i < p.length; i += 4) {
          g = Math.min(255, Math.max(0, (p[i] - lo) * k));
          p[i] = p[i + 1] = p[i + 2] = g;
        }
        x.putImageData(d, 0, 0);
        resolve(c);
      } catch (e) { resolve(dataUrl); }
    };
    img.onerror = function () { resolve(dataUrl); };
    img.src = dataUrl;
  });
}

window.ocr = function (id, dataUrl) {
  Promise.all([getWorker(), prepare(dataUrl)])
    .then(function (r) { return r[0].recognize(r[1]); })
    .then(function (r) { post({ type: 'result', id: id, text: r.data.text }); })
    .catch(function (e) { post({ type: 'result', id: id, error: String(e && e.message || e) }); });
};
getWorker();
</script></body></html>`;
}
