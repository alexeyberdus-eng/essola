import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { registerWebOcr } from '../lib/ocr';
import { ocrHtml, TESSERACT_CDN } from '../lib/ocrHtml';

export type OcrStatus = { state: 'loading' | 'ready' | 'error'; progress: number };

type Pending = { resolve: (text: string) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

/**
 * Invisible WebView hosting Tesseract. Mount it on the scanner screen: it starts downloading
 * the English model (~4 MB, cached afterwards) while the user frames the shot.
 */
export function OcrWebView({ onStatus }: { onStatus?: (s: OcrStatus) => void }) {
  const web = useRef<WebView>(null);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);
  const html = useMemo(() => ocrHtml({ script: TESSERACT_CDN }), []);

  useEffect(() => {
    const jobs = pending.current;
    registerWebOcr(
      (dataUrl) =>
        new Promise<string>((resolve, reject) => {
          const id = nextId.current++;
          // First run includes the model download, so allow a generous timeout.
          const timer = setTimeout(() => {
            jobs.delete(id);
            reject(new Error('OCR_TIMEOUT'));
          }, 120_000);
          jobs.set(id, { resolve, reject, timer });
          web.current?.injectJavaScript(`window.ocr(${id}, ${JSON.stringify(dataUrl)}); true;`);
        }),
    );
    return () => {
      registerWebOcr(null);
      jobs.forEach((p) => {
        clearTimeout(p.timer);
        p.reject(new Error('OCR_UNMOUNTED'));
      });
      jobs.clear();
    };
  }, []);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; id?: number; text?: string; error?: string; progress?: number; status?: string };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'progress' && msg.status?.includes('loading')) onStatus?.({ state: 'loading', progress: msg.progress ?? 0 });
    if (msg.type === 'ready') onStatus?.({ state: 'ready', progress: 1 });
    if (msg.type === 'fatal') onStatus?.({ state: 'error', progress: 0 });
    if (msg.type === 'result' && msg.id) {
      const job = pending.current.get(msg.id);
      if (!job) return;
      clearTimeout(job.timer);
      pending.current.delete(msg.id);
      msg.error ? job.reject(new Error(msg.error)) : job.resolve(msg.text ?? '');
    }
  };

  return (
    <View pointerEvents="none" style={styles.hidden}>
      <WebView
        ref={web}
        source={{ html, baseUrl: 'https://essola.app/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={onMessage}
        onError={() => onStatus?.({ state: 'error', progress: 0 })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 2, height: 2, opacity: 0, left: -10, top: -10 },
});
