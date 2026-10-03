import { ReactNode, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';
import { Press, tap } from './ui';

/** iOS "share" glyph: a square with an arrow up. */
function ShareGlyph({ size = 16, color = '#0A84FF' }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size + 3, alignItems: 'center' }}>
      <View style={{ width: 2, height: size * 0.6, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', top: -1, width: size * 0.42, height: size * 0.42, borderLeftWidth: 2, borderTopWidth: 2, borderColor: color, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', bottom: 0, width: size, height: size * 0.62, borderWidth: 2, borderTopWidth: 0, borderColor: color, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
    </View>
  );
}

/** A small drawn iPhone screen for the step-by-step guide. */
function Phone({ children }: { children: ReactNode }) {
  return (
    <View style={styles.phone}>
      <View style={styles.notch} />
      <View style={styles.screen}>{children}</View>
    </View>
  );
}

const Ring = ({ children }: { children: ReactNode }) => <View style={styles.ring}>{children}</View>;

function ShopScreen({ app }: { app: boolean }) {
  return (
    <Phone>
      {!app && (
        <View style={styles.url}>
          <Text style={styles.urlText}>letu.ru/product/…</Text>
        </View>
      )}
      <View style={styles.photo} />
      <View style={[styles.line, { width: '80%' }]} />
      <View style={[styles.line, { width: '55%' }]} />
      <View style={{ flex: 1 }} />
      <View style={styles.toolbar}>
        {app ? <Text style={styles.small}>♡</Text> : <Text style={styles.small}>‹ ›</Text>}
        <Ring>
          <ShareGlyph />
        </Ring>
        <Text style={styles.small}>{app ? 'В корзину' : '☐'}</Text>
      </View>
    </Phone>
  );
}

function ShareSheet() {
  return (
    <Phone>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }} />
      <View style={styles.sheet}>
        <View style={styles.apps}>
          {['#34C759', '#0A84FF', '#FF9500', '#AF52DE'].map((c) => (
            <View key={c} style={[styles.appIcon, { backgroundColor: c }]} />
          ))}
        </View>
        <Ring>
          <View style={styles.action}>
            <Text style={styles.actionText}>Скопировать</Text>
            <Text style={styles.actionIcon}>⧉</Text>
          </View>
        </Ring>
        <View style={[styles.action, { opacity: 0.5 }]}>
          <Text style={styles.actionText}>В избранное</Text>
        </View>
      </View>
    </Phone>
  );
}

function EssolaScreen() {
  return (
    <Phone>
      <View style={{ height: 118, backgroundColor: '#16121F', borderRadius: 8 }} />
      <View style={{ height: 6 }} />
      <Ring>
        <View style={styles.essolaBtn}>
          <Icon name="external" size={10} color={colors.violet} />
          <Text style={styles.essolaText}>Вставить ссылку</Text>
        </View>
      </Ring>
    </Phone>
  );
}

const STEPS_APP: [string, ReactNode][] = [
  ['Откройте товар в приложении Летуаль и нажмите «Поделиться»', <ShopScreen key="a" app />],
  ['В появившемся меню выберите «Скопировать» или «Скопировать ссылку»', <ShareSheet key="b" />],
  ['Вернитесь в essola, откройте сканер и нажмите «Вставить ссылку» — остальное сделаем сами', <EssolaScreen key="c" />],
];
const STEPS_SAFARI: [string, ReactNode][] = [
  ['На странице товара в Safari нажмите «Поделиться» внизу экрана (или нажмите и подержите адресную строку)', <ShopScreen key="d" app={false} />],
  ['Выберите «Скопировать»', <ShareSheet key="e" />],
  ['В essola: сканер → «Вставить ссылку»', <EssolaScreen key="f" />],
];

