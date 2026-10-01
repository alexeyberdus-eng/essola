import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Runs inside the shop page: opens a collapsed "Состав" tab and posts the ingredient list once it appears.
const FIND = `
(function () {
  var clicked = 0;
  function pick() {
    var text = document.body ? document.body.innerText : '';
    var m = text.match(/(?:состав|ingredients|inci)\\s*[:：]?\\s*\\n*\\s*((?:aqua|water|вода|[a-zа-яё][^\\n]{2,60}),[^\\n]{20,3000})/i);
    if (m) return m[1];
    var html = document.documentElement ? document.documentElement.innerHTML : '';
    var h = html.match(/(?:Состав|Ingredients|INCI)[^<]{0,40}<\\/[^>]+>(?:\\s*<[^>]+>){0,4}\\s*([^<]{30,3000})/i);
    if (h && h[1].indexOf(',') > 0) return h[1];
    var j = html.match(/"(?:composition|ingredients|sostav)"\\s*:\\s*"([^"]{30,3000})"/i);
    return j ? j[1] : null;
  }
  function tick() {
    try {
      if (clicked < 3) {
        var els = document.querySelectorAll('button, [role="tab"], [role="button"], summary, li, div, span, a');
        for (var i = 0; i < els.length; i++) {
          var t = (els[i].textContent || '').trim().toLowerCase();
          if (t === 'состав' || t === 'ingredients' || t === 'состав продукта' || t === 'состав и описание' || t === 'описание и состав') { els[i].click(); clicked++; break; }
        }
      }
      var found = pick();
      if (found) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ title: document.title, text: found }));
        return;
      }
    } catch (e) {}
    setTimeout(tick, 800);
  }
  setTimeout(tick, 1000);
})();
true;
`;

/**
 * Reads a Gold Apple / Letual product page on the phone without showing it (the loader stays on screen):
 * opens the page like a normal visit, finds the ingredient list and hands it back. Gives up after 25 s.
 */
export function ShopPage({ url, onFound, onClose }: { url: string | null; onFound: (p: { title: string; text: string }) => void; onClose: () => void }) {
  const done = useRef(false);
  useEffect(() => {
    done.current = false;
    if (!url) return;
    const t = setTimeout(() => {
      if (!done.current) onClose();
    }, 25000);
    return () => clearTimeout(t);
    // onClose is stable enough for a one-shot timeout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  if (!url) return null;
  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        source={{ uri: url }}
        injectedJavaScript={FIND}
        onMessage={(e) => {
          if (done.current) return;
          try {
            const data = JSON.parse(e.nativeEvent.data) as { title: string; text: string };
            if (data.text) {
              done.current = true;
              onFound({ title: data.title.replace(/\s*[—|-]\s*(Золотое Яблоко|Gold Apple|Л'Этуаль|ЛЭТУАЛЬ|letu).*$/i, '').trim(), text: data.text.replace(/\\n/g, ' ') });
            }
          } catch {
            // ignore malformed messages
          }
        }}
        style={{ width: 390, height: 800 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', left: -1000, top: 0, width: 390, height: 800, opacity: 0 },
});
