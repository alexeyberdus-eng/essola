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
    workerP = Tesseract.createWorker(['rus', 'eng'], 1, opts)
      // PSM 6 = one uniform block of text: fits a dense ingredient paragraph better than full-page layout analysis.
      .then(function (w) { return w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1', user_defined_dpi: '300' }).then(function () { return w; }); })
      .then(function (w) { post({ type: 'ready' }); return w; });
    workerP.catch(function (e) { workerP = null; post({ type: 'fatal', error: String(e && e.message || e) }); });
  }
  return workerP;
}
// Grayscale, upscale small photos, robust contrast stretch (ignores glare) and inverts light-on-dark print.
function prepare(dataUrl) {
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      try {
        var scale = img.width < 1800 ? 1800 / img.width : 1;
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        var x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.drawImage(img, 0, 0, c.width, c.height);
        var d = x.getImageData(0, 0, c.width, c.height), p = d.data, i, g, hist = new Array(256).fill(0), n = p.length / 4, sum = 0;
        for (i = 0; i < p.length; i += 4) {
          g = Math.round(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]);
          p[i] = g; hist[g]++; sum += g;
        }
        var acc = 0, lo = 0, hi = 255;
        for (i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.02) { lo = i; break; } }
        acc = 0;
        for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.02) { hi = i; break; } }
        var invert = sum / n < 110; // white text on dark packaging
        var k = 255 / Math.max(1, hi - lo);
        for (i = 0; i < p.length; i += 4) {
          g = Math.min(255, Math.max(0, (p[i] - lo) * k));
          if (invert) g = 255 - g;
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