/** Tappable hint under the scanner: how to copy a product link on iPhone, with drawn screens. */
export function LinkHelp() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'app' | 'safari'>('app');
  const steps = tab === 'app' ? STEPS_APP : STEPS_SAFARI;
  return (
    <>
      <Press haptic={false} onPress={() => { tap(); setOpen(true); }} style={styles.hint}>
        <Icon name="spark" size={14} color={colors.violet} />
        <Text style={styles.hintText}>Как скопировать ссылку на товар? Показать</Text>
      </Press>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.head}>
            <Text style={styles.title}>Проверка по ссылке</Text>
            <Press onPress={() => setOpen(false)} style={styles.close} accessibilityLabel="Закрыть">
              <Icon name="close" size={18} color={colors.ink} />
            </Press>
          </View>
          <Text style={styles.lead}>Скопируйте ссылку на товар из Летуаль — мы сами найдём состав и оценим его.</Text>
          <View style={styles.seg}>
            {(
              [
                ['app', 'Из приложения магазина'],
                ['safari', 'Из браузера'],
              ] as const
            ).map(([k, l]) => (
              <Press key={k} haptic={false} onPress={() => setTab(k)} style={[styles.segItem, tab === k && styles.segOn]}>
                <Text style={[styles.segText, tab === k && { color: '#fff' }]}>{l}</Text>
              </Press>
            ))}
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30, gap: 14 }}>
            {steps.map(([text, pic], i) => (
              <View key={i} style={styles.step}>
                {pic}
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.num}>
                    <Text style={styles.numText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{text}</Text>
                </View>
              </View>
            ))}
            <View style={styles.tip}>
              <Text style={styles.tipTitle}>Товар из другого магазина?</Text>
              <Text style={styles.tipText}>Сделайте скриншот блока «Состав» на странице товара и загрузите его в сканере кнопкой «Галерея» — прочитаем по фото.</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 6 },
  hintText: { fontFamily: fonts.medium, fontSize: 13, color: colors.violet, textDecorationLine: 'underline' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 6 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  close: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', alignItems: 'center', justifyContent: 'center' },
  lead: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2, paddingHorizontal: 16 },
  seg: { flexDirection: 'row', height: 42, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', padding: 4, marginHorizontal: 16, marginTop: 12 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  step: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 12, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6F7' },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.semibold, fontSize: 13, color: '#fff' },
  stepText: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  tip: { padding: 14, borderRadius: 18, backgroundColor: '#F4F0FF', gap: 4 },
  tipTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  tipText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
  phone: { width: 104, height: 196, borderRadius: 22, backgroundColor: '#1C1C1E', padding: 5 },
  notch: { position: 'absolute', top: 9, alignSelf: 'center', width: 34, height: 9, borderRadius: 5, backgroundColor: '#000', zIndex: 2 },
  screen: { flex: 1, borderRadius: 18, backgroundColor: '#F7F7F9', overflow: 'hidden', padding: 6, paddingTop: 20 },
  url: { height: 14, borderRadius: 5, backgroundColor: '#E6E6EB', justifyContent: 'center', paddingHorizontal: 4, marginBottom: 5 },
  urlText: { fontSize: 6.5, color: '#555' },
  photo: { height: 70, borderRadius: 8, backgroundColor: '#E9E2FF' },
  line: { height: 6, borderRadius: 3, backgroundColor: '#DCDCE3', marginTop: 6 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', height: 26, borderTopWidth: 1, borderColor: '#E5E5EA' },
  small: { fontSize: 8, color: '#777' },
  ring: { borderWidth: 2, borderColor: '#FF3B30', borderRadius: 10, padding: 2 },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 6, gap: 5 },
  apps: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  appIcon: { width: 16, height: 16, borderRadius: 5 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 18, borderRadius: 6, backgroundColor: '#F2F2F7', paddingHorizontal: 5 },
  actionText: { fontSize: 7.5, color: '#111', fontWeight: '600' },
  actionIcon: { fontSize: 8, color: '#111' },
  essolaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 20, borderRadius: 7, backgroundColor: '#F1EDFF' },
  essolaText: { fontSize: 7.5, color: colors.violet, fontWeight: '600' },
});
