import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';
import { Press, tap } from './ui';
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
  var ticks = 0;
  var sentTitle = false;
  function title() {
    var h = document.querySelector('h1');
    return ((h && h.innerText) || document.title || '').trim();
  }
  function tick() {
    ticks++;
    try {
      // No composition after a while: send at least the name, so our base can be searched.
      if (ticks === 14 && !sentTitle && title()) {
        sentTitle = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({ title: title(), text: '' }));
      }
      if (clicked < 3) {
        var els = document.querySelectorAll('button, [role="tab"], [role="button"], summary, li, div, span, a');
        for (var i = 0; i < els.length; i++) {
          var t = (els[i].textContent || '').trim().toLowerCase();
          if (t === 'состав' || t === 'ingredients' || t === 'состав продукта' || t === 'состав и описание' || t === 'описание и состав' || t === 'характеристики и описание' || t === 'все характеристики и описание' || t === 'все характеристики') { els[i].click(); clicked++; break; }
        }
      }
      var found = pick();
      if (found) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ title: title(), text: found }));
        return;
      }
    } catch (e) {}
    setTimeout(tick, 800);
  }
  setTimeout(tick, 1000);
})();
true;
`;

const cleanTitle = (t: string) =>
  t
    .replace(/\s*[—|-]\s*(Золотое Яблоко|Gold Apple|Л'Этуаль|ЛЭТУАЛЬ|letu).*$/i, '')
    .replace(/\s*(купить|—|\|).*(ozon|озон|wildberries|вайлдберриз).*$/i, '')
    .replace(/^купить\s+/i, '')
    .trim();

/**
 * Opens a Letual / Gold Apple / Wildberries / Ozon product page inside the app, on screen: the shop's device check passes like for
 * any visitor, and the ingredient list is read automatically as soon as it appears (the script also opens the
 * «Состав» tab). The user can scroll, open the tab by hand, or fall back to a screenshot of it.
 */
export function ShopPage({ url, name, hidden, onFound, onTitle, onClose, onScreenshot }: { url: string | null; name?: string; hidden?: boolean; onFound: (p: { title: string; text: string }) => void; onTitle?: (title: string) => void; onClose: () => void; onScreenshot: () => void }) {
  const insets = useSafeAreaInsets();
  const done = useRef(false);
  const web = useRef<WebView>(null);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    done.current = false;
    setSlow(false);
    if (!url) return;
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, [url]);
  if (!url) return null;
  const shop = name ?? (/letu/i.test(url) ? 'Летуаль' : 'Золотое Яблоко');
  // Hidden: the page loads behind the «reading» screen and is read without being shown.
  if (hidden)
    return (
      <View style={styles.hidden} pointerEvents="none">
        <WebView
          ref={web}
          source={{ uri: url }}
          injectedJavaScript={FIND}
          applicationNameForUserAgent="Version/17.0 Mobile/15E148 Safari/604.1"
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          onLoadEnd={() => web.current?.injectJavaScript(FIND)}
          onMessage={(e) => {
            if (done.current) return;
            try {
              const data = JSON.parse(e.nativeEvent.data) as { title: string; text: string };
              if (!data.text) {
                if (data.title) onTitle?.(cleanTitle(data.title));
                return;
              }
              done.current = true;
              onFound({ title: cleanTitle(data.title), text: data.text.replace(/\\n/g, ' ') });
            } catch {}
          }}
          style={{ flex: 1 }}
        />
      </View>
    );
  return (
    <View style={[styles.sheet, { paddingTop: insets.top + 6 }]}>
      <View style={styles.head}>
        <Press onPress={onClose} style={styles.close} accessibilityLabel="Закрыть">
          <Icon name="close" size={18} color={colors.ink} />
        </Press>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Читаем состав · {shop}</Text>
          <Text style={styles.hint} numberOfLines={2}>
            {slow ? 'Откройте на странице вкладку «Состав» — прочитаем сами' : 'Страница загружается, состав найдём автоматически…'}
          </Text>
        </View>
        <ActivityIndicator color={colors.violet} />
      </View>
      <WebView
        ref={web}
        source={{ uri: url }}
        injectedJavaScript={FIND}
        // Look like mobile Safari / Chrome: some shops refuse unknown in-app browsers.
        applicationNameForUserAgent="Version/17.0 Mobile/15E148 Safari/604.1"
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        onLoadEnd={() => web.current?.injectJavaScript(FIND)}
        onMessage={(e) => {
          if (done.current) return;
          try {
            const data = JSON.parse(e.nativeEvent.data) as { title: string; text: string };
            if (!data.text) {
              if (data.title) onTitle?.(cleanTitle(data.title));
              return;
            }
            if (data.text) {
              done.current = true;
              tap('success');
              onFound({ title: cleanTitle(data.title), text: data.text.replace(/\\n/g, ' ') });
            }
          } catch {
            // ignore malformed messages
          }
        }}
        style={{ flex: 1 }}
      />
      {slow && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
          <Press onPress={() => web.current?.injectJavaScript(FIND)} style={[styles.btn, styles.btnDark]}>
            <Text style={[styles.btnText, { color: '#fff' }]}>Прочитать состав</Text>
          </Press>
          <Press onPress={onScreenshot} style={styles.btn}>
            <Text style={styles.btnText}>Загрузить скриншот</Text>
          </Press>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#fff', zIndex: 30 },
  hidden: { position: 'absolute', left: 0, top: 0, width: 390, height: 844, opacity: 0.01, zIndex: -1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, borderColor: colors.line },
  close: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  bar: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  btn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1' },
  btnDark: { backgroundColor: colors.accent },
  btnText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
});
