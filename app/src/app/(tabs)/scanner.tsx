import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { OcrStatus, OcrWebView } from '../../components/OcrWebView';
import { Button, Press, tap } from '../../components/ui';
import { useLibrary } from '../../context/LibraryContext';
import { analyze, SAMPLES } from '../../lib/analyze';
import { nativeOcr, recognizeText } from '../../lib/ocr';

// Without the native module (Expo Go) photos are read by Tesseract inside a hidden WebView.
const webOcr = !nativeOcr && Platform.OS !== 'web';
import { colors, fonts, radius, space } from '../../theme';

type Mode = 'camera' | 'manual';

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const { saveScan } = useLibrary();

  const [mode, setMode] = useState<Mode>('camera');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrStatus>({ state: nativeOcr ? 'ready' : 'loading', progress: 0 });

  const finish = (raw: string, title?: string) => {
    const result = analyze(raw);
    if (!result.items.length) {
      setText(raw);
      setMode('manual');
      setNotice('Не удалось найти список ингредиентов. Проверьте текст и поправьте при необходимости.');
      return;
    }
    tap('success');
    const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const scan = saveScan({ title: title ?? `Состав от ${date}`, text: raw, overall: result.scores.overall });
    setText('');
    setNotice(null);
    router.push(`/analysis/${scan.id}`);
  };

  const readImage = async (uri: string) => {
    if (!nativeOcr && !webOcr) {
      setMode('manual');
      setNotice('В браузере распознавание фото недоступно — вставьте или введите состав вручную.');
      return;
    }
    setBusy(true);
    try {
      finish(await recognizeText(uri));
    } catch {
      setMode('manual');
      setNotice(
        ocr.state === 'error'
          ? 'Не удалось загрузить распознавание — нужен интернет при первом запуске. Пока введите состав вручную.'
          : 'Не получилось прочитать фото. Попробуйте ещё раз при хорошем освещении или введите состав вручную.',
      );
    } finally {
      setBusy(false);
    }
  };

  const shoot = async () => {
    if (!camera.current || busy) return;
    tap('medium');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) await readImage(photo.uri);
    } catch {
      setNotice('Камера недоступна. Выберите фото из галереи.');
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled && res.assets[0]) await readImage(res.assets[0].uri);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <StatusBar style="light" />
      {webOcr && <OcrWebView onStatus={setOcr} />}
      <View style={styles.head}>
        <Text style={styles.kicker}>Сканер составов</Text>
        <Text style={styles.title}>
          Что внутри <Text style={styles.titleSerif}>баночки?</Text>
        </Text>
      </View>

      <View style={styles.switch}>
        {(['camera', 'manual'] as Mode[]).map((m) => (
          <Press key={m} onPress={() => setMode(m)} style={[styles.switchItem, mode === m && styles.switchActive]}>
            <Icon name={m === 'camera' ? 'scan' : 'text'} size={16} color={mode === m ? colors.night : colors.nightMuted} />
            <Text style={[styles.switchText, mode === m && { color: colors.night }]}>{m === 'camera' ? 'Камера' : 'Текст'}</Text>
          </Press>
        ))}
      </View>

      {mode === 'camera' ? (
        <View style={{ flex: 1, paddingBottom: insets.bottom + 92 }}>
          <View style={styles.viewfinder}>
            {permission?.granted ? (
              focused && (
                <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
              )
            ) : (
              <View style={styles.permission}>
                <Icon name="scan" size={34} color={colors.gold} />
                <Text style={styles.permTitle}>Доступ к камере</Text>
                <Text style={styles.permText}>Сфотографируйте состав на упаковке — Essola разложит его по полочкам и оценит.</Text>
                <Button label="Разрешить" variant="light" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
              </View>
            )}
            <View pointerEvents="none" style={styles.frame}>
              {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                <View key={c} style={[styles.corner, styles[c]]} />
              ))}
            </View>
            {busy && (
              <View style={styles.busy}>
                <ActivityIndicator color={colors.nightInk} />
                <Text style={styles.busyText}>{ocr.state === 'loading' ? 'Загружаю распознавание…' : 'Читаю состав…'}</Text>
              </View>
            )}
          </View>
          {notice && mode === 'camera' && <Text style={styles.notice}>{notice}</Text>}
          <Text style={styles.hint}>
            {ocr.state === 'loading'
              ? `Готовлю распознавание текста… ${Math.round(ocr.progress * 100)}%`
              : 'Наведите камеру на список «Ingredients / Состав» и держите ровно'}
          </Text>
          <View style={styles.controls}>
            <Press onPress={pick} style={styles.sideBtn} accessibilityLabel="Выбрать фото">
              <Icon name="image" size={22} color={colors.nightInk} />
            </Press>
            <Press onPress={shoot} disabled={!permission?.granted || !ready || busy} style={styles.shutter} accessibilityLabel="Сделать снимок">
              <View style={styles.shutterInner} />
            </Press>
            <Press onPress={() => setMode('manual')} style={styles.sideBtn} accessibilityLabel="Ввести текст">
              <Icon name="text" size={22} color={colors.nightInk} />
            </Press>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 120, gap: 14 }} keyboardShouldPersistTaps="handled">
            {notice && <Text style={[styles.notice, { marginHorizontal: 0 }]}>{notice}</Text>}
            <View style={styles.inputCard}>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                placeholder={'Вставьте состав, например:\nAqua, Glycerin, Niacinamide, Squalane…'}
                placeholderTextColor={colors.nightMuted}
                style={styles.input}
                textAlignVertical="top"
              />
            </View>
            <Button label="Разобрать состав" icon="spark" variant="light" onPress={() => finish(text)} disabled={text.trim().length < 3} />
            <Text style={[styles.kicker, { marginTop: 12 }]}>Или попробуйте пример</Text>
            <View style={{ gap: 8 }}>
              {SAMPLES.map((s) => (
                <Press key={s.title} onPress={() => finish(s.text, s.title)} style={styles.sample}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.sampleTitle}>{s.title}</Text>
                    <Text style={styles.sampleText} numberOfLines={1}>
                      {s.text.replace(/^[^:]+:\s*/, '')}
                    </Text>
                  </View>
                  <Icon name="arrowRight" size={18} color={colors.nightMuted} />
                </Press>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const C = 26;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  head: { paddingHorizontal: space.gutter, gap: 8, paddingTop: 10 },
  kicker: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.nightMuted },
  title: { fontFamily: fonts.medium, fontSize: 32, letterSpacing: -1.2, color: colors.nightInk },
  titleSerif: { fontFamily: fonts.serif, fontSize: 36, color: '#E2B866' },
  switch: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginHorizontal: space.gutter,
    marginVertical: space.lg,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.nightCard,
    borderWidth: 1,
    borderColor: colors.nightLine,
  },
  switchItem: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 16, borderRadius: radius.pill },
  switchActive: { backgroundColor: colors.nightInk },
  switchText: { fontFamily: fonts.medium, fontSize: 13, color: colors.nightMuted },
  viewfinder: {
    flex: 1,
    marginHorizontal: space.gutter,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.nightCard,
    borderWidth: 1,
    borderColor: colors.nightLine,
  },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  permTitle: { fontFamily: fonts.medium, fontSize: 20, color: colors.nightInk, marginTop: 6 },
  permText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.nightMuted, textAlign: 'center', marginBottom: 10 },
  frame: { ...StyleSheet.absoluteFill, margin: 22 },
  corner: { position: 'absolute', width: C, height: C, borderColor: '#E2B866' },
  tl: { top: 0, left: 0, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: 12 },
  busy: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(21,19,15,0.7)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  busyText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.nightInk },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.nightMuted, textAlign: 'center', marginTop: 14, paddingHorizontal: 40 },
  notice: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: '#E9D3A8',
    backgroundColor: 'rgba(211,162,76,0.12)',
    borderRadius: radius.md,
    padding: 12,
    marginHorizontal: space.gutter,
    marginTop: 12,
  },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, marginTop: 14 },
  sideBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.nightCard, borderWidth: 1, borderColor: colors.nightLine, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 74, height: 74, borderRadius: 37, borderWidth: 2, borderColor: colors.nightInk, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.nightInk },
  inputCard: { backgroundColor: colors.nightCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.nightLine, padding: 16, minHeight: 200 },
  input: { flex: 1, minHeight: 170, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.nightInk },
  sample: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.nightCard,
    borderWidth: 1,
    borderColor: colors.nightLine,
  },
  sampleTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.nightInk },
  sampleText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.nightMuted },
});
