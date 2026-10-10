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
  // A real ingredient list: several short comma-separated items with typical ingredient words, not a sentence
  // from the description («Состав подобран для…»). Shops put many texts near the word «Состав».
  var MARK = /(aqua|water|вода|glycer|глицер|extract|экстракт|\\boil\\b|масл|acid|кислот|parfum|fragrance|отдушк|alcohol|спирт|sodium|натри|\\bci ?\\d|tocopher|токофер|panthen|пантен|butter|сорбат|benzo|бензо|phenoxy|феноксиэт|cetearyl|цетеарил|glycol|гликол|hyaluron|гиалурон|niacin|ниацин|squal|сквал|vitamin|витамин|laur|лаур|xanthan|ксантан|carbomer|карбомер|dimethicon|диметикон|citric|лимонн|ceramide|керамид|allantoin|аллантоин|urea|мочевин|lanolin|ланолин|cera|воск)/gi;
  var PROSE = /(примен|способ|рекоменд|подходит|идеальн|помогает|позволяет|подобран|разработан|обеспечива|для ухода|наносить|кожа станет)/i;
  function clean(t) {
    t = String(t || '').replace(/\\s+/g, ' ').trim();
    var cut = t.search(/(способ применения|применение|срок годности|условия хранения|объ[её]м|страна|производитель|артикул|меры предосторожности)/i);
    if (cut > 20) t = t.slice(0, cut);
    return t.replace(/^[\\s:：-]+/, '').trim();
  }
  function score(t) {
    if (!t || t.length < 12 || t.length > 4000) return 0;
    var parts = t.split(/\\s*[,;]\\s*/).filter(function (x) { return x.length > 1; });
    if (parts.length < 3) return 0;
    var long = parts.filter(function (x) { return x.length > 60; }).length;
    if (long > parts.length / 3) return 0;
    if (PROSE.test(t.slice(0, 120))) return 0;
    var marks = (t.match(MARK) || []).length;
    if (marks < 2) return 0;
    return marks * 3 + Math.min(parts.length, 40);
  }
  function pick() {
    var cands = [];
    // 1) The «Состав» field itself: a label element followed by its value (characteristics tables, tabs, dt/dd).
    var els = document.querySelectorAll('dt, dd, th, td, span, div, p, h2, h3, h4, b, strong, li');
    for (var i = 0; i < els.length && cands.length < 40; i++) {
      var own = (els[i].textContent || '').trim().toLowerCase().replace(/[:：]$/, '');
      if (own !== 'состав' && own !== 'ingredients' && own !== 'inci' && own !== 'состав (inci)' && own !== 'состав продукта' && own !== 'полный состав') continue;
      var el = els[i];
      for (var up = 0; up < 3 && el; up++) {
        var next = el.nextElementSibling;
        if (next) cands.push(clean(next.innerText || next.textContent));
        el = el.parentElement;
      }
    }
    // 2) «Состав: …» inside a text block.
    var text = document.body ? document.body.innerText : '';
    var re = /(?:^|\\n|\\.\\s)(?:полный\\s+)?(?:состав|ingredients|inci)\\s*(?:\\(inci\\))?\\s*[:：]?\\s*\\n?([^\\n]{12,4000})/gi;
    var m;
    while ((m = re.exec(text)) && cands.length < 60) cands.push(clean(m[1]));
    // 3) Data embedded in the page.
    var html = document.documentElement ? document.documentElement.innerHTML : '';
    var j = html.match(/"(?:composition|ingredients|sostav)"\\s*:\\s*"([^"]{12,4000})"/i);
    if (j) cands.push(clean(j[1]));
    var best = null, top = 0;
    for (var k = 0; k < cands.length; k++) {
      var sc = score(cands[k]);
      if (sc > top) { top = sc; best = cands[k]; }
    }
    return best;
  }
  var ticks = 0;
  var sentTitle = false;
  function title() {
    var h = document.querySelector('h1');
    var og = document.querySelector('meta[property="og:title"]');
    var t = ((h && h.innerText) || (og && og.getAttribute('content')) || '').trim();
    // A shop's visitor check (Gold Apple «checking device», Ozon «Доступ ограничен») is not the product.
    return /checking|проверк|robot|робот|captcha|доступ ограничен|access denied/i.test(t) ? '' : t;
  }
  var CLICK = ['состав', 'ingredients', 'состав продукта', 'состав и описание', 'описание и состав', 'характеристики и описание', 'все характеристики и описание', 'все характеристики', 'характеристики', 'о товаре', 'описание', 'читать полностью', 'показать полностью', 'развернуть'];
  var done = {};
  function tick() {
    ticks++;
    try {
      // The name as soon as the page shows it: our base is searched by it while the composition is looked for.
      if (!sentTitle && title().length > 6 && ticks >= 2) {
        sentTitle = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({ title: title(), text: '' }));
      }
      // Shops load the description and characteristics lower on the page only when scrolled to.
      if (ticks % 2 === 0) window.scrollBy(0, 900);
      if (clicked < 6) {
        var els = document.querySelectorAll('button, [role="tab"], [role="button"], summary, li, div, span, a');
        for (var i = 0; i < els.length; i++) {
          var t = (els[i].textContent || '').trim().toLowerCase();
          if (t.length < 40 && CLICK.indexOf(t) >= 0 && !done[t]) { done[t] = 1; try { els[i].click(); } catch (e) {} clicked++; break; }
        }
      }
      var found = pick();
      if (found) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ title: title(), text: found }));
        return;
      }
    } catch (e) {}
    setTimeout(tick, 500);
  }
  setTimeout(tick, 400);
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
