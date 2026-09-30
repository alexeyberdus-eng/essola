import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Glass, LightWave } from '../../components/lab';
import { OcrStatus, OcrWebView } from '../../components/OcrWebView';
import { Breathe, Glow } from '../../components/silk';
import { Button, IconButton, Press, T, tap } from '../../components/ui';
import { useLibrary } from '../../context/LibraryContext';
import { useUserContent } from '../../context/UserContentContext';
import { analyze, SAMPLES } from '../../lib/analyze';
import { lookupBarcode } from '../../lib/barcode';
import { nativeOcr, recognizeText } from '../../lib/ocr';
import { colors, fonts, radius, shadow, space } from '../../theme';

// Without the native module (Expo Go) photos are read by Tesseract inside a hidden WebView.
const webOcr = !nativeOcr && Platform.OS !== 'web';
const native = Platform.OS !== 'web';

type Mode = 'barcode' | 'label';
type Lookup = { code: string; state: 'searching' | 'missing' } | null;

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const { saveScan } = useLibrary();
  const { barcodes, rememberBarcode } = useUserContent();

  const [mode, setMode] = useState<Mode>('barcode');
  const [manual, setManual] = useState(false);
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>(null);
  const [wave, setWave] = useState(0);
  const pendingCode = useRef<string | null>(null);
  const scanning = useRef(false);
  const [ocr, setOcr] = useState<OcrStatus>({ state: nativeOcr ? 'ready' : 'loading', progress: 0 });

  const laser = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(laser, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(laser, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [laser]);

  const close = () => router.navigate('/');

  const finish = (raw: string, title?: string, meta?: { barcode?: string; source?: string }) => {
    const result = analyze(raw);
    if (!result.items.length || result.unreadable) {
      setText(raw);
      setManual(true);
      setNotice(
        result.recognised === 0
          ? 'В кадре нет списка ингредиентов — похоже, это инструкция или адрес производителя. Найдите на упаковке блок «Состав» или «Ingredients» (обычно мелкий шрифт, слова через запятую) и снимите только его, крупно.'
          : 'Фото прочиталось неточно — проверьте текст ниже и поправьте ошибки. Или переснимите ближе, ровно и при хорошем свете.',
      );
      return;
    }
    tap('success');
    const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const code = meta?.barcode ?? pendingCode.current ?? undefined;
    const name = title ?? `Состав от ${date}`;
    if (code && !meta?.source) rememberBarcode(code, name, raw);
    const scan = saveScan({ title: name, text: raw, overall: result.scores.overall, barcode: code, source: meta?.source });
    pendingCode.current = null;
    setText('');
    setNotice(null);
    setManual(false);
    setLookup(null);
    router.push(`/analysis/${scan.id}`);
  };

  const onBarcode = async ({ data }: BarcodeScanningResult) => {
    if (scanning.current || mode !== 'barcode' || lookup) return;
    scanning.current = true;
    tap('success');
    setWave((w) => w + 1);
    setNotice(null);
    setLookup({ code: data, state: 'searching' });
    const known = barcodes[data];
    const found = known ? { title: known.title, text: known.text, source: 'база Essola' } : await lookupBarcode(data);
    if (found) {
      finish(found.text, found.title, { barcode: data, source: found.source });
    } else {
      pendingCode.current = data;
      setLookup({ code: data, state: 'missing' });
    }
    setTimeout(() => (scanning.current = false), 800);
  };

  const readImage = async (uri: string) => {
    if (!nativeOcr && !webOcr) {
      setManual(true);
      setNotice('В браузере распознавание фото недоступно — вставьте состав текстом.');
      return;
    }
    setBusy(true);
    try {
      finish(await recognizeText(uri));
    } catch {
      setManual(true);
      setNotice(
        ocr.state === 'error'
          ? 'Не удалось загрузить распознавание — при первом запуске нужен интернет. Пока вставьте состав текстом.'
          : 'Не получилось прочитать фото. Снимите ближе при хорошем свете или вставьте состав текстом.',
      );
    } finally {
      setBusy(false);
    }
  };

  const shoot = async () => {
    if (!camera.current || busy) return;
    tap('medium');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.95 });
      if (photo?.uri) await readImage(photo.uri);
    } catch {
      setNotice('Камера недоступна. Выберите фото из галереи.');
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true });
    if (!res.canceled && res.assets[0]) await readImage(res.assets[0].uri);
  };

  const switchMode = (m: Mode) => {
    tap();
    setMode(m);
    setNotice(null);
    if (m === 'barcode') {
      setLookup(null);
      pendingCode.current = null;
    }
  };

  const engine = webOcr && <OcrWebView onStatus={setOcr} />;

  if (manual) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="dark" />
        <Glow flask={false} />
        {engine}
        <View style={[styles.manualTop, { paddingTop: insets.top + 8 }]}>
          <IconButton
            icon="arrowLeft"
            label="К камере"
            onPress={() => {
              setManual(false);
              setNotice(null);
            }}
          />
          <Text style={styles.manualTitle}>Состав текстом</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: insets.bottom + 40, gap: 14 }} keyboardShouldPersistTaps="handled">
          {notice && <Text style={styles.notice}>{notice}</Text>}
          <View style={styles.inputCard}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder={'Вставьте или введите состав:\nAqua, Glycerin, Niacinamide…'}
              placeholderTextColor={colors.faint}
              style={styles.input}
              textAlignVertical="top"
            />
          </View>
          <Button label="Разобрать состав" icon="spark" onPress={() => finish(text)} disabled={text.trim().length < 3} />
          <T v="label" style={{ marginTop: 14 }}>
            Или попробуйте пример
          </T>
          {SAMPLES.map((s) => (
            <Press key={s.title} onPress={() => finish(s.text, s.title)} style={styles.sample}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.sampleTitle}>{s.title}</Text>
                <Text style={styles.sampleText} numberOfLines={1}>
                  {s.text.replace(/^[^:]+:\s*/, '')}
                </Text>
              </View>
              <Icon name="arrowRight" size={17} color={colors.muted} />
            </Press>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const barcode = mode === 'barcode';
  const frameTop = insets.top + (barcode ? 190 : 100);
  const frameH = barcode ? 150 : undefined;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {engine}
      {permission?.granted ? (
        focused && (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            onCameraReady={() => setReady(true)}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={barcode && !lookup ? onBarcode : undefined}
          />
        )
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.permission]}>
          <Icon name="barcode" size={40} color={colors.brassLight} />
          <Text style={styles.permTitle}>Нужен доступ к камере</Text>
          <Text style={styles.permText}>Отсканируйте штрихкод или сфотографируйте состав — Essola разберёт каждый компонент и подберёт аналоги.</Text>
          <Button label="Разрешить камеру" onPress={requestPermission} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      )}

      {permission?.granted && (
        <View pointerEvents="none" style={[styles.frame, { top: frameTop }, frameH ? { height: frameH } : { bottom: 330 }]}>
          <Breathe amount={0.025} style={StyleSheet.absoluteFill}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, styles[c], lookup && { borderColor: '#B9C9A6' }]} />
            ))}
          </Breathe>
          {barcode && !lookup && (
            <Animated.View style={[styles.laser, { transform: [{ translateY: laser.interpolate({ inputRange: [0, 1], outputRange: [16, (frameH ?? 150) - 18] }) }] }]} />
          )}
          <LightWave trigger={wave} />
        </View>
      )}

      <View style={[styles.camTop, { top: insets.top + 10 }]}>
        <Press onPress={close} style={styles.camBtn} accessibilityLabel="Закрыть">
          <Icon name="arrowLeft" size={18} color="#fff" />
        </Press>
        <Glass style={styles.modes} tint="rgba(20,20,15,0.35)" intensity={30}>
          <View style={{ flexDirection: 'row', padding: 4 }}>
            {(
              [
                ['barcode', 'Штрихкод'],
                ['label', 'Состав'],
              ] as const
            ).map(([k, l]) => (
              <Press key={k} haptic={false} onPress={() => switchMode(k)} style={[styles.mode, mode === k && styles.modeOn]}>
                <Text style={[styles.modeText, mode === k && { color: colors.olive }]}>{l}</Text>
              </Press>
            ))}
          </View>
        </Glass>
        <Press onPress={() => setTorch((t) => !t)} style={[styles.camBtn, torch && { backgroundColor: colors.brassLight }]} accessibilityLabel="Фонарик">
          <Icon name="torch" size={18} color={torch ? colors.olive : '#fff'} />
        </Press>
      </View>

      {lookup && barcode && (
        <View style={[styles.code, { top: frameTop + (frameH ?? 0) + 14 }]}>
          <View style={styles.codeDot} />
          <Text style={styles.codeText}>{lookup.code.replace(/(\d)(\d{6})(\d{6})/, '$1 $2 $3')}</Text>
        </View>
      )}

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.grab} />
        {lookup ? (
          <View>
            <View style={styles.live}>
              {lookup.state === 'searching' ? <ActivityIndicator color={colors.sageDeep} /> : <Icon name="alert" size={20} color={colors.brassText} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{lookup.state === 'searching' ? 'Ищем в открытых базах' : 'В базах этого товара нет'}</Text>
                <Text style={styles.mono}>Open Beauty Facts · база Essola</Text>
              </View>
            </View>
            <View style={styles.steps}>
              <Step ok text="Штрихкод распознан" />
              {lookup.state === 'searching' ? (
                <Text style={styles.stepNow}>Поиск состава…</Text>
              ) : (
                <Text style={styles.stepText}>Сфотографируйте состав на упаковке — мы разберём его и запомним за этим штрихкодом.</Text>
              )}
            </View>
            {lookup.state === 'missing' && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Button label="Снять состав" icon="camera" onPress={() => setMode('label')} style={{ flex: 1 }} />
                <Press onPress={() => switchMode('barcode')} style={styles.square} accessibilityLabel="Сканировать снова">
                  <Icon name="barcode" size={21} />
                </Press>
              </View>
            )}
            {lookup.state === 'missing' && mode === 'label' && (
              <Text style={[styles.sheetText, { marginTop: 10 }]}>Наведите на «Состав» и нажмите кнопку ниже.</Text>
            )}
          </View>
        ) : busy ? (
          <View style={styles.live}>
            <ActivityIndicator color={colors.sageDeep} />
            <Text style={styles.liveText}>{ocr.state === 'loading' ? 'Загружаю распознавание…' : 'Читаю состав…'}</Text>
          </View>
        ) : barcode ? (
          <>
            <Text style={styles.sheetTitle}>Наведите на штрихкод</Text>
            <Text style={styles.sheetText}>Найдём состав в открытых базах, разберём его и подберём аналоги. Нет штрихкода — переключитесь на «Состав».</Text>
          </>
        ) : (
          <>
            <Text style={styles.sheetTitle}>Наведите на «Состав» или «Ingredients»</Text>
            <Text style={styles.sheetText}>
              {ocr.state === 'loading' && webOcr ? `Готовлю распознавание ${Math.round(ocr.progress * 100)}% · ` : ''}Читаем русский и латиницу. Снимайте только блок состава, крупно и ровно.
            </Text>
          </>
        )}
        {notice && <Text style={[styles.notice, { marginTop: 12 }]}>{notice}</Text>}
        {(!lookup || (lookup.state === 'missing' && mode === 'label')) && (
          <View style={styles.controls}>
            <Press onPress={pick} style={styles.square} accessibilityLabel="Фото из галереи">
              <Icon name="image" size={21} />
            </Press>
            {mode === 'label' ? (
              <Press onPress={shoot} disabled={!permission?.granted || !ready || busy} style={styles.shutter} accessibilityLabel="Сфотографировать">
                <View style={styles.shutterIn} />
              </Press>
            ) : (
              <View style={styles.shutterGhost}>
                <Icon name="barcode" size={26} color={colors.sageDeep} />
              </View>
            )}
            <Press onPress={() => setManual(true)} style={styles.square} accessibilityLabel="Ввести текстом">
              <Icon name="text" size={21} />
            </Press>
          </View>
        )}
      </View>
    </View>
  );
}

