import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { Hint } from '../../components/Hint';
import * as ImagePicker from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
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
import * as Clipboard from 'expo-clipboard';
import { aiEnabled, aiScan, barcodeWeb, catalogPage, CatalogItem, productByBarcode, productByLink, saveBarcode, saveProduct, SHOP_LINK } from '../../lib/ai';
import { LinkHelp } from '../../components/LinkHelp';
import { ShopPage } from '../../components/ShopPage';
import { ScoreBadge } from '../../components/ScoreBadge';
import { detectNotCosmetic, NOT_COSMETIC_TEXT } from '../../lib/kind';
import { nativeOcr, recognizeText, toJpegBase64 } from '../../lib/ocr';
import { colors, fonts, radius, scoreColor, shadow, space } from '../../theme';

// Without the native module (Expo Go) photos are read by Tesseract inside a hidden WebView.
const webOcr = !nativeOcr && Platform.OS !== 'web';
const native = Platform.OS !== 'web';

type Mode = 'barcode' | 'label';
type Lookup = { code: string; state: 'searching' | 'missing'; name?: string | null } | null;

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const { saveScan, scans } = useLibrary();
  const { height: winH } = useWindowDimensions();
  // The camera opens on the top half with the scan history below; it can be expanded to full screen.
  const [full, setFull] = useState(false);
  const { barcodes, rememberBarcode } = useUserContent();

  const [mode, setMode] = useState<Mode>('label');
  const [manual, setManual] = useState(false);
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>(null);
  const [wave, setWave] = useState(0);
  const pendingCode = useRef<string | null>(null);
  const pendingName = useRef<string | null>(null);
  const scanning = useRef(false);
  // A barcode noticed while in «Состав» mode: offered as a chip instead of interrupting the photo.
  const [seen, setSeen] = useState<string | null>(null);
  // Products from our base that may be the scanned one (barcode unknown, name known or typed).
  const [matches, setMatches] = useState<CatalogItem[] | null>(null);
  const [findQ, setFindQ] = useState('');
  const [finding, setFinding] = useState(false);
  // Close-ups go blurry on phones whose main lens can't focus near: step back and zoom in instead.
  const [zoom, setZoom] = useState(0);
  const [focus, setFocus] = useState<'on' | 'off'>('off');
  const refocus = () => {
    setFocus('on');
    setTimeout(() => setFocus('off'), 250);
  };
  const [digits, setDigits] = useState('');
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

  const finish = (raw: string, title?: string, meta?: { barcode?: string; source?: string }, force = false) => {
    // Household chemicals and food get a clear message instead of a cosmetics score.
    const odd = raw.startsWith('NOT_COSMETIC:')
      ? detectNotCosmetic(raw) ?? { kind: /еда|пищ|продукт пит|food/i.test(raw) ? ('food' as const) : ('household' as const), label: '' }
      : detectNotCosmetic(raw) ?? (meta?.source === 'Open Food Facts' ? { kind: 'food' as const, label: '' } : null);
    if (odd) {
      tap('light');
      setManual(false);
      setLookup(null);
      pendingCode.current = null;
      setNotice(NOT_COSMETIC_TEXT[odd.kind]);
      return;
    }
    const result = analyze(raw);
    // A manual "Разобрать" goes through whenever anything was recognised; only photos get bounced back.
    if (!result.items.length || (result.unreadable && !force)) {
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
    const next = Math.max(0, ...scans.map((x) => Number(x.title.match(/^Состав №(\d+)/)?.[1] ?? 0))) + 1;
    const name = title ?? pendingName.current ?? `Состав №${next}`;
    if (code && !meta?.source) {
      rememberBarcode(code, name, raw);
      saveBarcode(code, name, splitList(raw));
    }
    const scan = saveScan({ title: name, text: raw, overall: result.scores.overall, barcode: code, source: meta?.source });
    pendingCode.current = null;
    pendingName.current = null;
    setText('');
    setNotice(null);
    setManual(false);
    setLookup(null);
    router.push(`/analysis/${scan.id}`);
  };

  const onBarcode = ({ data }: BarcodeScanningResult) => {
    if (scanning.current || lookup || busy) return;
    if (mode === 'barcode') lookupCode(data);
    else if (seen !== data) setSeen(data);
  };

  const findByName = async (q: string) => {
    if (q.trim().length < 2) return;
    setFinding(true);
    const res = await catalogPage(q.trim(), undefined, 'relevance', 1);
    setMatches((res?.items ?? []).filter((x) => x.x).slice(0, 5));
    setFinding(false);
  };

  const pickMatch = (item: CatalogItem) => {
    tap('success');
    const code = lookup?.code ?? pendingCode.current;
    const text = `Состав: ${item.x}`;
    const title = [item.b, item.t].filter(Boolean).join(' ');
    if (code) {
      rememberBarcode(code, title, text);
      saveBarcode(code, title, splitList(item.x));
    }
    setMatches(null);
    setFindQ('');
    finish(text, title, { barcode: code ?? undefined, source: 'база essola' }, true);
  };

  const lookupCode = async (data: string) => {
    if (scanning.current) return;
    scanning.current = true;
    setSeen(null);
    setMatches(null);
    tap('success');
    setWave((w) => w + 1);
    setNotice(null);
    setLookup({ code: data, state: 'searching' });
    const known = barcodes[data];
    const shared = known ? null : await productByBarcode(data);
    const res = known
      ? { product: { title: known.title, text: known.text, source: 'база Essola' }, name: known.title }
      : shared
        ? { product: { title: shared.title ?? 'Средство', text: `Ingredients: ${shared.ingredients.join(', ')}`, source: 'база Essola' }, name: shared.title ?? null }
        : await lookupBarcode(data);
    const found = res.product;
    if (found) {
      finish(found.text, found.title, { barcode: data, source: found.source });
    } else {
      pendingCode.current = data;
      pendingName.current = res.name;
      setLookup({ code: data, state: 'missing', name: res.name });
      if (res.name) {
        setFindQ(res.name);
        findByName(res.name);
      } else {
        // Not in the open databases: look the code up on the web (marketplaces, shops, barcode catalogs).
        barcodeWeb(data).then((w) => {
          if (!w?.name) return;
          pendingName.current = w.name;
          setLookup((l) => (l && l.code === data ? { ...l, name: w.name } : l));
          setFindQ(w.name);
          findByName(w.name);
        });
      }
    }
    setTimeout(() => (scanning.current = false), 800);
  };

  // A Gold Apple / Letual link copied from the shop app: offer to check it right away.
  const [clip, setClip] = useState<string | null>(null);
  const [shop, setShop] = useState<string | null>(null);
  useEffect(() => {
    if (!focused || !aiEnabled) return;
    Clipboard.hasUrlAsync?.()
      .then((has) => (has ? Clipboard.getUrlAsync() : Clipboard.getStringAsync()))
      .then((t) => setClip(t?.match(SHOP_LINK)?.[0] ?? null))
      .catch(() => {});
  }, [focused]);

  const checkLink = async (url: string) => {
    setClip(null);
    setBusy(true);
    setNotice(null);
    try {
      const { product } = await productByLink(url).catch(() => ({ product: null }));
      if (!product?.ingredients?.length) {
        // Not in our base yet: open the page in the app and read it there.
        setBusy(false);
        setShop(url);
        return;
      }
      setBusy(false);
      finish(`Состав: ${product.ingredients.join(', ')}`, product.title ?? undefined, { source: product.source }, true);
    } catch {
      setNotice('Не получилось открыть ссылку — проверьте интернет.');
      setBusy(false);
    }
  };

  const pasteLink = async () => {
    const t = (await Clipboard.getStringAsync().catch(() => '')) ?? '';
    const url = t.match(SHOP_LINK)?.[0];
    if (url) checkLink(url);
    else setNotice('Скопируйте ссылку на товар в приложении или на сайте Золотого Яблока или Летуаль и нажмите «Ссылка» ещё раз.');
  };

  const readImage = async (uri: string) => {
    if (aiEnabled) {
      // AI path: photo → clean list → straight to the result. No text editor step.
      setBusy(true);
      setNotice(null);
      try {
        const { ingredients: list, notCosmetic } = await aiScan(await toJpegBase64(uri), pendingCode.current, pendingName.current);
        if (notCosmetic) return finish(`NOT_COSMETIC: ${notCosmetic}`);
        if (!list.length || !analyze(list.join(', ')).items.length) throw new Error('EMPTY');
        finish(`Состав: ${list.join(', ')}`, undefined, undefined, true);
      } catch (e) {
        setNotice(
          String(e).includes('EMPTY')
            ? 'Не нашли на фото список ингредиентов. Снимите блок «Состав» крупнее и ровнее.'
            : `Не получилось прочитать фото — проверьте интернет и попробуйте ещё раз. (${String(e).slice(0, 60)})`,
        );
      } finally {
        setBusy(false);
      }
      return;
    }
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
          <Button label="Разобрать состав" icon="spark" onPress={() => finish(text, undefined, undefined, true)} disabled={text.trim().length < 3} />
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
  const frameTop = insets.top + (full ? (barcode ? 190 : 100) : barcode ? 96 : 66);
  const frameH = barcode ? (full ? 150 : 120) : undefined;
  const camH = full ? winH : Math.round(winH * 0.52);

  const sheet = (
      <View style={[full ? styles.sheet : styles.sheetInline, full && { paddingBottom: insets.bottom + 18 }]}>
        {full && <View style={styles.grab} />}
        {!full && <Hint id="scanner" title="Как сканировать" text="Сфотографируйте блок «Состав» на упаковке крупно и ровно — оценим за пару секунд. Можно отсканировать штрихкод или вставить ссылку на товар." />}
        {lookup ? (
          <View>
            <View style={styles.live}>
              {lookup.state === 'searching' ? <ActivityIndicator color={colors.sageDeep} /> : <Icon name="alert" size={20} color={colors.brassText} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{lookup.state === 'searching' ? 'Ищем в открытых базах' : lookup.name ? 'Нашли товар, но без состава' : 'В базах этого товара нет'}</Text>
                <Text style={styles.mono} numberOfLines={2}>{lookup.name ?? 'Open Beauty Facts · Open Food Facts · база Essola'}</Text>
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
            {lookup.state === 'missing' && aiEnabled && (
              <View style={styles.find}>
                <Text style={styles.findTitle}>{matches?.length ? 'Это одно из этих средств?' : 'Найдите средство в нашей базе'}</Text>
                <View style={styles.findRow}>
                  <Icon name="search" size={16} color={colors.muted} />
                  <TextInput value={findQ} onChangeText={setFindQ} onSubmitEditing={() => findByName(findQ)} placeholder="Бренд и название, например CeraVe крем" placeholderTextColor={colors.faint} style={styles.findInput} returnKeyType="search" />
                  {finding ? <ActivityIndicator color={colors.violet} /> : <Press onPress={() => findByName(findQ)} accessibilityLabel="Искать"><Text style={styles.clipGo}>Найти</Text></Press>}
                </View>
                {matches?.map((m) => (
                  <Press key={m.k} onPress={() => pickMatch(m)} style={styles.match}>
                    <ScoreBadge value={m.s} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchTitle} numberOfLines={2}>{m.t}</Text>
                      {!!m.b && <Text style={styles.matchBrand}>{m.b}</Text>}
                    </View>
                    <Icon name="arrowRight" size={15} color={colors.muted} />
                  </Press>
                ))}
                {matches && !matches.length && !finding && <Text style={styles.sheetText}>Не нашли — уточните название или сфотографируйте состав.</Text>}
              </View>
            )}
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
            <Text style={styles.liveText}>{ocr.state === 'loading' ? 'Загружаю распознавание…' : 'Читаю состав…'}</Text>
          </View>
        ) : barcode ? (
          <>
            <Text style={styles.sheetTitle}>Наведите на штрихкод</Text>
            <Text style={styles.sheetText}>Держите телефон в 15–20 см и приблизьте кнопкой «2×», если полоски расплываются. Ищем в открытых базах, нашей базе и интернет-магазинах.</Text>
            <View style={[styles.findRow, { marginTop: 12 }]}>
              <Icon name="barcode" size={16} color={colors.muted} />
              <TextInput value={digits} onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 14))} onSubmitEditing={() => digits.length >= 8 && lookupCode(digits)} placeholder="Или введите цифры под штрихкодом" placeholderTextColor={colors.faint} keyboardType="number-pad" returnKeyType="search" style={styles.findInput} />
              {digits.length >= 8 && (
                <Press onPress={() => lookupCode(digits)} accessibilityLabel="Найти по цифрам">
                  <Text style={styles.clipGo}>Найти</Text>
                </Press>
              )}
            </View>
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
        {seen && !lookup && mode === 'label' && (
          <Press onPress={() => { setMode('barcode'); lookupCode(seen); }} style={styles.clip}>
            <Icon name="barcode" size={16} color={colors.violet} />
            <View style={{ flex: 1 }}>
              <Text style={styles.clipTitle}>В кадре штрихкод</Text>
              <Text style={styles.clipText}>{seen}</Text>
            </View>
            <Text style={styles.clipGo}>Найти</Text>
          </Press>
        )}
        {clip && !lookup && (
          <Press onPress={() => checkLink(clip)} style={styles.clip}>
            <Icon name="external" size={16} color={colors.violet} />
            <View style={{ flex: 1 }}>
              <Text style={styles.clipTitle}>Нашли ссылку на товар</Text>
              <Text style={styles.clipText} numberOfLines={1}>
                {clip.replace(/^https?:\/\/(www\.)?/, '')}
              </Text>
            </View>
            <Text style={styles.clipGo}>Проверить</Text>
          </Press>
        )}
        {(!lookup || (lookup.state === 'missing' && mode === 'label')) && (
          <>
            <View style={styles.controls}>
              {mode === 'label' ? (
                <Press onPress={shoot} disabled={!permission?.granted || !ready || busy} style={styles.shutter} accessibilityLabel="Сфотографировать">
                  <View style={styles.shutterIn} />
                </Press>
              ) : (
                <View style={styles.shutterGhost}>
                  <Icon name="barcode" size={26} color={colors.sageDeep} />
                </View>
              )}
            </View>
            <View style={styles.actions}>
              <Press onPress={pick} style={styles.action}>
                <Icon name="image" size={20} color={colors.violet} />
                <Text style={styles.actionText}>Галерея</Text>
              </Press>
              <Press onPress={() => setManual(true)} style={styles.action}>
                <Icon name="text" size={20} color={colors.violet} />
                <Text style={styles.actionText}>Вставить текст</Text>
              </Press>
              {aiEnabled && !lookup && (
                <Press onPress={pasteLink} style={styles.action}>
                  <Icon name="external" size={20} color={colors.violet} />
                  <Text style={styles.actionText}>Ссылка Летуаль / ЗЯ</Text>
                </Press>
              )}
            </View>
          </>
        )}
        {aiEnabled && !lookup && <LinkHelp />}
      </View>
  );

  return (
    <View style={[styles.screen, !full && { backgroundColor: colors.bg }]}>
      <StatusBar style="light" />
      {engine}
      <View style={[styles.camBox, full ? StyleSheet.absoluteFill : { height: camH }]}>
      {permission?.granted ? (
        focused && (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            zoom={zoom}
            autofocus={focus}
            onCameraReady={() => setReady(true)}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'itf14'] }}
            onBarcodeScanned={!lookup && !busy ? onBarcode : undefined}
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

      {permission?.granted && <Pressable onPress={refocus} style={StyleSheet.absoluteFill} accessibilityLabel="Навести фокус" />}
      {permission?.granted && (
        <View style={[styles.zoom, { bottom: full ? undefined : 14, top: full ? insets.top + 62 : undefined }]}>
          {ZOOMS.map(([z, l]) => (
            <Press key={l} haptic={false} onPress={() => { tap(); setZoom(z); refocus(); }} style={[styles.zoomBtn, zoom === z && styles.zoomOn]}>
              <Text style={[styles.zoomText, zoom === z && { color: colors.olive }]}>{l}</Text>
            </Press>
          ))}
        </View>
      )}
      {permission?.granted && (
        <View pointerEvents="none" style={[styles.frame, { top: frameTop }, frameH ? { height: frameH } : { bottom: full ? 330 : 64 }]}>
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

      {!full && permission?.granted && (
        <Press onPress={() => { tap(); setFull(true); }} style={styles.expand} accessibilityLabel="Развернуть камеру">
          <Icon name="chevronDown" size={15} color="#fff" />
          <Text style={styles.expandText}>Развернуть</Text>
        </Press>
      )}
      {full && (
        <Press onPress={() => { tap(); setFull(false); }} style={[styles.expand, { top: insets.top + 62, bottom: undefined }]} accessibilityLabel="Свернуть камеру">
          <Text style={styles.expandText}>Свернуть</Text>
        </Press>
      )}
      </View>
      {full ? (
        sheet
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {sheet}
          <View style={styles.history}>
            <Text style={styles.historyTitle}>История сканирований</Text>
            {scans.length ? (
              scans.slice(0, 30).map((sc) => (
                <Press key={sc.id} haptic={false} onPress={() => router.push(`/analysis/${sc.id}`)} style={styles.hRow}>
                  <ScoreBadge value={sc.overall} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hName} numberOfLines={1}>{sc.title}</Text>
                    <Text style={styles.hDate}>{new Date(sc.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</Text>
                  </View>
                  <Icon name="arrowRight" size={15} color={colors.muted} />
                </Press>
              ))
            ) : (
              <Text style={styles.sheetText}>Здесь появятся проверенные средства.</Text>
            )}
          </View>
        </ScrollView>
      )}
      <ShopPage
        url={shop}
        onClose={() => {
          setShop(null);
          setBusy(false);
        }}
        onScreenshot={() => {
          setShop(null);
          setBusy(false);
          pick();
        }}
        onFound={({ title, text }) => {
          const url = shop!;
          setShop(null);
          setBusy(false);
          const list = text.split(/\s*[,;]\s*/).map((x) => x.replace(/\.$/, '').trim()).filter((x) => x.length > 1 && x.length < 90);
          saveProduct(url, title, list);
          finish(`Состав: ${text}`, title || undefined, { source: url.includes('letu') ? 'Летуаль' : 'Золотое Яблоко' }, true);
        }}
      />
      {busy && <Reading />}
    </View>
  );
}

/** Full-screen loader while the AI reads the label: a flask with a rotating ring and rising bubbles. */
function Reading() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rise = (d: number) => ({
    opacity: spin.interpolate({ inputRange: [0, d, Math.min(d + 0.5, 1), 1], outputRange: [0, 1, 0, 0] }),
    transform: [{ translateY: spin.interpolate({ inputRange: [0, 1], outputRange: [6, -26] }) }],
  });
  return (
    <View style={styles.reading} pointerEvents="auto">
      <View style={styles.readingBox}>
        <Animated.View style={[styles.readingRing, { transform: [{ rotate }] }]} />
        <Icon name="flask" size={34} color={colors.ink} strokeWidth={1.6} />
        {[0.1, 0.4].map((d, i) => (
          <Animated.View key={d} style={[styles.bubble, { left: 46 + i * 10 }, rise(d)]} />
        ))}
      </View>
      <Text style={styles.readingTitle}>Читаем состав</Text>
      <Text style={styles.readingText}>Распознаём ингредиенты и считаем баллы…</Text>
    </View>
  );
}

/** Composition text → ingredient names for the shared base. */
function splitList(raw: string) {
  return raw.replace(/^[^:]{0,40}:\s*/, '').split(/\s*[,;]\s*/).map((x) => x.replace(/\.$/, '').trim()).filter((x) => x.length > 1 && x.length < 90);
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
/** expo-camera zoom is exponential in the lens's max zoom (~16× on the main iPhone lens): these give ~2× and ~3×. */
const ZOOMS: [number, string][] = [
  [0, '1×'],
  [0.25, '2×'],
  [0.4, '3×'],
];
const styles = StyleSheet.create({
  reading: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  readingBox: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  readingRing: { position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: 'rgba(63,75,201,0.12)', borderTopColor: colors.violet, borderRightColor: '#C9B4FF' },
  bubble: { position: 'absolute', top: 44, width: 7, height: 7, borderRadius: 4, backgroundColor: '#A6C8FF' },
  readingTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginTop: 22 },
  readingText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 6 },
  screen: { flex: 1, backgroundColor: colors.night },
  permission: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 36, paddingTop: 90, paddingBottom: 36 },
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
  clip: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: '#F1EEFF' },
  clipTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  clipText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  clipGo: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingVertical: 8 },
  linkText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  camBox: { overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, backgroundColor: colors.night },
  expand: { position: 'absolute', right: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 32, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.5)' },
  expandText: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#fff' },
  sheetInline: { paddingHorizontal: space.gutter, paddingTop: 16 },
  history: { paddingHorizontal: space.gutter, marginTop: 24, gap: 8 },
  historyTitle: { fontFamily: fonts.display, fontSize: 18, letterSpacing: -0.4, color: colors.ink, marginBottom: 2 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: '#EAE6F7', shadowColor: '#15172B', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  hScore: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  hScoreText: { fontFamily: fonts.monoMedium, fontSize: 13.5, color: '#fff' },
  hName: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  hDate: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#E2DCF0', alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 18, letterSpacing: -0.4, color: colors.ink },
  sheetText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.muted, marginTop: 4 },
  mono: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted, marginTop: 2 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  liveText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  steps: { marginTop: 12, gap: 7 },
  stepText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  stepNow: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  zoom: { position: 'absolute', left: 14, flexDirection: 'row', gap: 4, padding: 3, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.45)' },
  zoomBtn: { minWidth: 34, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  zoomOn: { backgroundColor: '#FBF8F2' },
  zoomText: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#fff' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 72, paddingHorizontal: 6, paddingVertical: 10, borderRadius: 18, backgroundColor: '#F4F5FC', borderWidth: 1, borderColor: '#E6E8F6' },
  actionText: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 16, color: colors.ink, textAlign: 'center' },
  find: { marginTop: 14, padding: 12, borderRadius: 18, backgroundColor: '#F6F7FD', gap: 8 },
  findTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  findRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12 },
  findInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14.5, color: colors.ink, paddingVertical: 0 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: '#fff' },
  matchTitle: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 18, color: colors.ink },
  matchBrand: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, paddingHorizontal: 16 },
  square: { width: 52, height: 52, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: colors.olive, padding: 5 },
  shutterIn: { flex: 1, borderRadius: 34, backgroundColor: colors.olive },
  shutterGhost: { width: 76, height: 76, borderRadius: 38, borderWidth: 1.5, borderColor: '#D9D2EC', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  notice: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.brassText, backgroundColor: colors.brassSoft, borderRadius: radius.md, padding: 12 },
  manualTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 6 },
  manualTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  inputCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', padding: 16, minHeight: 190, ...shadow },
  input: { flex: 1, minHeight: 160, fontFamily: fonts.mono, fontSize: 14, lineHeight: 21, color: colors.ink },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line },
  sampleTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  sampleText: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
});
