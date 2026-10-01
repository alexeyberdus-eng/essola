import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { colors, fonts, space } from '../theme';
import { Icon } from './Icon';
import { IconButton } from './ui';

// Runs inside the shop page the user opened: opens the "Состав" tab if it is collapsed and posts the list once it appears.
const FIND = `
(function () {
  var clicked = false;
  function tick() {
    try {
      if (!clicked) {
        var els = document.querySelectorAll('button, [role="tab"], [role="button"], summary, div, span, a');
        for (var i = 0; i < els.length; i++) {
          var t = (els[i].textContent || '').trim().toLowerCase();
          if (t === 'состав' || t === 'ingredients' || t === 'состав продукта' || t === 'состав и описание') { els[i].click(); clicked = true; break; }
        }
      }
      var text = document.body ? document.body.innerText : '';
      var m = text.match(/(?:состав|ingredients|inci)\\s*[:：]?\\s*\\n*\\s*((?:aqua|water|вода|[a-zа-яё][^\\n]{2,60}),[^\\n]{20,3000})/i);
      if (m) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ title: document.title, text: m[1] }));
        return;
      }
    } catch (e) {}
    setTimeout(tick, 1000);
  }
  setTimeout(tick, 1200);
})();
true;
`;

/** Opens a Gold Apple / Letual product page for the user and reads its ingredient list from the rendered page. */
export function ShopPage({ url, onFound, onClose }: { url: string | null; onFound: (p: { title: string; text: string }) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [slow, setSlow] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    done.current = false;
    setSlow(false);
    if (!url) return;
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, [url]);
  return (
    <Modal visible={!!url} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.head, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="close" label="Закрыть" onPress={onClose} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Читаем состав товара</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {slow ? 'Если состав скрыт — откройте раздел «Состав» на странице' : 'Страница магазина откроется, а состав мы найдём сами'}
          </Text>
        </View>
        {!slow ? <ActivityIndicator color={colors.violet} /> : <Icon name="alert" size={18} color={colors.warn} />}
      </View>
      {url && (
        <WebView
          source={{ uri: url }}
          injectedJavaScript={FIND}
          onMessage={(e) => {
            if (done.current) return;
            try {
              const data = JSON.parse(e.nativeEvent.data) as { title: string; text: string };
              if (data.text) {
                done.current = true;
                onFound({ title: data.title.replace(/\s*[—|-]\s*(Золотое Яблоко|Gold Apple|Л'Этуаль|ЛЭТУАЛЬ|letu).*$/i, '').trim(), text: data.text });
              }
            } catch {
              // ignore malformed messages
            }
          }}
          style={{ flex: 1 }}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.gutter, paddingBottom: 10, backgroundColor: colors.bg, borderBottomWidth: 1, borderColor: colors.line },
  title: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
});
