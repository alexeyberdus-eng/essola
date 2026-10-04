import { BarcodeScanningResult, BarcodeType, CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
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
import { aiEnabled, aiLabel, aiScan, isLimit, LIMIT_NOTE, linkLookup, nkLookup, productByName, barcodeWeb, catalogPage, CatalogItem, productByBarcode, productByLink, saveBarcode, saveProduct, SHOP_LINK } from '../../lib/ai';
import { LinkHelp } from '../../components/LinkHelp';
import { ShopPage } from '../../components/ShopPage';
import { ScoreBadge } from '../../components/ScoreBadge';
import { detectNotCosmetic, NOT_COSMETIC_TEXT } from '../../lib/kind';
import { nativeOcr, recognizeText, toJpegBase64 } from '../../lib/ocr';
import { colors, fonts, radius, scoreColor, shadow, space } from '../../theme';

// Without the native module (Expo Go) photos are read by Tesseract inside a hidden WebView.
const webOcr = !nativeOcr && Platform.OS !== 'web';
const native = Platform.OS !== 'web';

const LINK_NOTICE = 'Скопируйте ссылку на товар в Летуаль, Wildberries, Ozon или Золотом Яблоке и нажмите «Ссылка» ещё раз. Если ссылки нет — сделайте скриншот состава и загрузите его через «Галерея».';

type Mode = 'barcode' | 'label' | 'front' | 'cz' | 'link';
type Lookup = { code: string; state: 'searching' | 'missing'; name?: string | null } | null;

/** Where a product card from our bases came from. */
const sourceOf = (k?: string) => (k?.startsWith('letu:') ? 'Летуаль' : k?.startsWith('inci:') ? 'База essola' : 'Open Beauty Facts');

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const { saveScan, scans } = useLibrary();
  const { height: winH } = useWindowDimensions();
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
  // The scanner is the screen; the history opens on demand below it.
  const [history, setHistory] = useState(false);
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


  const findByName = async (q: string, tries: string[] = []) => {
    if (q.trim().length < 2) return;
    setFinding(true);
    // The full name first, then shorter variants (a pack rarely matches the shop's title word for word).
    let items: CatalogItem[] = [];
    for (const t of [q, ...tries].map((x) => x.trim()).filter((x, i, a) => x.length >= 2 && a.indexOf(x) === i)) {
      const res = await catalogPage(t, undefined, 'relevance', 1).catch(() => null);
      items = (res?.items ?? []).filter((x) => x.x).slice(0, 5);
      if (items.length) break;
    }
    setMatches(items);
    setFinding(false);
  };

  // «Честный знак»: the square DataMatrix code carries the GTIN after «01»; the server asks the National Catalog.
  const czBusy = useRef(false);
  const onMarking = async ({ data }: BarcodeScanningResult) => {
    if (czBusy.current || busy) return;
    const gtin = data.replace(/[^\x20-\x7e]/g, '').match(/^\(?01\)?(\d{14})/)?.[1] ?? (/^\d{8,14}$/.test(data) ? data.padStart(14, '0') : null);
    if (!gtin) return;
    czBusy.current = true;
    tap('success');
    setBusy(true);
    setNotice(null);
    try {
      const r = await nkLookup(gtin);
      const name = [r.brand, r.title].filter(Boolean).join(' ') || undefined;
      if (r.item?.x) {
        const a = analyze(r.item.x);
        const scan = saveScan({ title: [r.item.b, r.item.t].filter(Boolean).join(' · '), text: r.item.x, overall: a.scores.overall, source: sourceOf(r.item.k), image: r.item.i || null, url: r.item.u });
        router.push(`/analysis/${scan.id}`);
      } else if (r.ingredients && r.ingredients.length >= 3) finish(`Состав: ${r.ingredients.join(', ')}`, name, { barcode: gtin.replace(/^0/, ''), source: 'Честный знак' }, true);
      else if (r.limited) setNotice(LIMIT_NOTE);
      else setNotice(name ? `Нашли «${name}», но состав не указан. Переключитесь на «Состав» и сфотографируйте его на упаковке.` : 'Не нашли средство по этому коду. Переключитесь на «Этикетка» или «Состав».');
    } catch (e) {
      setNotice(isLimit(e) ? LIMIT_NOTE : 'Не получилось проверить код — проверьте интернет и попробуйте ещё раз.');
    } finally {
      setBusy(false);
      setTimeout(() => (czBusy.current = false), 1500);
    }
  };

  // «Этикетка»: the name is read from the pack and the product opens straight from our base;
  // if it isn't there, the server looks for its composition on the web.
  const readFront = async (uri: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await aiLabel(await toJpegBase64(uri, 720));
      if (r.notCosmetic) return finish(`NOT_COSMETIC: ${r.notCosmetic}`);
      const name = [r.brand, r.name].filter(Boolean).join(' ');
      if (r.item) {
        const title = [r.item.b, r.item.t].filter(Boolean).join(' · ');
        if (!r.item.x) {
          router.push({ pathname: '/item', params: { title: r.item.t, brand: r.item.b ?? '', image: r.item.i ?? '', url: r.item.u ?? '' } } as never);
          return;
        }
        tap('success');
        const a = analyze(r.item.x);
        const scan = saveScan({ title, text: r.item.x, overall: a.scores.overall, source: sourceOf(r.item.k), image: r.item.i || null, url: r.item.u });
        router.push(`/analysis/${scan.id}`);
        return;
      }
      if (r.ingredients?.length) return finish(`Состав: ${r.ingredients.join(', ')}`, name || undefined, undefined, true);
      if (r.limited) return setNotice(LIMIT_NOTE);
      setNotice(name ? `Узнали «${name}», но состав не нашли. Переключитесь на «Состав» и сфотографируйте список ингредиентов на упаковке.` : 'Не разобрали название — снимите лицевую сторону упаковки целиком, при хорошем свете.');
    } catch (e) {
      setNotice(isLimit(e) ? LIMIT_NOTE : 'Не получилось прочитать фото — проверьте интернет и попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };


  /** A product from our base opens straight into its analysis (closes the background shop page if any). */
  const openFromBase = (item: CatalogItem) => {
    shopDone.current = true;
    setShop(null);
    setBusy(false);
    tap('success');
    const a = analyze(item.x);
    const scan = saveScan({ title: [item.b, item.t].filter(Boolean).join(' · '), text: item.x, overall: a.scores.overall, source: sourceOf(item.k), image: item.i || null, url: item.u });
    router.push(`/analysis/${scan.id}`);
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
  // A link the person dismissed isn't offered again until something else is copied.
  const clipSkip = useRef<string | null>(null);
  const [shop, setShop] = useState<string | null>(null);
  const [shopName, setShopName] = useState('Летуаль');
  // Ozon / Wildberries pages are read in the background while «Читаем…» is shown; shown only if the person asks.
  const [shopHidden, setShopHidden] = useState(false);
  const shopDone = useRef(false);
  const shopRun = useRef(0);
  const pageTitle = useRef('');
  const pageFallback = useRef<CatalogItem | null>(null);
  // The page couldn't be read: the notice offers to open it by hand.
  const [stuck, setStuck] = useState<{ url: string; text: string } | null>(null);

  const readPage = (url: string, label: string, known: string, fallback?: CatalogItem) => {
    setShopName(label);
    pageTitle.current = known;
    pageFallback.current = fallback ?? null;
    shopDone.current = false;
    setShopHidden(true);
    setBusy(true);
    setShop(url);
    const run = ++shopRun.current;
    setTimeout(() => {
      if (!shopDone.current && run === shopRun.current) giveUp(url, label);
    }, 30000);
  };

  // Nothing read from the page in time: search the composition by the product's name instead of showing the browser.
  const giveUp = async (url: string, label: string) => {
    shopDone.current = true;
    setShop(null);
    const title = pageTitle.current;
    if (pageFallback.current) return openFromBase(pageFallback.current);
    if (title) {
      const r = await productByName(title, undefined, true).catch(() => null);
      if (r?.item?.x) return openFromBase(r.item);
      if (r?.ingredients && r.ingredients.length >= 3) {
        setBusy(false);
        return finish(`Состав: ${r.ingredients.join(', ')}`, title, { source: label }, true);
      }
    }
    setBusy(false);
    const text = title
      ? `Нашли «${title}», но состав на странице ${label} не прочитался. Сфотографируйте состав на упаковке — или откройте страницу и найдите «Состав».`
      : `Страница ${label} не открылась. Сфотографируйте состав на упаковке — или откройте страницу и найдите «Состав».`;
    setStuck({ url, text });
    setNotice(text);
  };

  useEffect(() => {
    if (!focused || !aiEnabled) return;
    Clipboard.hasUrlAsync?.()
      .then((has) => (has ? Clipboard.getUrlAsync() : Clipboard.getStringAsync()))
      .then((t) => {
        const link = t?.match(SHOP_LINK)?.[0] ?? null;
        setClip(link && link !== clipSkip.current ? link : null);
      })
      .catch(() => {});
  }, [focused]);

  const checkLink = async (link: string) => {
    // «ozon.ru/t/…» without the scheme, or a link ending with the share text's punctuation.
    const url = (/^https?:\/\//i.test(link) ? link : `https://${link}`).replace(/[).,;:!?\]]+$/, '');
    setClip(null);
    setBusy(true);
    setNotice(null);
    try {
      if (!/letu\.ru/i.test(url)) {
        // Wildberries, Ozon, Gold Apple: the page is read in the background and the server is asked at the same time
        // (the shop's open composition, or our base by the product's name) — whichever answers first wins.
        const SHOP: Record<string, string> = { wb: 'Wildberries', ozon: 'Ozon', goldapple: 'Золотое Яблоко' };
        const label = /ozon/i.test(url) ? 'Ozon' : /wildberries|wb\.ru|wbx\.ru/i.test(url) ? 'Wildberries' : 'Золотое Яблоко';
        readPage(url, label, '');
        const run = shopRun.current;
        const r = await linkLookup(url).catch(() => null);
        // The page already answered, or another link was started meanwhile.
        if (!r || shopDone.current || run !== shopRun.current) return;
        const name = [r.brand, r.title].filter(Boolean).join(' ');
        // Wildberries' own card may list a single ingredient («масло ши 100%»): that is the product's whole composition.
        const enough = (r.ingredients?.length ?? 0) >= (r.shop === 'wb' ? 1 : 3);
        if (r.ingredients && enough) {
          shopDone.current = true;
          setShop(null);
          setBusy(false);
          return finish(`Состав: ${r.ingredients.join(', ')}`, name || undefined, { source: SHOP[r.shop ?? ''] ?? 'магазин' }, true);
        }
        // Wildberries gives the real name and brand from its card: the same product in our base is the answer.
        if (r.shop === 'wb' && r.item?.x) return openFromBase(r.item);
        // Otherwise the page keeps reading; the link's name and the base product it points to are the fallback
        // if the page doesn't open (Ozon often shows a robot check to a page opened in the background).
        if (!pageTitle.current && name) pageTitle.current = name;
        if (r.item?.x) pageFallback.current = r.item;
        return;
      }
      const { product } = await productByLink(url).catch(() => ({ product: null }));
      // Not in our base yet: read the page in the background, the same way as Ozon / Wildberries.
      if (!product?.ingredients?.length) return readPage(url, /goldapple/i.test(url) ? 'Золотое Яблоко' : 'Летуаль', '');
      setBusy(false);
      finish(`Состав: ${product.ingredients.join(', ')}`, product.title ?? undefined, { source: product.source }, true);
    } catch (e) {
      setNotice(isLimit(e) ? LIMIT_NOTE : 'Не получилось открыть ссылку — проверьте интернет.');
      setBusy(false);
    }
  };

  const pasteLink = async () => {
    const t = (await Clipboard.getStringAsync().catch(() => '')) ?? '';
    const url = t.match(SHOP_LINK)?.[0];
    if (url) checkLink(url);
    else setNotice(LINK_NOTICE);
  };

  const readImage = async (uri: string) => {
    if (aiEnabled) {
      // AI path: photo → clean list → straight to the result. No text editor step.
      setBusy(true);
      setNotice(null);
      try {
        const { ingredients: list, notCosmetic } = await aiScan(await toJpegBase64(uri), pendingCode.current, pendingName.current);
        if (notCosmetic) return finish(`NOT_COSMETIC: ${notCosmetic}`);
        // A real ingredient list: several items, or a short one made of known ingredients («масло ши 100%»).
        const parsed = analyze(list.join(', '));
        const known = parsed.items.filter((it) => it.match !== 'guess').length;
        if (!parsed.items.length || (list.length < 3 && !known)) throw new Error('EMPTY');
        finish(`Состав: ${list.join(', ')}`, undefined, undefined, true);
      } catch (e) {
        setNotice(
          isLimit(e)
            ? LIMIT_NOTE
            : String(e).includes('EMPTY')
            ? 'Состав не обнаружен. Наведите камеру на блок «Состав» или «Ingredients» (мелкий текст, слова через запятую) и снимите крупнее. Если хотите узнать средство по лицевой стороне — выберите «Этикетка».'
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
      const photo = await camera.current.takePictureAsync({ quality: mode === 'front' ? 0.7 : 0.95 });
      if (photo?.uri) await (mode === 'front' ? readFront(photo.uri) : readImage(photo.uri));
    } catch {
      setNotice('Камера недоступна. Выберите фото из галереи.');
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: mode !== 'cz' });
    if (res.canceled || !res.assets[0]) return;
    const uri = res.assets[0].uri;
    if (mode === 'cz') {
      // «Штрихкод» reads only codes: a barcode or a «Честный знак» square from the picture, nothing else.
      const codes = await scanFromURLAsync(uri, CODE_TYPES).catch(() => []);
      if (codes[0]) return onMarking(codes[0]);
      return setNotice('На фото не нашли штрихкод или код «Честный знак». Снимите код крупно и ровно — или выберите «Состав», чтобы разобрать список ингредиентов.');
    }
    await (mode === 'front' ? readFront(uri) : readImage(uri));
  };

  const switchMode = (m: Mode) => {
    tap();
    setMode(m);
    setNotice(null);
    setMatches(null);
    // Any mode but «Состав» leaves an unknown barcode behind (in «Состав» its composition is being shot).
    if (m !== 'label') {
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
  // Variant 1 «как камера iPhone»: full-screen camera, a dark dock with the mode words, gallery · shutter · text.
  const DOCK = 226 + insets.bottom;
  const frameTop = insets.top + (barcode ? 190 : 112);
  const frameH = barcode ? 150 : undefined;
  const MODES: [Mode, string][] = aiEnabled ? [['label', 'Состав'], ['front', 'Этикетка'], ['cz', 'Штрихкод'], ['link', 'Ссылка']] : [['label', 'Состав']];
  // Barcode not in the base and the person went to shoot the composition: the dock stays, with a reminder.
  const shootForCode = lookup?.state === 'missing' && mode === 'label';
  const hint = busy
    ? mode === 'cz' ? 'Ищем средство по коду…' : mode === 'front' ? 'Узнаём средство и ищем состав…' : mode === 'link' ? 'Читаем страницу товара…' : ocr.state === 'loading' ? 'Загружаю распознавание…' : 'Читаю состав…'
    : mode === 'front' ? 'Наведите на лицевую сторону — узнаем средство'
    : mode === 'cz' ? 'Наведите на штрихкод или код «Честный знак»'
    : mode === 'link' ? 'Скопируйте ссылку на товар в WB, Ozon, Летуаль или Золотом Яблоке'
    : shootForCode ? 'Снимите состав — запомним его за этим штрихкодом'
    : `${ocr.state === 'loading' && webOcr ? `Готовлю распознавание ${Math.round(ocr.progress * 100)}% · ` : ''}Наведите на блок «Состав» и сделайте снимок`;

  const findPanel = (
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
  );

  const noticeCard = notice && (
    <View style={styles.noticeBox}>
      <Text style={styles.noticeText}>{notice}</Text>
      {notice === LINK_NOTICE && <LinkHelp inline />}
      {stuck && notice === stuck.text && (
        <Press
          onPress={() => {
            shopDone.current = false;
            shopRun.current++;
            setShopHidden(false);
            setShop(stuck.url);
            setNotice(null);
          }}
          style={styles.clip}
        >
          <Icon name="arrowRight" size={16} color={colors.violet} />
          <Text style={[styles.clipTitle, { flex: 1 }]}>Открыть страницу</Text>
        </Press>
      )}
      <Press haptic={false} onPress={() => setNotice(null)} style={styles.noticeClose} accessibilityLabel="Скрыть">
        <Icon name="close" size={14} color={colors.brassText} />
      </Press>
    </View>
  );

  // A scanned barcode the bases don't know: a white sheet with the search, over the camera.
  const lookupSheet = lookup && !shootForCode && (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.grab} />
      <ScrollView style={{ maxHeight: Math.round(winH * 0.6) }} bounces={false} keyboardShouldPersistTaps="handled">
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
        {lookup.state === 'missing' && aiEnabled && findPanel}
        {lookup.state === 'missing' && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Button label="Снять состав" icon="camera" onPress={() => setMode('label')} style={{ flex: 1 }} />
            <Press onPress={() => switchMode('cz')} style={styles.square} accessibilityLabel="Сканировать снова">
              <Icon name="barcode" size={21} />
            </Press>
          </View>
        )}
        {!!noticeCard && <View style={{ marginTop: 12 }}>{noticeCard}</View>}
      </ScrollView>
    </View>
  );

  const side = 58;
  const dock = !lookupSheet && (
    <View style={[styles.dock, { height: DOCK }]} pointerEvents="box-none">
      <LinearGradient colors={['rgba(10,10,12,0)', 'rgba(10,10,12,0.78)', 'rgba(10,10,12,0.93)']} locations={[0, 0.24, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={styles.hint} numberOfLines={2}>{hint}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.words} style={{ flexGrow: 0 }}>
        {MODES.map(([k, l]) => (
          <Press key={k} haptic={false} onPress={() => switchMode(k)} style={styles.word} accessibilityLabel={l}>
            <Text style={[styles.wordText, mode === k && styles.wordOn]}>{l}</Text>
          </Press>
        ))}
      </ScrollView>
      <View style={[styles.row, { marginBottom: insets.bottom + 16 }]}>
        {mode === 'link' ? (
          <View style={{ width: side }} />
        ) : (
          <Press onPress={pick} style={{ width: side, alignItems: 'center' }} accessibilityLabel="Галерея">
            <View style={styles.thumb}><Icon name="image" size={20} color="#fff" /></View>
            <Text style={styles.under}>Галерея</Text>
          </Press>
        )}
        {mode === 'label' || mode === 'front' ? (
          <Press onPress={shoot} disabled={!permission?.granted || !ready || busy} style={styles.shutter} accessibilityLabel="Сфотографировать">
            <LinearGradient colors={['#9C8BF5', '#7C66EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shutterIn} />
          </Press>
        ) : mode === 'link' ? (
          <Press onPress={pasteLink} disabled={busy} style={styles.shutter} accessibilityLabel="Вставить ссылку">
            <LinearGradient colors={['#9C8BF5', '#7C66EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.shutterIn, { alignItems: 'center', justifyContent: 'center' }]}>
              <Icon name="external" size={24} color="#fff" />
            </LinearGradient>
          </Press>
        ) : (
          <View style={styles.shutterGhost}>
            <Icon name="barcode" size={26} color="#fff" />
          </View>
        )}
        {mode === 'label' ? (
          <Press onPress={() => setManual(true)} style={{ width: side, alignItems: 'center' }} accessibilityLabel="Вставить состав текстом">
            <View style={styles.round}><Icon name="text" size={20} color="#fff" /></View>
            <Text style={styles.under}>Текстом</Text>
          </Press>
        ) : (
          <View style={{ width: side }} />
        )}
      </View>
      {mode === 'link' && <Text style={[styles.under, styles.linkUnder, { bottom: insets.bottom + 2 }]}>Вставить ссылку</Text>}
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {engine}
      <View style={[styles.camBox, StyleSheet.absoluteFill]}>
      {permission?.granted ? (
        focused && (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            zoom={zoom}
            autofocus={focus}
            barcodeScannerSettings={mode === 'cz' ? { barcodeTypes: CODE_TYPES } : undefined}
            onBarcodeScanned={mode === 'cz' && !busy ? onMarking : undefined}
            onCameraReady={() => setReady(true)}
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
      {permission?.granted && mode !== 'link' && (
        <View pointerEvents="none" style={[styles.frame, { top: frameTop }, frameH ? { height: frameH } : { bottom: DOCK + 30 }]}>
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
      {/* Zoom: a pill on the right edge, out of the thumb's way. */}
      {permission?.granted && mode !== 'link' && (
        <View style={[styles.zoom, { top: frameTop + 40 }]}>
          {ZOOMS.map(([z, l]) => (
            <Press key={l} haptic={false} onPress={() => { tap(); setZoom(z); refocus(); }} style={[styles.zoomBtn, zoom === z && styles.zoomOn]} accessibilityLabel={`Зум ${l}`}>
              <Text style={[styles.zoomText, zoom === z && { color: colors.ink }]}>{l}</Text>
            </Press>
          ))}
        </View>
      )}

      <View style={[styles.camTop, { top: insets.top + 10 }]}>
        <Press onPress={close} style={styles.camBtn} accessibilityLabel="Закрыть">
          <Icon name="arrowLeft" size={18} color="#fff" />
        </Press>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Press onPress={() => { tap(); setHistory(true); }} style={styles.camBtn} accessibilityLabel="История сканирований">
            <Icon name="history" size={18} color="#fff" />
          </Press>
          <Press onPress={() => setTorch((t) => !t)} style={[styles.camBtn, torch && { backgroundColor: colors.brassLight }]} accessibilityLabel="Фонарик">
            <Icon name="torch" size={18} color={torch ? colors.olive : '#fff'} />
          </Press>
        </View>
      </View>

      {lookup && barcode && (
        <View style={[styles.code, { top: frameTop + (frameH ?? 0) + 14 }]}>
          <View style={styles.codeDot} />
          <Text style={styles.codeText}>{lookup.code.replace(/(\d)(\d{6})(\d{6})/, '$1 $2 $3')}</Text>
        </View>
      )}
      </View>

      {/* Cards over the camera, just above the dock: what went wrong, a barcode seen while shooting the composition. */}
      {!lookupSheet && (noticeCard || (seen && !lookup && mode === 'label')) && (
        <View style={[styles.float, { bottom: DOCK - 6 }]}>
          {noticeCard}
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
        </View>
      )}
      {dock}
      {lookupSheet}

      {/* A product link in the clipboard: offered in any mode, right under the top bar. */}
      {clip && !busy && !shop && (
        <View style={[styles.clipPop, { top: insets.top + 62 }]}>
          <View style={styles.clipIcon}><Icon name="external" size={16} color={colors.violet} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clipTitle}>В буфере ссылка на товар</Text>
            <Text style={styles.clipText} numberOfLines={1}>{clip.replace(/^https?:\/\/(www\.)?/, '')}</Text>
          </View>
          <Press onPress={() => checkLink(clip)} style={styles.clipBtn} accessibilityLabel="Проверить ссылку">
            <Text style={styles.clipBtnText}>Проверить</Text>
          </Press>
          <Press haptic={false} onPress={() => { clipSkip.current = clip; setClip(null); }} style={styles.clipX} accessibilityLabel="Не сейчас">
            <Icon name="close" size={14} color={colors.muted} />
          </Press>
        </View>
      )}
      <Modal visible={history} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHistory(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.histHead}>
            <Text style={styles.histTitle}>История сканирований</Text>
            <Press onPress={() => setHistory(false)} style={styles.histClose} accessibilityLabel="Закрыть">
              <Icon name="close" size={18} color={colors.ink} />
            </Press>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 30 }}>
            {scans.length ? (
              scans.slice(0, 60).map((sc) => (
                <Press
                  key={sc.id}
                  haptic={false}
                  onPress={() => {
                    setHistory(false);
                    router.push(`/analysis/${sc.id}`);
                  }}
                  style={[styles.hRow, { marginTop: 8 }]}
                >
                  <ScoreBadge value={sc.overall} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hName} numberOfLines={1}>{sc.title}</Text>
                    <Text style={styles.hDate}>{new Date(sc.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</Text>
                  </View>
                  <Icon name="arrowRight" size={15} color={colors.muted} />
                </Press>
              ))
            ) : (
              <Text style={[styles.sheetText, { marginTop: 20 }]}>Здесь появятся проверенные средства.</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
      <ShopPage
        url={shop}
        name={shopName}
        hidden={shopHidden}
        onClose={() => {
          shopDone.current = true;
          setShop(null);
          setBusy(false);
        }}
        onScreenshot={() => {
          shopDone.current = true;
          setShop(null);
          setBusy(false);
          pick();
        }}
        onTitle={async (title) => {
          // Only the name so far: if it's a product of our base, open it from there right away.
          if (pageTitle.current === title) return;
          pageTitle.current = title;
          const hit = await productByName(title).catch(() => null);
          if (shopDone.current || !hit?.item?.x) return;
          openFromBase(hit.item);
        }}
        onFound={async ({ title, text }) => {
          if (shopDone.current) return;
          const url = shop!;
          // The name first: our base has the checked composition and the photo.
          const hit = title ? await productByName(title).catch(() => null) : null;
          if (shopDone.current) return;
          if (hit?.item?.x) return openFromBase(hit.item);
          shopDone.current = true;
          setShop(null);
          setBusy(false);
          const list = text.split(/\s*[,;]\s*/).map((x) => x.replace(/\.$/, '').trim()).filter((x) => x.length > 1 && x.length < 90);
          saveProduct(url, title, list);
          finish(`Состав: ${text}`, title || undefined, { source: shopName }, true);
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
/** «Штрихкод» mode: product barcodes and the «Честный знак» DataMatrix only. */
const CODE_TYPES: BarcodeType[] = ['datamatrix', 'ean13', 'ean8', 'upc_a', 'upc_e'];

const ZOOMS: [number, string][] = [
  [0, '1×'],
  [0.25, '2×'],
  [0.4, '3×'],
];
const styles = StyleSheet.create({
  historyBar: { marginHorizontal: space.gutter, marginTop: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E1F1' },
  histHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingTop: 18, paddingBottom: 10 },
  histTitle: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.6, color: colors.ink },
  histClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E1F1', alignItems: 'center', justifyContent: 'center' },
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
  mode: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11 },
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
  historyBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6E2F3' },
  historyCount: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.violet, backgroundColor: colors.tint, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  history: { paddingHorizontal: space.gutter, marginTop: 18, gap: 8 },
  historyTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
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
  zoom: { position: 'absolute', right: 12, gap: 6, padding: 5, borderRadius: 99, backgroundColor: 'rgba(20,20,18,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  zoomBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  zoomOn: { backgroundColor: '#FFFFFF' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  hint: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.9)', textAlign: 'center', paddingHorizontal: 24 },
  words: { paddingHorizontal: 12, gap: 2, flexGrow: 1, justifyContent: 'center', marginTop: 12 },
  word: { paddingHorizontal: 7, paddingVertical: 8 },
  wordText: { fontFamily: fonts.semibold, fontSize: 12.5, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' },
  wordOn: { color: '#C9BDFF' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, marginTop: 14 },
  thumb: { width: 50, height: 50, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  round: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  under: { fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 5, textAlign: 'center' },
  linkUnder: { position: 'absolute', left: 0, right: 0 },
  float: { position: 'absolute', left: space.gutter, right: space.gutter, gap: 8 },
  noticeClose: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  clipPop: { position: 'absolute', left: space.gutter, right: space.gutter, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 12, borderRadius: 18, backgroundColor: '#FFFFFF', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }, default: { elevation: 6 } }) },
  clipIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  clipBtn: { backgroundColor: colors.violet, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  clipBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: '#fff' },
  clipX: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontFamily: fonts.semibold, fontSize: 14, color: '#fff' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 82, paddingHorizontal: 6, paddingVertical: 12, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E3E0F2', shadowColor: '#2B2F7A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  actionIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
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
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', padding: 5 },
  shutterIn: { flex: 1, borderRadius: 32 },
  // «Штрихкод» reads by itself: a dashed ring instead of a button.
  shutterGhost: { width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  noticeBox: { backgroundColor: colors.brassSoft, borderRadius: radius.md, padding: 12, paddingRight: 30 },
  noticeText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.brassText },
  notice: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.brassText, backgroundColor: colors.brassSoft, borderRadius: radius.md, padding: 12 },
  manualTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 6 },
  manualTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  inputCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', padding: 16, minHeight: 190, ...shadow },
  input: { flex: 1, minHeight: 160, fontFamily: fonts.mono, fontSize: 14, lineHeight: 21, color: colors.ink },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line },
  sampleTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  sampleText: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
});
