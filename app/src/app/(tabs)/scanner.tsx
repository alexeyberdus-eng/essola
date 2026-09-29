import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { OcrStatus, OcrWebView } from '../../components/OcrWebView';
import { Button, IconButton, Press, T, tap } from '../../components/ui';
import { useLibrary } from '../../context/LibraryContext';
import { analyze, SAMPLES } from '../../lib/analyze';
import { nativeOcr, recognizeText } from '../../lib/ocr';
import { colors, fonts, radius, space } from '../../theme';

// Without the native module (Expo Go) photos are read by Tesseract inside a hidden WebView.
const webOcr = !nativeOcr && Platform.OS !== 'web';

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const { saveScan } = useLibrary();

  const [manual, setManual] = useState(false);
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrStatus>({ state: nativeOcr ? 'ready' : 'loading', progress: 0 });

  const close = () => router.navigate('/');

  const finish = (raw: string, title?: string) => {
    const result = analyze(raw);
    if (!result.items.length) {
      setText(raw);
      setManual(true);
      setNotice('Не удалось найти список ингредиентов. Проверьте текст и поправьте при необходимости.');
      return;
    }
    tap('success');
    const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const scan = saveScan({ title: title ?? `Состав от ${date}`, text: raw, overall: result.scores.overall });
    setText('');
    setNotice(null);
    setManual(false);
    router.push(`/analysis/${scan.id}`);
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

  const engine = webOcr && <OcrWebView onStatus={setOcr} />;

  if (manual) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="dark" />
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

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {engine}
      {permission?.granted ? (
        focused && <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.permission]}>
          <Icon name="scan" size={36} color={colors.honey} />
          <Text style={styles.permTitle}>Нужен доступ к камере</Text>
          <Text style={styles.permText}>Сфотографируйте состав на упаковке — Essola разберёт каждый компонент и оценит формулу.</Text>
          <Button label="Разрешить камеру" onPress={requestPermission} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      )}

      {permission?.granted && (
        <View pointerEvents="none" style={[styles.frame, { top: insets.top + 90 }]}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c]]} />
          ))}
        </View>
      )}

      <View style={[styles.camTop, { top: insets.top + 10 }]}>
        <Press onPress={close} style={styles.camBtn} accessibilityLabel="Закрыть">
          <Icon name="close" size={18} color="#fff" />
        </Press>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{ocr.state === 'loading' && webOcr ? `Готовлю распознавание ${Math.round(ocr.progress * 100)}%` : 'Состав · текст'}</Text>
        </View>
        <Press onPress={() => setTorch((t) => !t)} style={[styles.camBtn, torch && { backgroundColor: colors.honey }]} accessibilityLabel="Фонарик">
          <Icon name="bolt" size={18} color={torch ? colors.ink : '#fff'} />
        </Press>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.grab} />
        {busy ? (
          <View style={styles.live}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.liveText}>{ocr.state === 'loading' ? 'Загружаю распознавание…' : 'Читаю состав…'}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sheetTitle}>Наведите на список «Ingredients»</Text>
            <Text style={styles.sheetText}>Держите телефон ровно, чтобы весь состав попал в рамку.</Text>
          </>
        )}
        {notice && <Text style={[styles.notice, { marginTop: 12 }]}>{notice}</Text>}
        <View style={styles.controls}>
          <Press onPress={pick} style={styles.square} accessibilityLabel="Фото из галереи">
            <Icon name="image" size={21} />
          </Press>
          <Button label="Сфотографировать" icon="scan" onPress={shoot} disabled={!permission?.granted || !ready || busy} style={{ flex: 1 }} />
          <Press onPress={() => setManual(true)} style={styles.square} accessibilityLabel="Ввести текстом">
            <Icon name="text" size={21} />
          </Press>
        </View>
      </View>
    </View>
  );
}

const C = 30;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  permission: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 36, paddingBottom: 260 },
  permTitle: { fontFamily: fonts.semibold, fontSize: 20, color: '#fff', marginTop: 8 },
  permText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: '#B9B2A3', textAlign: 'center' },
  frame: { position: 'absolute', left: 28, right: 28, bottom: 300 },
  corner: { position: 'absolute', width: C, height: C, borderColor: colors.honey },
  tl: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 12 },
  camTop: { position: 'absolute', left: space.gutter, right: space.gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  camBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  pill: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9 },
  pillText: { fontFamily: fonts.medium, fontSize: 12.5, color: '#fff' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: space.gutter,
    paddingTop: 10,
  },
  grab: { width: 38, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.3, color: colors.ink },
  sheetText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.muted, marginTop: 4 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44 },
  liveText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  square: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: '#6B4E00', backgroundColor: colors.honeySoft, borderRadius: radius.md, padding: 12 },
  manualTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 6 },
  manualTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  inputCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, minHeight: 190 },
  input: { flex: 1, minHeight: 160, fontFamily: fonts.mono, fontSize: 14, lineHeight: 21, color: colors.ink },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line },
  sampleTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  sampleText: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
});