function Step({ ok, text }: { ok?: boolean; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name="check" size={14} color={colors.good} strokeWidth={2.2} />
      <Text style={[styles.stepText, ok && { color: colors.good }]}>{text}</Text>
    </View>
  );
}

const C = 30;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  permission: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 36, paddingBottom: 260 },
  permTitle: { fontFamily: fonts.display, fontSize: 21, color: '#fff', marginTop: 8 },
  permText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: '#B9B2A3', textAlign: 'center' },
  frame: { position: 'absolute', left: 40, right: 40, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: C, height: C, borderColor: colors.brassLight },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  laser: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.brassLight,
    ...Platform.select({ ios: { shadowColor: colors.brassLight, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }, default: { boxShadow: '0 0 12px 3px rgba(216,188,134,.9)' } }),
  },
  camTop: { position: 'absolute', left: space.gutter, right: space.gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  camBtn: { width: 42, height: 42, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  modes: { borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  mode: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 11 },
  modeOn: { backgroundColor: '#FBF8F2' },
  modeText: { fontFamily: fonts.semibold, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  code: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.55)' },
  codeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8FD19E' },
  codeText: { fontFamily: fonts.monoMedium, fontSize: 12.5, letterSpacing: 1, color: '#fff' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: space.gutter,
    paddingTop: 10,
  },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D3CABB', alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 18, letterSpacing: -0.4, color: colors.ink },
  sheetText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.muted, marginTop: 4 },
  mono: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted, marginTop: 2 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  liveText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  steps: { marginTop: 12, gap: 7 },
  stepText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  stepNow: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 16 },
  square: { width: 52, height: 52, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: colors.olive, padding: 5 },
  shutterIn: { flex: 1, borderRadius: 34, backgroundColor: colors.olive },
  shutterGhost: { width: 76, height: 76, borderRadius: 38, borderWidth: 1.5, borderColor: '#CFC6B5', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  notice: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.brassText, backgroundColor: colors.brassSoft, borderRadius: radius.md, padding: 12 },
  manualTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 6 },
  manualTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  inputCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', padding: 16, minHeight: 190, ...shadow },
  input: { flex: 1, minHeight: 160, fontFamily: fonts.mono, fontSize: 14, lineHeight: 21, color: colors.ink },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line },
  sampleTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  sampleText: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
});
