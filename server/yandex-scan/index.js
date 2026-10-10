// Yandex Cloud Function for essola lab.
//  mode "scan":     label photo -> clean INCI list (vision model, Alice AI VLM by default)
//  mode "describe": ingredient list -> short "what this composition does" (text model)
//  mode "review":   builder formula -> technologist's advice: what to add / reduce / remove (text model)
//  mode "product":  shared product cache (Object Storage) by barcode or shop link
//  mode "url":      Gold Apple / Letual product link -> composition from that one page, cached for everyone
//  mode "analogs":  composition -> Gold Apple products found via Yandex Search API, ranked by the text model
// Scores are NOT produced here: the app computes them from its own ingredient base.
// Env: YC_API_KEY, YC_FOLDER_ID, APP_KEY, VLM_MODEL (model id from AI Studio), TEXT_MODEL (default yandexgpt-lite).
const LLM_URL = 'https://llm.api.cloud.yandex.net/v1/chat/completions'; // OpenAI-compatible AI Studio API

const SCAN = `Выпиши с фото состав косметики (после «Состав»/«Ingredients») по порядку, каждый ингредиент в INCI (русские переведи: «масло ши» → Butyrospermum Parkii Butter), группы раскрывай, опечатки исправляй, ничего не выдумывай. Ответ — только список через «; ». Нет состава — пустой ответ. Если это не косметика (средство для стирки, посуды или уборки, еда, лекарство) — ответь одной строкой «НЕ КОСМЕТИКА: что это». /no_think`;
// «Что даёт средство»: the model answers in short codes (a few dozen tokens), the server expands them into the
// same text the app shows — fixed effect names, templates with the ingredients the model listed, use and weak spots.
const DESCRIBE = `Ты косметолог-технолог. По составу (по убыванию доли) и названию средства, если оно дано, опиши, что даёт средство. Отвечай строго строками-кодами, без пояснений и markdown:
L:1–2 предложения — что это за средство и насколько состав справляется со своей задачей (если тип известен из названия — не угадывай его)
E:КОД:ингредиенты по-русски через запятую (2–4 строки E, каждый ингредиент один раз)
W:КОД или -
U:КОДЫ через запятую (1–3) — строго по типу средства из названия (шампунь: HAIR,SCALP,RINSE; гель для умывания: FACE,RINSE; крем для рук: HAND)
Коды E: HYD увлажнение, BAR барьер и питание, SOFT смягчение, SOO успокоение, BRI ровный тон, EXF обновление, AGE упругость, ANT антиоксиданты, SEB жирность и поры, CLN очищение, UV защита от солнца, HAIR гладкость волос, GROW кожа головы, TEX текстура.
Коды W: FRAG отдушка, ALC сушащий спирт, SLS жёсткие ПАВ, COMED комедогенные масла, FEWACT мало активов для задачи, LOWACT активы в конце списка, IRR раздражающие компоненты, PRES спорный консервант.
Коды U: FACE лицо, EYE вокруг глаз, BODY тело, HAND руки, LIP губы, HAIR волосы, SCALP кожа головы, AM утром, PM вечером, DAILY ежедневно, WEEK 1–2 раза в неделю, RINSE смыть, SPF с SPF днём, DRY сухая кожа, OILY жирная кожа, SENS чувствительная кожа.
Без медицинских обещаний, без выдуманных ингредиентов.`;
const EFFECT = {
  HYD: ['Увлажнение', 'удержание влаги и увлажнение кожи'],
  BAR: ['Барьер и питание', 'восстановление защитного барьера и питание'],
  SOFT: ['Смягчение', 'смягчение и гладкость кожи'],
  SOO: ['Успокоение', 'успокоение и меньше покраснений'],
  BRI: ['Ровный тон', 'более ровный тон и сияние'],
  EXF: ['Обновление', 'мягкое отшелушивание и обновление'],
  AGE: ['Упругость', 'поддержка упругости и гладкости'],
  ANT: ['Антиоксиданты', 'защита от окислительного стресса'],
  SEB: ['Жирность и поры', 'меньше жирного блеска, чище поры'],
  CLN: ['Очищение', 'мягкое очищение'],
  UV: ['Защита от солнца', 'фильтрация ультрафиолета'],
  HAIR: ['Гладкость волос', 'гладкость и лёгкое расчёсывание'],
  GROW: ['Кожа головы', 'уход за кожей головы'],
  TEX: ['Текстура', 'приятная текстура'],
};
const WEAK = {
  FRAG: 'Есть отдушка — чувствительной коже возможны раздражения.',
  ALC: 'Сушащий спирт высоко в составе — может стягивать кожу.',
  SLS: 'Жёсткие ПАВ могут пересушивать кожу.',
  COMED: 'Есть комедогенные масла — склонной к высыпаниям коже осторожнее.',
  FEWACT: 'Мало активных компонентов для заявленной задачи.',
  LOWACT: 'Активы в самом конце списка — их доля невелика.',
  IRR: 'Есть потенциально раздражающие компоненты — сделайте тест на запястье.',
  PRES: 'Спорный консервант — при чувствительной коже лучше избегать.',
};
const USE = {
  FACE: 'на очищенную кожу лица', EYE: 'на кожу вокруг глаз', BODY: 'на кожу тела', HAND: 'на кожу рук', LIP: 'на губы',
  HAIR: 'на волосы по длине', SCALP: 'на кожу головы', AM: 'утром', PM: 'вечером', DAILY: 'ежедневно', WEEK: '1–2 раза в неделю',
  RINSE: 'затем смыть', SPF: 'днём — вместе с SPF', DRY: 'подходит сухой коже', OILY: 'подходит жирной коже', SENS: 'подходит чувствительной коже',
};
/** Coded answer → { lead, effects, weak, use } — the shape the app already shows. Old JSON answers pass through. */
function decodeDescribe(text) {
  if (text && typeof text === 'object') return text;
  // A model that answered in the old JSON shape anyway.
  const json = String(text || '').match(/\{[\s\S]*"lead"[\s\S]*\}/);
  if (json) {
    try {
      return JSON.parse(json[0]);
    } catch {}
  }
  const out = { lead: '', effects: [], weak: '', use: [] };
  const where = [];
  const how = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim().replace(/^[-*•]\s*/, '');
    const m = line.match(/^([LEWU])\s*:\s*(.*)$/i);
    if (!m) continue;
    const [k, v] = [m[1].toUpperCase(), m[2].trim()];
    if (k === 'L') out.lead = v;
    else if (k === 'E') {
      const [code, ...rest] = v.split(':');
      const e = EFFECT[code.trim().toUpperCase()];
      const ings = rest.join(':').trim().replace(/\.$/, '');
      if (e && ings && out.effects.length < 4) out.effects.push({ title: e[0], text: `${ings.charAt(0).toUpperCase()}${ings.slice(1)} — ${e[1]}.` });
    } else if (k === 'W') out.weak = WEAK[v.toUpperCase()] || (v === '-' ? '' : v.length > 6 ? v : '');
    else if (k === 'U') for (const c of v.split(/\s*,\s*/)) {
      const t = USE[c.trim().toUpperCase()];
      if (!t) continue;
      (/^(подходит|затем|днём)/.test(t) ? how : where).push(t);
    }
  }
  const place = where.filter((t) => t.startsWith('на ')).join(' или ');
  const times = where.filter((t) => !t.startsWith('на '));
  const when = times.length > 1 ? `${times.slice(0, -1).join(', ')} и ${times[times.length - 1]}` : times.join('');
  if (place || when) out.use.push(`Наносить ${[place, when].filter(Boolean).join(' ')}`.trim());
  for (const t of how) out.use.push(t.charAt(0).toUpperCase() + t.slice(1));
  return out;
}
const COMPARE = `Ты косметолог-технолог. Сравни два средства по названию и составу. Сначала по названиям пойми, для чего каждое и для какой зоны (лицо, тело, волосы, руки, губы, глаза) — сравнивай с учётом этого: если назначение разное, так и скажи. Ответ — 3–4 коротких предложения простым языком, без списков и markdown: главное различие по действию (ключевые активы), кому какое подходит и вывод. Называй их только «средство А» и «средство Б» — названия не повторяй, они уже на экране. Не выдумывай того, чего нет в составе.`;
// «Технолог обычный»: the light model answers in codes, the server writes the comparison from fixed phrases.
const COMPARE_LITE = `Ты косметолог-технолог. Сравни средство А и средство Б по названию и составу (по убыванию доли). Отвечай строго строками-кодами, без пояснений и markdown:
Z:зона А,зона Б (коды FACE лицо, EYE вокруг глаз, BODY тело, HAND руки, LIP губы, HAIR волосы, SCALP кожа головы)
A:коды действия, в которых А заметно сильнее Б (0–3) или -
B:коды действия, в которых Б заметно сильнее А (0–3) или -
WA:минус А (код) или -
WB:минус Б (код) или -
M:A, B или = — какое мягче для кожи
FA:кому больше подходит А (1–2 кода)
FB:кому больше подходит Б (1–2 кода)
V:вывод до 15 слов, называй их «средство А» и «средство Б»
Коды действия: HYD увлажнение, BAR барьер и питание, SOFT смягчение, SOO успокоение, BRI ровный тон, EXF обновление, AGE упругость, ANT антиоксиданты, SEB жирность и поры, CLN очищение, UV защита от солнца, HAIR гладкость волос, GROW кожа головы.
Коды минусов: FRAG отдушка, ALC сушащий спирт, SLS жёсткие ПАВ, COMED комедогенные масла, FEWACT мало активов, LOWACT активы в конце, IRR раздражающие компоненты, PRES спорный консервант.
Коды «кому»: DRY сухая кожа, OILY жирная, NORM нормальная, SENS чувствительная, ACNE склонная к высыпаниям, MATURE возрастная, DAMAGED повреждённые волосы, ALL всем.
Не выдумывай того, чего нет в составе.`;
const ZONE = { FACE: 'лица', EYE: 'кожи вокруг глаз', BODY: 'тела', HAND: 'рук', LIP: 'губ', HAIR: 'волос', SCALP: 'кожи головы' };
const SKIN = { DRY: 'сухой', OILY: 'жирной', NORM: 'нормальной', SENS: 'чувствительной', MATURE: 'возрастной' };
const FOR = { ACNE: 'коже, склонной к высыпаниям', DAMAGED: 'повреждённым волосам', ALL: 'всем' };
const DOES = { HYD: 'увлажняет', BAR: 'укрепляет барьер', SOFT: 'смягчает', SOO: 'успокаивает', BRI: 'выравнивает тон', EXF: 'обновляет кожу', AGE: 'поддерживает упругость', ANT: 'защищает от окисления', SEB: 'снимает жирный блеск', CLN: 'очищает', UV: 'защищает от солнца', HAIR: 'разглаживает волосы', GROW: 'ухаживает за кожей головы' };
const whom = (v) => {
  const skin = codes(v, SKIN);
  return [...(skin.length ? [`${andList(skin)} коже`] : []), ...codes(v, FOR)];
};
const codes = (v, dict) => String(v || '').split(/\s*[,;\s]\s*/).map((c) => dict[c.trim().toUpperCase()]).filter(Boolean);
const andList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} и ${xs[xs.length - 1]}` : xs.join(''));
/** Coded comparison → { text }: the same paragraph shape as the advanced technologist's answer. */
function decodeCompare(text) {
  const f = {};
  for (const raw of String(text || '').split('\n')) {
    const m = raw.trim().replace(/^[-*•]\s*/, '').match(/^(Z|A|B|WA|WB|M|FA|FB|V)\s*:\s*(.*)$/i);
    if (m) f[m[1].toUpperCase()] ??= m[2].trim();
  }
  const out = [];
  const [za, zb] = String(f.Z || '').split(/\s*,\s*/).map((z) => ZONE[z.trim().toUpperCase()]);
  if (za && zb && za !== zb) out.push(`Назначение разное: средство А — для ${za}, средство Б — для ${zb}.`);
  else if (za) out.push(`Оба средства — для ${za}.`);
  const ea = codes(f.A, DOES);
  const eb = codes(f.B, DOES);
  if (ea.length && eb.length) out.push(`Средство А лучше ${andList(ea)}, а средство Б — ${andList(eb)}.`);
  else if (ea.length) out.push(`Средство А лучше ${andList(ea)}.`);
  else if (eb.length) out.push(`Средство Б лучше ${andList(eb)}.`);
  if (!ea.length && !eb.length) out.push('По действию средства близки.');
  for (const [k, n] of [['WA', 'А'], ['WB', 'Б']]) {
    const w = WEAK[String(f[k] || '').trim().toUpperCase()];
    if (w) out.push(`Средство ${n}: ${w.charAt(0).toLowerCase()}${w.slice(1)}`);
  }
  const soft = String(f.M || '').trim().toUpperCase();
  out.push(/^(A|А)$/.test(soft) ? 'Мягче — средство А.' : /^(B|Б)$/.test(soft) ? 'Мягче — средство Б.' : 'По мягкости они похожи.');
  const fa = whom(f.FA);
  const fb = whom(f.FB);
  if (fa.length && fb.length) out.push(`Средство А больше подойдёт ${andList(fa)}, средство Б — ${andList(fb)}.`);
  else if (fa.length) out.push(`Средство А больше подойдёт ${andList(fa)}.`);
  else if (fb.length) out.push(`Средство Б больше подойдёт ${andList(fb)}.`);
  const v = String(f.V || '').replace(/\*\*/g, '').trim();
  if (v.length > 8) out.push(`Вывод: ${v.charAt(0).toLowerCase()}${v.slice(1)}${/[.!?]$/.test(v) ? '' : '.'}`);
  return { text: out.length > 1 ? out.join(' ') : '' };
}
const REVIEW = `Ты косметолог-технолог. Дана формула (ингредиент, доля, роль). Сумму, консервант, эмульгатор и pH пользователь уже видит — упоминай их только если есть «Замечания». Ответ строго строками, без markdown:
О: что получится — какое это средство, что оно даст и кому подойдёт, 1–2 предложения (пиши всегда)
В: главный вывод и совет, 1–2 предложения
+ ингредиент (INCI) | доля | что даст, до 12 слов
- ингредиент | новая доля | почему, до 10 слов
x ингредиент | почему, до 10 слов
! предупреждение, до 10 слов
Меняй только то, что действительно нужно: ошибка, нестабильность, опасная доля, явная нехватка эффекта для «Типа». Хорошая формула — строка «О: …» и строка «В: Хорошая, стабильная формула…», больше ничего. «+» 0–3, только ингредиенты, которых НЕТ в формуле (и синонимов); «-», «x», «!» 0–2. Сумма остаётся 100%: к каждому «+» добавь «-» за счёт основы (вода или базовое масло) с новой долей, пересчитанной от ЭТОЙ формулы (было Aqua 12%, +2% → «- Aqua | 10%»).
Пример:
О: Лёгкий увлажняющий тоник с молочной кислотой: мягко обновляет кожу и выравнивает тон, подойдёт нормальной и жирной коже.
В: Кислоты многовато для ежедневного ухода — смягчите формулу пантенолом.
+ Panthenol | 1% | смягчит действие кислоты
- Aqua | 79% | место для пантенола
- Lactic Acid | 5% | 8% раздражает при ежедневном применении /no_think`;
const LABEL = `На фото лицевая сторона упаковки косметического средства. Ответь ОДНОЙ строкой: бренд | название средства как на упаковке (с линейкой, без объёма) | тип по-русски (крем, шампунь, сыворотка…). Если бренда не видно, но ты узнаёшь средство по названию и дизайну, назови бренд (например, Egg Mellow — Too Cool For School). Без пояснений. Если на фото не косметика — ответь «НЕ КОСМЕТИКА: что это». /no_think`;
const SEARCH_URL = 'https://searchapi.api.cloud.yandex.net/v2/web/search';

const strip = (x) => x.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/** Yandex web search limited to one shop; returns [{url,title,text}]. */
async function search(queryText, iam) {
  track('search');
  const body = JSON.stringify({
    query: { searchType: 'SEARCH_TYPE_RU', queryText },
    groupSpec: { groupMode: 'GROUP_MODE_FLAT', groupsOnPage: '10', docsInGroup: '1' },
    maxPassages: '2',
    l10n: 'LOCALIZATION_RU',
    folderId: process.env.YC_FOLDER_ID,
    responseFormat: 'FORMAT_XML',
  });
  const auths = [`Api-Key ${process.env.YC_API_KEY}`, iam && `Bearer ${iam}`].filter(Boolean);
  let res;
  for (const a of auths) {
    res = await fetch(SEARCH_URL, { method: 'POST', headers: { Authorization: a, 'Content-Type': 'application/json' }, body });
    if (res.ok || (res.status !== 401 && res.status !== 403)) break;
  }
  if (!res.ok) throw new Error(`search ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const xml = Buffer.from((await res.json()).rawData || '', 'base64').toString('utf8');
  return [...xml.matchAll(/<doc\b[\s\S]*?<\/doc>/g)].map(([d]) => ({
    url: strip((d.match(/<url>([\s\S]*?)<\/url>/) || [])[1] || ''),
    title: strip((d.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''),
    text: [...d.matchAll(/<passage>([\s\S]*?)<\/passage>/g)].map((x) => strip(x[1])).join(' ').slice(0, 260),
  }));
}

// Shared product cache in Object Storage: one JSON per product, keyed by barcode or shop link.
const BUCKET = process.env.BUCKET;
const crypto = require('crypto');
const keyFor = ({ barcode, url }) => (barcode ? `bc/${String(barcode).replace(/\D/g, '')}.json` : url ? `url/${crypto.createHash('sha1').update(normUrl(url)).digest('hex')}.json` : null);
function normUrl(u) {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/$/, '')}`;
  } catch {
    return String(u);
  }
}
async function cacheGet(key, iam) {
  if (!BUCKET || !key || !iam) return null;
  try {
    const res = await fetch(`https://storage.yandexcloud.net/${BUCKET}/${key}`, { headers: { 'X-YaCloud-SubjectToken': iam } });
    return res.ok ? await res.json() : null;
  } catch (e) {
    console.log('cache get failed', String(e));
    return null;
  }
}
async function cachePut(key, iam, data, raw = false) {
  if (!BUCKET || !key || !iam) return;
  if (!raw && data && data.title && Array.isArray(data.ingredients)) await indexAdd(iam, key, data.title, data.source, data.ingredients.length).catch(() => {});
  try {
    const res = await fetch(`https://storage.yandexcloud.net/${BUCKET}/${key}`, {
      method: 'PUT',
      headers: { 'X-YaCloud-SubjectToken': iam, 'Content-Type': 'application/json' },
      body: JSON.stringify(raw ? data : { ...data, at: new Date().toISOString() }),
    });
    if (!res.ok) console.log('cache put', res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.log('cache put failed', String(e));
  }
}

// Products resolved from shop links, merged into the catalog by the daily catalog build.
async function shopAdd(iam, key, title, image, ingredients, source, brand = '', url = '') {
  if (!title || !ingredients || ingredients.length < 3) return;
  const list = (await cacheGet('shop.json', iam)) || [];
  const next = (Array.isArray(list) ? list : []).filter((x) => x.k !== key);
  next.push({ k: key, t: String(title).slice(0, 160), b: String(brand || '').slice(0, 60), i: image || '', u: url || '', x: `Ingredients: ${ingredients.join(', ')}`, s: source || '' });
  await cachePut('shop.json', iam, next.slice(-20000), true);
}

// Small search index of everything cached: [{k, t, s, n}] — key, title, source, ingredient count.
async function indexAdd(iam, key, title, source, n) {
  if (!title) return;
  const idx = (await cacheGet('index.json', iam)) || [];
  const list = Array.isArray(idx) ? idx.filter((x) => x.k !== key) : [];
  list.push({ k: key, t: String(title).slice(0, 160), s: source || '', n });
  await cachePut('index.json', iam, list, true);
}
async function searchCache(q, iam) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  const idx = (await cacheGet('index.json', iam)) || [];
  const hits = (Array.isArray(idx) ? idx : []).filter((x) => words.every((w) => x.t.toLowerCase().includes(w))).slice(0, 20);
  const products = await Promise.all(hits.map((h) => cacheGet(h.k, iam)));
  return products.filter((p) => p && p.ingredients?.length).map((p, i) => ({ ...p, key: hits[i].k }));
}

const SHOPS = /(^|\.)(goldapple\.ru|letu\.ru)$/i;
const decode = (x) =>
  x
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/\\n|\\r|\\t/g, ' ');

/** Reads one product page and pulls out the title and the ingredient list. */
// Letual serves product tabs (with the composition) as JSON, so a link resolves without opening the page.
async function fromLetu(url) {
  const id = (String(url).match(/letu\.ru\/product\/[^/]+\/(\d+)/) || [])[1];
  if (!id) return null;
  const h = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', Accept: 'application/json' };
  const get = (u) => fetch(u, { headers: h, signal: AbortSignal.timeout(10000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [tabs, detail] = await Promise.all([
    get(`https://www.letu.ru/s/api/product/v2/product-detail/${id}/tabs?locale=ru-RU&pushSite=storeMobileRU`),
    get(`https://www.letu.ru/s/api/product/v3/product-detail/${id}?locale=ru-RU&cityId=8113&pushSite=storeMobileRU`),
  ]);
  const found = (JSON.stringify(tabs || {}).match(/"composition"\s*:\s*"((?:[^"\\]|\\.){20,4000})"/) || [])[1];
  console.log('letu api', id, !!tabs, !!detail, found ? found.length : 0);
  if (!found) return null;
  const composition = JSON.parse(`"${found}"`).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const brand = typeof detail?.brand === 'string' ? detail.brand : detail?.brand?.name || detail?.brand?.displayName || '';
  const name = detail?.displayName || '';
  const img = JSON.stringify(detail?.media || []).match(/"(?:url|src)"\s*:\s*"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i);
  const slug = (String(url).match(/letu\.ru\/product\/([^/]+)/) || [])[1] || '';
  const title = [brand, name].filter(Boolean).join(' · ') || (JSON.stringify(tabs || {}).match(/"displayName"\s*:\s*"([^"]{3,200})"/) || [])[1] || slug.replace(/-/g, ' ');
  return { title: title.slice(0, 200), image: img ? (img[1].startsWith('http') ? img[1] : `https://www.letu.ru${img[1]}`) : null, composition };
}

async function fromShopPage(url) {
  if (/letu\.ru/i.test(url)) {
    const l = await fromLetu(url);
    if (l) return l;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'Accept-Language': 'ru-RU,ru;q=0.9' } });
    const html = await res.text();
    console.log('shop page', res.status, html.length);
    if (!res.ok) return { error: `page_${res.status}` };
    const text = decode(html);
    const title = decode((text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || text.match(/<title>([^<]+)/i) || [])[1] || '').trim();
    const image = (text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || [])[1] || null;
    const plain = text.replace(/<script[\s\S]*?<\/script>/gi, (m) => (/состав|ingredients/i.test(m) ? m : ' ')).replace(/<[^>]+>/g, '\n');
    const m =
      plain.match(/(?:состав|ingredients|inci)["'\s:\n]{1,40}((?:aqua|water|вода|[a-zа-яё][^\n"<]{2,40}),[^\n"<]{20,3000})/i);
    const composition = m ? m[1].replace(/\s+/g, ' ').trim() : null;
    return { title, image, composition };
  } catch (e) {
    return { error: String(e).slice(0, 80) };
  } finally {
    clearTimeout(t);
  }
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Content-Type': 'application/json' };
const reply = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

// The admin panel (GET ?admin): one page, with the app's CSV parser bundled in at deploy time.
let adminPage;
const ADMIN_PAGE_OF = () => {
  if (adminPage) return adminPage;
  const fs = require('fs');
  const read = (f) => {
    try {
      return fs.readFileSync(`${__dirname}/${f}`, 'utf8');
    } catch {
      return '';
    }
  };
  adminPage = read('admin.html').replace('/*CSV*/', () => read('admin-csv.js').replace(/<\/script/gi, '<\\/script')).replace('/*APP_KEY*/', '');
  return adminPage;
};

// Public pages for the App Store listing (privacy policy, terms, rules, support): the same texts as in the app,
// bundled from app/src/data/legal.ts at deploy time.
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function docPage(name) {
  let docs = {};
  try {
    docs = require('./legal.json');
  } catch {}
  const head = (title) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} — essola</title><style>body{margin:0;background:#F7F5FF;color:#1E1A33;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}main{max-width:720px;margin:0 auto;padding:32px 20px 60px}h1{font-size:28px;letter-spacing:-.5px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 6px}.muted{color:#6E6890;font-size:14px}a{color:#5E49D8}nav a{margin-right:14px;font-size:14px}textarea,input{width:100%;box-sizing:border-box;border:1px solid #E6E1FA;border-radius:12px;padding:12px;font:inherit;background:#fff}button{margin-top:12px;border:0;border-radius:14px;padding:12px 20px;font:600 15px inherit;color:#fff;background:#7C66EE}</style></head><body><main><nav class="muted"><a href="?doc=privacy">Конфиденциальность</a><a href="?doc=terms">Условия</a><a href="?doc=rules">Правила</a><a href="?doc=support">Поддержка</a></nav>`;
  if (name === 'support') {
    const key = String(process.env.APP_KEY || '').replace(/[^a-z0-9]/gi, '');
    return head('Поддержка') + `<h1>Поддержка essola</h1><p class="muted">Вопросы о приложении, данных и удалении аккаунта. Ответим на указанную почту.</p>
<form id="f"><h2>Ваша почта</h2><input id="e" type="email" required autocomplete="email"><h2>Сообщение</h2><textarea id="m" rows="6" required></textarea><button>Отправить</button><p id="r" class="muted"></p></form>
<p class="muted">Удалить аккаунт можно и в самом приложении: Профиль → Удалить аккаунт.</p>
<script>document.getElementById('f').onsubmit=async(ev)=>{ev.preventDefault();const r=document.getElementById('r');r.textContent='Отправляем…';try{const x=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json','X-App-Key':'${key}'},body:JSON.stringify({mode:'support.msg',email:document.getElementById('e').value,text:document.getElementById('m').value})});r.textContent=x.ok?'Спасибо! Сообщение получено.':'Не получилось отправить, попробуйте позже.'}catch(e){r.textContent='Нет связи, попробуйте позже.'}};</script></main></body></html>`;
  }
  const d = docs[name] || docs.privacy;
  if (!d) return head('essola') + '<h1>essola</h1></main></body></html>';
  return head(d.title) + `<h1>${esc(d.title)}</h1><p class="muted">Обновлено: ${esc(d.updated)}</p>` + d.sections.map((x) => `<h2>${esc(x.h)}</h2>${String(x.p).split('\n').map((l) => `<p>${esc(l)}</p>`).join('')}`).join('') + '</main></body></html>';
}

// The same answer asked for several times at once (two screens, a double tap) is made once per instance.
const inflight = new Map();
function shared(key, make) {
  if (inflight.has(key)) return inflight.get(key);
  const p = make().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** A JPEG or PNG no larger than `max` pixels on each side (read from the file header). */
function imageOk(dataUrl, max) {
  let buf;
  try {
    buf = Buffer.from(String(dataUrl).replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
  } catch {
    return false;
  }
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return buf.readUInt32BE(16) <= max && buf.readUInt32BE(20) <= max;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return false;
  for (let i = 2; i + 9 < buf.length; ) {
    if (buf[i] !== 0xff) return false;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    // Start-of-frame markers carry the size: height, then width.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return buf.readUInt16BE(i + 5) <= max && buf.readUInt16BE(i + 7) <= max;
    i += 2 + len;
  }
  return false;
}

/** For the daily limits: storage errors are reported, not hidden, so a paid call is refused when the count can't be kept. */
async function putStrict(key, iam, data) {
  if (!BUCKET || !iam) return false;
  const res = await fetch(`https://storage.yandexcloud.net/${BUCKET}/${key}`, { method: 'PUT', headers: { 'X-YaCloud-SubjectToken': iam, 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(5000) }).catch(() => null);
  return !!res && res.ok;
}
async function listStrict(prefix, iam) {
  if (!BUCKET || !iam) return null;
  const res = await fetch(`https://storage.yandexcloud.net/${BUCKET}?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`, { headers: { 'X-YaCloud-SubjectToken': iam }, signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!res || !res.ok) return null;
  return [...(await res.text()).matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
}

/** Keys under a prefix in the bucket (up to 1000). */
async function cacheList(prefix, iam) {
  if (!BUCKET || !iam) return [];
  const res = await fetch(`https://storage.yandexcloud.net/${BUCKET}?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`, { headers: { 'X-YaCloud-SubjectToken': iam } }).catch(() => null);
  if (!res || !res.ok) return [];
  return [...(await res.text()).matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
}

// Admins are recognised by the SHA-256 of their account email (the address itself is not in the code).
const ADMINS = ['5d94e597ea00166f5be0b0512fa5847f2f44bd49f682d6c8644f6571f434d32c'];

let lastUsage;
// ---- Spending: every model call and web search is counted per day and kind of request; each function instance
// writes its own file (stats/<day>/<instance>.json), the admin panel adds them up. Prices are per 1000 tokens, ₽.
const PRICE = { lite: 0.2, pro: 0.8, vision: 0.22, search: 0.26 };
const INSTANCE = crypto.randomBytes(5).toString('hex');
let curMode = 'other';
const stats = {};
let statsDirty = false;
let statsSaved = 0;
const day = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // Moscow date
function track(kind, tokens = 0) {
  const d = (stats[day()] ??= {});
  const m = (d[curMode] ??= { calls: 0, tokens: 0, rub: 0, search: 0 });
  if (kind === 'search') {
    m.search++;
    m.rub += PRICE.search;
  } else {
    m.calls++;
    m.tokens += tokens;
    m.rub += (tokens / 1000) * PRICE[kind];
  }
  statsDirty = true;
}
async function flushStats(iam, force = false) {
  if (!statsDirty || (!force && Date.now() - statsSaved < 30e3)) return;
  statsDirty = false;
  statsSaved = Date.now();
  for (const [d, v] of Object.entries(stats)) await cachePut(`stats/${d}/${INSTANCE}.json`, iam, v, true);
}
const kindOf = (model) => (/lite/.test(model) ? 'lite' : /yandexgpt/.test(model) ? 'pro' : 'vision');

async function chat(model, messages, maxTokens, raw = false, extra = {}) {
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.YC_API_KEY}`, 'OpenAI-Project': process.env.YC_FOLDER_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: `gpt://${process.env.YC_FOLDER_ID}/${model}`, messages, temperature: 0.1, max_tokens: maxTokens, ...extra }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  lastUsage = json?.usage;
  track(kindOf(model), Number(json?.usage?.total_tokens) || 0);
  const msg = json?.choices?.[0]?.message ?? {};
  const text = (msg.content || msg.reasoning_content || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  console.log('model reply', json?.choices?.[0]?.finish_reason, JSON.stringify(json?.usage), text.slice(0, 300));
  if (raw) return text.trim();
  const m = text.match(/\{[\s\S]*\}/);
  try {
    if (m) return JSON.parse(m[0]);
  } catch {}
  // Cut-off or sloppy JSON: salvage every quoted string after "ingredients".
  const tail = text.split(/"ingredients"\s*:/)[1];
  if (tail) return { ingredients: [...tail.matchAll(/"([^"\n]{2,80})"/g)].map((x) => x[1]) };
  return { raw: text.slice(0, 200) };
}

let catalog = null, catalogAt = 0;
async function loadCatalog(iam) {
  if (catalog && Date.now() - catalogAt < 6 * 3600e3) return catalog;
  const data = await cacheGet('catalog.json', iam);
  if (Array.isArray(data)) [catalog, catalogAt] = [data, Date.now()];
  return catalog || [];
}

// Letual catalog (collected weekly by CI with Letual's permission): compact cards in memory,
// compositions in sharded files loaded only for the cards being shown.
let letu = null, letuAt = 0;
// Our product base: Letual first (Russian shelf), then INKEEDecoder (collected with the owner's permission).
// Both use the same card layout; their compositions sit in letu/x/… and inci/x/… by key hash.
async function loadLetu(iam) {
  if (letu && Date.now() - letuAt < 6 * 3600e3) return letu;
  let [data, inci] = await Promise.all([cacheGet('letu/index.json', iam), cacheGet('inci/index.json', iam)]);
  // The indexes are large: one read can fail. Retry once; a half-loaded base is kept only for two minutes.
  if (!Array.isArray(inci)) inci = await cacheGet('inci/index.json', iam);
  if (!Array.isArray(data)) data = await cacheGet('letu/index.json', iam);
  const whole = Array.isArray(data) && Array.isArray(inci);
  if (Array.isArray(data) || Array.isArray(inci)) [letu, letuAt] = [[...(Array.isArray(data) ? data : []), ...(Array.isArray(inci) ? inci : [])], whole ? Date.now() : Date.now() - 6 * 3600e3 + 120e3];
  if (!whole) console.log('base loaded partly: letu', Array.isArray(data), 'inci', Array.isArray(inci));
  // Search text for every product, built once per load (keyword search reads it).
  for (const x of letu || []) x._h ??= ` ${norm(`${x.b || ''} ${x.t || ''}`)} `;
  return letu || [];
}
// CosIng (© European Union): INCI name → functions and EU Annex entries, rebuilt monthly by CI.
let cosing = null;
let cosingAt = 0;
async function loadCosing(iam) {
  if (cosing && Date.now() - cosingAt < 24 * 3600e3) return cosing;
  const data = await cacheGet('cosing/index.json', iam);
  if (data && typeof data === 'object') [cosing, cosingAt] = [data, Date.now()];
  return cosing || {};
}
const cosingKeys = (name) => {
  const n = String(name || '').toLowerCase().replace(/\s*\(\s*[\d.,]+\s*%\s*\)/g, '').replace(/[*.]+$/g, '').replace(/\s+/g, ' ').trim();
  const out = [n, n.replace(/\s*\(.*?\)\s*/g, ' ').trim(), ...n.split(/\s*\/\s*/)];
  return [...new Set(out.filter((x) => x.length > 1))];
};
/** A list sent from a phone looks like a real composition: most names are known INCI or common Russian ingredient words. */
const RU_INGR = /(вода|глицерин|экстракт|масл|кислот|спирт|натри|кали|гликол|токоферол|пантенол|отдушк|парфюм|бензоат|сорбат|феноксиэт|ксантан|карбомер|диметикон|цетеар|стеар|лаур|кокамид|бетаин|мочевин|аллантоин|сквалан|ниацинамид|гиалурон|церамид|керамид|лецитин|воск|глюкоз|гидролат|ароматизатор|краситель|\bci ?\d)/i;
async function plausibleList(list, iam) {
  if (list.length < 3) return false;
  const db = await loadCosing(iam);
  const known = list.filter((n) => RU_INGR.test(n) || cosingKeys(n).some((k) => db[k])).length;
  return known >= Math.max(3, Math.ceil(list.length * 0.5));
}
/**
 * Compositions sent by phones (a photo matched to a barcode, a shop page read in the app) never overwrite a record
 * someone else made: the first plausible one is kept as unconfirmed, the same list from another person and network
 * confirms it, a different one is only logged for the admin (suggest/…), so nothing can be replaced or rolled back.
 */
async function userSubmit(key, iam, who, rec) {
  const norm2 = (l) => l.map((x) => x.toLowerCase().replace(/\s+/g, ' ').trim()).join('|');
  const prev = await cacheGet(key, iam);
  const log = () => cachePut(`suggest/${key.replace(/[^a-z0-9]/gi, '_')}/${Date.now()}-${who.slice(0, 12)}.json`, iam, { ...rec, by: who, at: new Date().toISOString() }, true).catch(() => {});
  if (!prev) {
    await cachePut(key, iam, { ...rec, by: who, verified: false });
    return 'saved';
  }
  if (prev.by && prev.by !== who && !prev.verified && Array.isArray(prev.ingredients) && norm2(prev.ingredients) === norm2(rec.ingredients)) {
    await cachePut(key, iam, { ...prev, verified: true, confirmedBy: who });
    return 'confirmed';
  }
  await log();
  return 'kept';
}
// «Средства с ингредиентом»: product keys per ingredient, built by CI (scripts/build-ingr.ts), most popular first.
const ingrLists = new Map();
async function ingrList(slug, iam) {
  if (ingrLists.has(slug)) return ingrLists.get(slug);
  const keys = await cacheGet(`ingr/${slug}.json`, iam);
  const set = new Set(Array.isArray(keys) ? keys : []);
  if (ingrLists.size > 60) ingrLists.delete(ingrLists.keys().next().value);
  ingrLists.set(slug, set);
  return set;
}
const shards = new Map();
const sortedMemo = new Map();
async function letuShard(h, iam) {
  if (shards.has(h)) return shards.get(h);
  const [src, hash] = h.includes('/') ? h.split('/') : ['letu', h];
  const data = (await cacheGet(`${src}/x/${hash}.json`, iam)) || {};
  if (shards.size > 700) shards.delete(shards.keys().next().value);
  shards.set(h, data);
  return data;
}
async function withCompositions(items, iam) {
  const shardKey = (k) => `${k.startsWith('inci:') ? 'inci' : 'letu'}/${crypto.createHash('sha1').update(k).digest('hex').slice(0, 3)}`;
  const need = [...new Set(items.filter((x) => !x.x && !x.z && /^(letu|inci):/.test(x.k)).map((x) => shardKey(x.k)))];
  const loaded = Object.fromEntries(await Promise.all(need.map(async (h) => [h, await letuShard(h, iam)])));
  // INKEEDecoder pages repeat parts of the list further down (highlights): keep each ingredient once, in label order.
  const once = (k, t) => (k.startsWith('inci:') && t ? [...new Set(t.split(/\s*,\s*/))].join(', ') : t);
  return items.map((x) => (x.x || x.z || !/^(letu|inci):/.test(x.k) ? x : { ...x, x: once(x.k, loaded[shardKey(x.k)]?.[x.k] || '') }));
}

const norm = (x) => String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();

// ---- Search by keywords: names differ between shops, packs and our base (word order, Latin vs Cyrillic, endings),
// so a product matches when most of the meaningful words do, in either script.
const RU2LAT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const LAT2RU = [['shch', 'щ'], ['sch', 'щ'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'], ['ch', 'ч'], ['sh', 'ш'], ['yu', 'ю'], ['ya', 'я'], ['yo', 'е'], ['iy', 'ий'], ['yy', 'ый'], ['a', 'а'], ['b', 'б'], ['v', 'в'], ['g', 'г'], ['d', 'д'], ['e', 'е'], ['z', 'з'], ['i', 'и'], ['y', 'ы'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'], ['f', 'ф'], ['h', 'х'], ['c', 'к'], ['w', 'в'], ['x', 'кс'], ['q', 'к'], ['j', 'дж']];
const toLat = (w) => [...w].map((c) => RU2LAT[c] ?? c).join('');
const toRu = (w) => {
  let o = '';
  let i = 0;
  outer: while (i < w.length) {
    for (const [l, r] of LAT2RU) if (w.startsWith(l, i)) {
      o += r;
      i += l.length;
      continue outer;
    }
    o += w[i++];
  }
  return o;
};
const STOP = new Set(['для', 'и', 'с', 'со', 'на', 'в', 'во', 'от', 'по', 'из', 'без', 'the', 'and', 'for', 'with', 'of', 'to', 'in', 'мл', 'ml', 'гр', 'шт', 'купить', 'цена', 'отзывы', 'оригинал', 'new', 'новинка']);
function keywords(q) {
  return [...new Set(norm(q).split(' ').filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+(мл|ml|г|g|гр|шт|pcs)?$/.test(w)))].slice(0, 12);
}
// Each word gets its spellings: as typed, transliterated, and a stem (Russian endings vary).
function variants(w) {
  const cyr = /[а-я]/.test(w);
  const alt = cyr ? toLat(w) : toRu(w);
  const out = [w, alt];
  // Brands written in Cyrillic by ear: «сераве» → serave/cerave, «кьюрел» → kyurel/curel.
  const lat = cyr ? alt : w;
  out.push(lat.replace(/s/g, 'c'), lat.replace(/k/g, 'c'), lat.replace(/kyu|ky/g, 'cu'));
  for (const x of [w, alt]) if (/[а-я]/.test(x) && x.length > 5) out.push(x.slice(0, Math.max(4, x.length - 3)));
  return [...new Set(out.filter((x) => x.length > 1))];
}
/** Products whose brand + title contain most of the query's words, best first. */
function keywordSearch(list, q, min = 0.6) {
  const words = keywords(q).map(variants);
  if (!words.length) return [];
  const need = words.length <= 2 ? words.length : Math.ceil(words.length * min);
  const out = [];
  for (const x of list) {
    const hay = (x._h ??= ` ${norm(`${x.b || ''} ${x.t || ''}`)} `);
    let hit = 0;
    for (const vs of words) if (vs.some((v) => hay.includes(v))) hit++;
    if (hit >= need) out.push([hit, x]);
  }
  out.sort((a, b) => b[0] - a[0] || (a[1].z || 0) - (b[1].z || 0) || (b[1].p || 0) - (a[1].p || 0));
  return out.map(([hit, x]) => Object.assign(x, { _score: hit / words.length }));
}

/** Brand + name read from the pack → the product in our Letual base (titles there are Russian, packs often English,
 * so a small text model picks among the brand's products), or a composition found on the web. */
async function findByLabel(brand, name, kind, iam, model, canWeb = async () => true, canPick = canWeb) {
  const b = norm(brand).replace(/ /g, '');
  const base = await loadLetu(iam);
  const ours = b.length >= 2 ? base.filter((x) => { const xb = norm(x.b).replace(/ /g, ''); return xb && (xb === b || (b.length >= 4 && (xb.includes(b) || b.includes(xb)))); }) : [];
  if (ours.length) {
    const words = norm(`${name} ${kind}`).split(' ').filter((w) => w.length > 2 && !/^\d+(мл|ml|г|g)?$/.test(w));
    const score = (x) => words.filter((w) => norm(x.t).includes(w)).length + (x.z ? -5 : 0);
    const top = [...ours].sort((a, c) => score(c) - score(a) || (c.p || 0) - (a.p || 0)).slice(0, 30);
    let pick = top.length === 1 && !top[0].z ? top[0] : null;
    if (!pick) {
      // The model's choice is remembered per query and base version: asking again costs nothing. A new choice
      // is a paid call and goes through the daily limit like any other.
      const pk = `pick/${crypto.createHash('sha1').update(norm(`${brand}|${name}|${kind}`)).digest('hex')}-${base.length}.json`;
      const memo = await cacheGet(pk, iam);
      if (memo) pick = memo.k ? top.find((x) => x.k === memo.k) || null : null;
      else if (await canPick()) {
        const list = top.map((x, i) => `${i + 1}. ${String(x.t).slice(0, 120)}`).join('\n');
        const ans = await chat(model, [{ role: 'user', content: `На упаковке: «${String(brand).slice(0, 60)} ${String(name).slice(0, 160)}»${kind ? ` (${String(kind).slice(0, 40)})` : ''}. Какой товар из списка — это то же средство (переводы и сокращения допустимы)? Ответь только номером, или 0, если такого нет.\n${list}` }], 8, true).catch(() => null);
        if (ans !== null) {
          const n = parseInt(String(ans).match(/\d+/)?.[0] || '0', 10);
          pick = n > 0 && n <= top.length ? top[n - 1] : null;
          await cachePut(pk, iam, { k: pick ? pick.k : 0 }, true).catch(() => {});
        }
      } else return { limited: true };
    }
    if (pick) {
      const [item] = await withCompositions([(({ g, _h, _score, ...x }) => x)(pick)], iam);
      if (item.x) return { item };
      return { item, none: true };
    }
  }
  // Not in our base: find the product's pages on the web, open a few and let the model copy the ingredient list out.
  const ck = `label/${crypto.createHash('sha1').update(norm(`${brand} ${name}`)).digest('hex')}.json`;
  const hit = await cacheGet(ck, iam);
  if (hit && hit.ingredients) return hit;
  if (!(await canWeb())) return { limited: true };
  const queries = [`${brand} ${name} ingredients inci`, `${brand} ${name} состав`];
  const docs = (await Promise.all(queries.map((q) => search(q, iam).catch(() => [])))).flat();
  // Marketplaces render their pages with scripts (nothing to read) and some shops block robots: skip them.
  const skip = /wildberries|ozon\.|goldapple|market\.yandex|aliexpress|youtube|vk\.com|pinterest|instagram/;
  const seen = new Set();
  const pages = docs.filter((d) => d.url && !skip.test(d.url) && !seen.has(d.url) && seen.add(d.url)).sort((a, b) => Number(/incidecoder|skinsort|cosdna|inci/.test(b.url)) - Number(/incidecoder|skinsort|cosdna|inci/.test(a.url))).slice(0, 3);
  const texts = await Promise.all(pages.map((d) => pageIngredients(d.url).catch(() => '')));
  const snippets = docs.slice(0, 4).map((d) => `${d.title} — ${d.text}`).join('\n');
  const text = [...texts.filter(Boolean), snippets].join('\n---\n').slice(0, 5000);
  console.log('label web:', pages.length, 'pages,', texts.filter(Boolean).length, 'with text');
  if (!text.trim()) return {};
  const out = await chat(model, [{ role: 'user', content: `Ниже тексты страниц о средстве «${brand} ${name}». Найди его полный состав (ingredients, INCI). Выпиши ингредиенты через запятую, как в источнике, без пояснений. Если полного состава этого средства нет — ответь «нет».\n${text}` }], 700, true).catch(() => '');
  const ingredients = String(out).replace(/^[^:\n]{0,25}:\s*/, '').split(/\s*,\s*/).map((x) => x.replace(/[.\s]+$/, '').trim()).filter((x) => x.length > 1 && x.length < 90);
  if (ingredients.length < 5) return {};
  const found = { ingredients, web: true };
  await cachePut(ck, iam, found, true).catch(() => {});
  return found;
}

// ---- Links from Wildberries and Ozon ----
// Wildberries publishes each card as a static JSON file on its CDN (name, brand, characteristics incl. «Состав»).
// The CDN host number depends on the article; try the likely one first, then the rest in small batches.
// Since basket 37 every new host takes the next 312 volumes; the table continues that step for newer articles.
const WB_RANGES = [143, 287, 431, 719, 1007, 1061, 1115, 1169, 1313, 1601, 1655, 1919, 2045, 2189, 2405, 2621, 2837, 3053, 3269, 3485, 3701, 3917, 4133, 4349, 4565, 4877, 5189, 5501, 5813, 6125, 6437, 6749, 7061, 7373, 7685, 7997, 8309, 8621, 8933, 9245];
while (WB_RANGES.length < 140) WB_RANGES.push(WB_RANGES[WB_RANGES.length - 1] + 312);
const wbHostOf = new Map(); // vol → host that answered, so the next article from that volume goes straight there
async function wbCard(nm) {
  const vol = Math.floor(nm / 1e5);
  const part = Math.floor(nm / 1e3);
  const guess = wbHostOf.get(vol) || WB_RANGES.findIndex((x) => vol <= x) + 1 || WB_RANGES.length;
  // Nearest hosts first (the table drifts by a host or two), then everything else.
  const near = [0, -1, 1, -2, 2, -3, 3].map((d) => guess + d).filter((h) => h >= 1);
  const hosts = [...near, ...Array.from({ length: 160 }, (_, i) => i + 1).filter((h) => !near.includes(h))];
  const get = async (h) => {
    const url = `https://basket-${String(h).padStart(2, '0')}.wbbasket.ru/vol${vol}/part${part}/${nm}/info/ru/card.json`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) }).catch(() => null);
    const c = r && r.ok ? await r.json().catch(() => null) : null;
    if (c) {
      wbHostOf.set(vol, h);
      c._image = `https://basket-${String(h).padStart(2, '0')}.wbbasket.ru/vol${vol}/part${part}/${nm}/images/big/1.webp`;
    }
    return c;
  };
  const first = await get(hosts[0]);
  if (first) return first;
  for (let i = 1; i < hosts.length; i += 30) {
    const found = (await Promise.all(hosts.slice(i, i + 30).map(get))).find(Boolean);
    if (found) return found;
  }
  console.log('wb card not found', nm, 'vol', vol, 'guess', guess);
  return null;
}
/**
 * The technologist's changes must keep the formula at exactly 100%: what is added, raised, lowered or removed
 * is summed, and the difference is taken from (or given to) the formula's BASE — water or a hydrosol, or the base
 * oil in an anhydrous product — never an active. With no base in the formula, the base is added as a new line.
 * Models are bad at this arithmetic, so it is done here, never left to the model.
 */
function balanceReview(out, items, kind = '') {
  const num = (v) => parseFloat(String(v ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0] ?? 'NaN');
  const r1 = (x) => Math.round(x * 10) / 10;
  const anhydrous = /масл|бальзам|баттер|oil|balm|butter/i.test(String(kind).split('.')[0]);
  const WATER = /\b(aqua|water|вода)\b|hydrosol|гидролат|flower water|leaf water|цветочн.{0,4}вод/i;
  const OIL = /oil|масло|butter|баттер|triglyceride|squalane|сквалан|триглицерид/i;
  const isBase = (name, role = '') => (anhydrous ? OIL.test(name) || /основа|смягч|эмолент/i.test(role) : WATER.test(name) || /основа|растворит|водн/i.test(role));
  const cur = [];
  for (const s of items) {
    const m = String(s).match(/^(.+?)\s+(\d+(?:[.,]\d+)?)%\s*(?:\(([^)]*)\))?/);
    if (m) cur.push({ name: m[1].trim(), key: norm(m[1]), pct: num(m[2]), role: m[3] || '' });
  }
  const find = (name) => {
    const n = norm(name);
    return n ? cur.find((c) => c.key === n || (n.length > 4 && (c.key.includes(n) || n.includes(c.key)))) : undefined;
  };
  // «Add» of something already in the formula is really a new share for it.
  for (const a of [...out.add]) {
    const c = find(a.name);
    if (!c) continue;
    out.add.splice(out.add.indexOf(a), 1);
    if (!Number.isNaN(num(a.pct)) && !out.reduce.some((r) => find(r.name) === c)) out.reduce.push({ name: c.name, to: `${r1(num(a.pct))}%`, why: a.why });
  }
  // A «change share» line for something not in the formula is an addition (with a share) or noise (without one);
  // a line that leaves the share as it is changes nothing.
  for (const r of [...out.reduce]) {
    const c = find(r.name);
    const to = num(r.to);
    if (!c) {
      out.reduce.splice(out.reduce.indexOf(r), 1);
      if (!Number.isNaN(to) && to > 0) out.add.push({ name: r.name, pct: `${r1(to)}%`, why: r.why });
    } else if (Number.isNaN(to) || Math.abs(to - c.pct) < 0.05) out.reduce.splice(out.reduce.indexOf(r), 1);
  }
  const removed = new Set(out.remove.map((x) => find(x.name)).filter(Boolean));
  let net = 0;
  for (const a of out.add) net += num(a.pct) || 0;
  for (const r of out.reduce) net += num(r.to) - find(r.name).pct;
  for (const c of removed) net -= c.pct;
  // The formula itself may not be at 100% yet (5% of actives + advice): the advice has to finish it.
  const sum = r1(cur.reduce((a, c) => a + c.pct, 0));
  if (cur.length && Math.abs(sum - 100) >= 0.1 && /хорош|сбаланс|стабильн|готов/i.test(out.verdict || '')) {
    out.verdict = `Почти готово: сейчас сумма формулы ${String(sum).replace('.', ',')}%, а должна быть ровно 100%. Доведите её до 100%, как показано ниже, — и формула будет завершена.`;
  }
  net = r1(net + sum - 100);
  if (Math.abs(net) < 0.1) return out;
  // 1) a base already in the formula (at its new share if the advice changes it), the largest one;
  const bases = cur.filter((c) => !removed.has(c) && isBase(c.name, c.role)).map((c) => ({ c, line: out.reduce.find((r) => find(r.name) === c) }));
  bases.sort((x, y) => (y.line ? num(y.line.to) : y.c.pct) - (x.line ? num(x.line.to) : x.c.pct));
  const d = bases[0];
  if (d) {
    const to = r1((d.line ? num(d.line.to) : d.c.pct) - net);
    if (to >= 0.1) {
      if (d.line) d.line.to = `${to}%`;
      else out.reduce.push({ name: d.c.name, to: `${to}%`, why: net > 0 ? 'основа уступает место новым компонентам — сумма остаётся 100%' : 'основа дополняет формулу до 100%' });
      return out;
    }
  }
  // 2) a base the advice itself adds;
  const added = out.add.find((a) => isBase(a.name));
  if (added && r1((num(added.pct) || 0) - net) >= 0.1) {
    added.pct = `${r1((num(added.pct) || 0) - net)}%`;
    return out;
  }
  // 3) no base at all: it is the missing piece, added with exactly the share that completes the formula.
  if (net < 0)
    out.add.push(anhydrous
      ? { name: 'Caprylic/Capric Triglyceride', pct: `${r1(-net)}%`, why: 'базовое масло — основа формулы, дополняет её до 100%' }
      : { name: 'Aqua', pct: `${r1(-net)}%`, why: 'вода — основа формулы, дополняет её до 100%' });
  return out;
}

/** Short share links (ozon.ru/t/…, wb.ru/…, clck…) only redirect to the product page: read where they point. */
async function resolveShort(url) {
  let cur = url;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(cur, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' }, signal: AbortSignal.timeout(6000) }).catch(() => null);
    const loc = r && r.status >= 300 && r.status < 400 ? r.headers.get('location') : null;
    if (!loc) break;
    cur = new URL(loc, cur).toString();
    if (/\/product\/|\/catalog\/\d/.test(cur)) break;
  }
  console.log('short link', url, '→', cur.slice(0, 160));
  return cur;
}

/** Shop link → what the shop tells about the product: name, brand, composition when it is published openly. */
async function fromMarketplace(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  // A share link without the product in it: follow its redirect first.
  if (!/\/product\/|\/catalog\/\d|[?&](card|nm)=/.test(u.pathname + u.search)) {
    try {
      u = new URL(await resolveShort(url));
    } catch {}
  }
  const host = u.hostname.replace(/^www\./, '');
  if (/(^|\.)(wildberries\.(ru|by|kz|am|kg|uz|ge)|wb\.ru|wbx\.ru)$/.test(host)) {
    // App and site links differ (/catalog/<id>/detail.aspx, ?card=, ?nm=, short forms): take the article number.
    const nm = Number(u.pathname.match(/catalog\/(\d{5,12})/)?.[1] || u.searchParams.get('card') || u.searchParams.get('nm') || u.pathname.match(/(\d{6,12})/)?.[1] || 0);
    console.log('wb link', host, nm);
    if (!nm) return { shop: 'wb' };
    const c = await wbCard(nm);
    if (!c) return { shop: 'wb', id: nm };
    const opts = [...(c.options || []), ...((c.grouped_options || []).flatMap((g) => g.options || []))];
    const fromDesc = String(c.description || '').match(/(?:состав|ingredients|inci)\s*[:：-]\s*([^\n]{20,3000})/i)?.[1] || '';
    const comp = opts.find((o) => /состав|ingredients/i.test(o.name || ''))?.value || fromDesc || (c.compositions || []).map((x) => x.name).join(', ');
    console.log('wb card', nm, String(c.imt_name || '').slice(0, 60), 'composition chars', String(comp || '').length);
    return { shop: 'wb', id: nm, title: String(c.imt_name || c.subj_name || '').trim(), brand: String(c.selling?.brand_name || '').trim(), image: c._image, url: `https://www.wildberries.ru/catalog/${nm}/detail.aspx`, composition: String(comp || '').trim() };
  }
  if (/ozon\.(ru|by|kz|com)$/.test(host)) {
    // Ozon pages are behind bot protection: only the words of the link itself are used (the product slug).
    const slug = u.pathname.match(/product\/([^/]+?)(?:-\d+)?\/?$/)?.[1] || '';
    return { shop: 'ozon', title: slug.replace(/-/g, ' ').trim() };
  }
  if (/goldapple\.ru$/.test(host)) {
    const slug = u.pathname.split('/').filter(Boolean).pop() || '';
    return { shop: 'goldapple', title: slug.replace(/^\d+-/, '').replace(/-/g, ' ').trim() };
  }
  return null;
}

/** One page's text around its ingredient list (what a reader sees, without markup). */
async function pageIngredients(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EssolaBot/1.0; +https://essola.ru)', Accept: 'text/html' }, signal: AbortSignal.timeout(7000) });
  if (!res.ok) return '';
  const html = (await res.text()).slice(0, 1_500_000);
  const text = strip(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<\/(p|div|li|h\d|br|tr)>/gi, '\n'));
  const at = text.search(/ingredients|состав|inci/i);
  return at < 0 ? '' : text.slice(Math.max(0, at - 100), at + 1500);
}

/** Someone who posts gets a public profile with their nickname (if they had none), so tapping the nick opens it. */
async function ensureUser(get, put, id, nick) {
  if (!id || !nick) return;
  if (!(await get(`users/${id}.json`, null))) await put(`users/${id}.json`, { id, nick: String(nick).slice(0, 24) });
}


// ---- Accounts (Yandex Cloud only: personal data stays in Russia) ----
// accounts/<uid>.json — the account; accounts/by/<sha(provider:id)>.json — sign-in → uid; sessions/<sha(token)>.json;
// accounts/<uid>/data.json — the person's data synced from their phones (scans, shelf, likes, questionnaire…).
const sha = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');
async function cacheDel(key, iam) {
  if (!BUCKET || !key || !iam) return;
  await fetch(`https://storage.yandexcloud.net/${BUCKET}/${key}`, { method: 'DELETE', headers: { 'X-YaCloud-SubjectToken': iam } }).catch(() => {});
}

const mailReady = { ok: false, at: 0 };
let appleKeys = null;
let appleKeysAt = 0;
/** Sign in with Apple: the identity token is a JWT signed by Apple; checks signature, issuer, audience and expiry. */
async function verifyApple(token) {
  const [h, p, sig] = String(token || '').split('.');
  if (!h || !p || !sig) throw new Error('bad_token');
  const head = JSON.parse(Buffer.from(h, 'base64url').toString());
  const body = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (!appleKeys || Date.now() - appleKeysAt > 6 * 3600e3) {
    appleKeys = (await (await fetch('https://appleid.apple.com/auth/keys', { signal: AbortSignal.timeout(8000) })).json()).keys;
    appleKeysAt = Date.now();
  }
  const jwk = appleKeys.find((k) => k.kid === head.kid);
  if (!jwk) throw new Error('unknown_key');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(sig, 'base64url'));
  // The app's bundle id in a real build; Expo Go signs in as its own app while testing.
  if (!ok || body.iss !== 'https://appleid.apple.com' || !['com.essola.lab', 'host.exp.Exponent'].includes(body.aud) || body.exp * 1000 < Date.now()) throw new Error('bad_token');
  return { id: body.sub, email: body.email || null };
}

/** VK ID: the access token is checked by asking VK who it belongs to. */
async function verifyVk(accessToken) {
  const res = await fetch('https://id.vk.com/oauth2/user_info', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.VK_CLIENT_ID || '', access_token: String(accessToken || '') }), signal: AbortSignal.timeout(8000) });
  const j = await res.json().catch(() => ({}));
  const u = j.user;
  if (!u || !u.user_id) throw new Error('bad_token');
  return { id: String(u.user_id), email: u.email || null, name: [u.first_name, u.last_name].filter(Boolean).join(' ') || null };
}

/** The sign-in code by email, through Yandex Cloud Postbox (the function's service account sends it). */
async function sendCode(email, code, iam) {
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#15172B"><p>Ваш код для входа в <b>essola lab</b>:</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold;color:#7C66EE">${code}</p><p style="color:#7D8096">Код действует 10 минут. Если вы не запрашивали вход, просто удалите это письмо.</p></div>`;
  const res = await fetch('https://postbox.cloud.yandex.net/v2/email/outbound-emails', {
    method: 'POST',
    headers: { 'X-YaCloud-SubjectToken': iam, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      FromEmailAddress: `essola lab <${process.env.MAIL_FROM || 'noreply@essola.ru'}>`,
      Destination: { ToAddresses: [email] },
      Content: { Simple: { Subject: { Data: `Код входа: ${code}`, Charset: 'UTF-8' }, Body: { Text: { Data: `Ваш код для входа в essola lab: ${code}. Код действует 10 минут.`, Charset: 'UTF-8' }, Html: { Data: html, Charset: 'UTF-8' } } } },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    console.log('postbox', res.status, (await res.text()).slice(0, 300));
    throw new Error('mail_failed');
  }
}

// Every request is counted under its mode; the spending is written out after the answer is ready.
module.exports.handler = async (event, context) => {
  curMode = 'other';
  if (event.httpMethod === 'POST') {
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '{}';
      curMode = String(JSON.parse(raw).mode || 'scan').replace(/[^a-z.]/gi, '').slice(0, 30) || 'scan';
    } catch {}
  }
  const res = await handle(event, context);
  await flushStats(context?.token?.access_token).catch(() => {});
  return res;
};

async function handle(event, context) {
  if (event.httpMethod === 'OPTIONS') return reply(204, {});
  if (event.httpMethod === 'GET') {
    const q0 = event.queryStringParameters || {};
    if (q0.doc) return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' }, body: docPage(String(q0.doc).replace(/[^a-z]/g, '')) };
    if (q0.admin !== undefined) return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, body: ADMIN_PAGE_OF() };
    // VK ID redirects here (the only https address VK accepts); send the code on into the app it came from.
    // The app registered its return address under the state beforehand (mode "vk.start").
    const q = event.queryStringParameters || {};
    // Some flows put the answer after "#": a tiny page moves it into the query and comes back.
    if (!q.state) return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: '<script>if(location.hash.length>1)location.replace(location.pathname+"?"+location.hash.slice(1));else document.write("Вход отменён. Вернитесь в приложение.")</script>' };
    console.log('vk bounce keys:', Object.keys(q).join(','), 'state:', String(q.state || '').slice(0, 12));
    const state = String(q.state || '').replace(/[^A-Za-z0-9_-]/g, '');
    const saved = state.length >= 16 ? await cacheGet(`vk/${state}.json`, context?.token?.access_token) : null;
    const back = String(saved?.back || '');
    if (!/^(exps?|essola):\/\/[^\s"'<>]*$/.test(back)) return reply(400, { error: 'bad_state' });
    const params = new URLSearchParams(Object.fromEntries(['code', 'state', 'device_id', 'error', 'error_description'].filter((k) => q[k]).map((k) => [k, String(q[k])])));
    return { statusCode: 302, headers: { Location: `${back}${back.includes('?') ? '&' : '?'}${params}` }, body: '' };
  }
  const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '{}';
    const req = JSON.parse(raw);
    // The app key is shared by every installed app, so it only keeps out random traffic; who may do what is
    // decided below by the session or the device secret. The admin panel has no app key: it may call only the
    // admin-only modes, each of which checks the admin token itself.
    const ADMIN_MODES = ['admin.check', 'admin.stats', 'admin.reports', 'admin.club', 'admin.promo', 'editorial.add', 'editorial.list', 'editorial.remove', 'stories.add', 'stories.list', 'stories.img', 'stories.remove'];
    if (process.env.APP_KEY && h['x-app-key'] !== process.env.APP_KEY && !(req.admin && ADMIN_MODES.includes(req.mode))) return reply(401, { error: 'unauthorized' });
    const textModel = process.env.TEXT_MODEL || 'yandexgpt-lite/latest';
    const iam = context?.token?.access_token;
    // What goes into a model prompt is cut to sane sizes before anything else: long fields only add cost.
    if (['describe', 'review', 'compare', 'scan', 'label', 'byname', 'link'].includes(req.mode)) {
      const strs = (a, n, len) => (Array.isArray(a) ? a : []).filter((x) => typeof x === 'string').slice(0, n).map((x) => x.replace(/[<>]/g, '').trim().slice(0, len)).filter(Boolean);
      if ('items' in req) req.items = strs(req.items, 40, 120);
      if ('ingredients' in req) req.ingredients = strs(req.ingredients, 60, 90);
      if ('notes' in req) req.notes = strs(req.notes, 6, 160);
      if ('done' in req) req.done = strs(req.done, 12, 60);
      for (const k of ['kind', 'title', 'name', 'brand', 'url']) {
        if (typeof req[k] === 'string') req[k] = req[k].slice(0, k === 'url' ? 600 : 200);
        else if (req[k] != null) delete req[k];
      }
      for (const k of ['a', 'b']) if (req[k] && typeof req[k] === 'object') req[k] = { title: typeof req[k].title === 'string' ? req[k].title.slice(0, 200) : '', items: strs(req[k].items, 35, 90) };
    }
    if (req.mode === 'vk.start') {
      const state = String(req.state || '');
      const back = String(req.back || '');
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(state) || !/^(exps?|essola):\/\/[^\s"'<>]*$/.test(back)) return reply(400, { error: 'bad_request' });
      await cachePut(`vk/${state}.json`, iam, { back, at: Date.now() }, true);
      return reply(200, { ok: true });
    }
    if (req.mode === 'product') {
      const product = await cacheGet(keyFor(req), iam);
      return reply(200, { product });
    }
    // ---- Community: profiles, published recipes, follows, likes and comments (MVP: device id, no passwords) ----
    const uid = (x) => String(x || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
    const clean = (x, n) => String(x || '').replace(/[<>]/g, '').trim().slice(0, n);
    const get = async (k, def) => (await cacheGet(k, iam)) ?? def;
    const put = (k, v) => cachePut(k, iam, v, true);
    // Obscene words are refused in anything users publish (forum, comments, reviews, nicknames).
    const RUDE = /(^|[^а-яё])(х[уy][йияеёю]|п[иі]зд|[её]б[аеиоуы]|бля[дт]?|сук[аи]|муд[аио]к|г[ао]ндон|шлюх|пид[оа]р|уеб|долбо[её]б)/i;
    const rude = (t) => RUDE.test(String(t || '').toLowerCase());
    if (['forum.create', 'forum.reply', 'social.comment', 'user.save'].includes(req.mode) && (rude(req.text) || rude(req.title) || rude(req.nick))) {
      return reply(400, { error: 'rude' });
    }
    // ---- Accounts ----
    let sessionMemo;
    const sessionUid = async () => {
      if (sessionMemo !== undefined) return sessionMemo;
      const t = String(req.session || '');
      sessionMemo = null;
      if (t.length < 20) return null;
      const ses = await get(`sessions/${sha(t)}.json`, null);
      return (sessionMemo = ses && Date.now() - ses.at < 365 * 86400e3 ? ses.uid : null);
    };
    // Community identity. Signed in: the account id from the session (the id the client sends is ignored).
    // Guest: the id the client sends counts only with the secret that was first used with it (kept on the phone,
    // never shown to anyone). Public ids of authors are visible in the app, so the id alone proves nothing.
    let actorMemo;
    const actor = async () => {
      if (actorMemo !== undefined) return actorMemo;
      const me = await sessionUid();
      if (me) return (actorMemo = me);
      const id = uid(req.id);
      const secret = String(req.secret || '');
      // Account ids act only through a session; guests need their secret.
      if (!id || /^a[0-9a-f]{18}$/.test(id) || secret.length < 20) return (actorMemo = null);
      const k = `owners/${sha(id)}.json`;
      const own = await get(k, null);
      if (!own) {
        await put(k, { h: sha(secret), at: Date.now() });
        return (actorMemo = id);
      }
      return (actorMemo = own.h === sha(secret) ? id : null);
    };
    const NO_ACTOR = () => reply(401, { error: 'not_signed' });
    // ---- Daily limits on what costs money (model calls, web search): per account, else per device,
    // plus a looser one per network address so a reinstalled app doesn't reset them.
    // Free: 3 a day of each paid kind; Essola Club: 10. Product descriptions are cached for everyone and open with
    // every new product card, so they have their own, larger allowance.
    const LIMIT = Number(process.env.DAILY_LIMIT) || 3;
    const CLUB_LIMIT = 10;
    const DESCRIBE_LIMIT = [30, 100];
    const ip = String(event.requestContext?.identity?.sourceIp || h['x-forwarded-for'] || '').split(',')[0].trim();
    const allow = async (what, n = LIMIT, clubN = CLUB_LIMIT) => {
      if (await adminOk()) return true;
      const me = await sessionUid();
      // Essola Club members get the larger allowance.
      if (me && (await get(`accounts/${me}.json`, null))?.club) n = Math.max(n, clubN);
      const who = me ? `u:${me}` : uid(req.device) ? `d:${uid(req.device)}` : null;
      const checks = [who && [who, n], ip && [`ip:${ip}`, n * 4]].filter(Boolean);
      if (!checks.length) return false;
      // Reserve first, then count: every paid request writes its own small file, then lists the day's files.
      // Requests racing each other see one another's files, and the earliest ones win; the rest give their
      // place back. If the storage can't write or list, the paid call is refused.
      const stamp = `${String(Date.now()).padStart(14, '0')}-${crypto.randomBytes(4).toString('hex')}.json`;
      const dirs = checks.map(([w]) => `limits/${day()}/${sha(w)}/${what.replace(/[^a-z.]/gi, '')}/`);
      const release = () => Promise.all(dirs.map((d) => cacheDel(`${d}${stamp}`, iam)));
      const wrote = await Promise.all(dirs.map((d) => putStrict(`${d}${stamp}`, iam, {})));
      const lists = wrote.every(Boolean) ? await Promise.all(dirs.map((d) => listStrict(d, iam))) : [null];
      if (lists.some((l) => !l)) {
        await release();
        console.log('limit storage unavailable:', what);
        return false;
      }
      const over = lists.some((l, i) => {
        const sorted = [...l].sort();
        const pos = sorted.indexOf(`${dirs[i]}${stamp}`);
        return (pos < 0 ? sorted.length : pos) >= checks[i][1];
      });
      if (over) {
        await release();
        console.log('limit reached:', what, who || 'ip');
        return false;
      }
      return true;
    };
    // Admin: the session of an account whose email hash is listed, or the panel's token.
    let adminMemo;
    const adminOk = async () => {
      if (adminMemo !== undefined) return adminMemo;
      const token = String(req.admin || '');
      if (token && process.env.ADMIN_TOKEN) {
        // Wrong passwords are counted per address: after 20 a day the panel stays closed until tomorrow.
        const fk = `limits/${day()}/adminfail-${sha(ip)}.json`;
        const fails = (await get(fk, { n: 0 })).n;
        if (fails >= 20) return (adminMemo = false);
        if (crypto.timingSafeEqual(Buffer.from(sha(token)), Buffer.from(sha(process.env.ADMIN_TOKEN)))) return (adminMemo = true);
        await put(fk, { n: fails + 1 });
      }
      const me = await sessionUid();
      const acc = me ? await get(`accounts/${me}.json`, null) : null;
      return (adminMemo = !!acc?.email && ADMINS.includes(sha(String(acc.email).trim().toLowerCase())));
    };
    const signIn = async (provider, ext, info) => {
      const link = `accounts/by/${sha(`${provider}:${ext}`)}.json`;
      const known = await get(link, null);
      let acc = known?.uid ? await get(`accounts/${known.uid}.json`, null) : null;
      if (!acc) {
        acc = { uid: `a${crypto.randomBytes(9).toString('hex')}`, provider, email: info.email || null, name: info.name || null, nick: null, links: [link], sessions: [], createdAt: new Date().toISOString() };
        await put(link, { uid: acc.uid });
      }
      // Consent to personal data processing, given with a checkbox on the sign-in screen: when it was given.
      if (req.consent === true) {
        acc.consentAt = acc.consentAt || new Date().toISOString();
        acc.consentLast = new Date().toISOString();
      }
      if (!acc.email && info.email) acc.email = info.email;
      if (!acc.name && info.name) acc.name = info.name;
      const token = crypto.randomBytes(32).toString('base64url');
      acc.sessions = [...(acc.sessions || []), sha(token)].slice(-20);
      await put(`sessions/${sha(token)}.json`, { uid: acc.uid, at: Date.now() });
      await put(`accounts/${acc.uid}.json`, acc);
      const { links, sessions, ...pub } = acc;
      return reply(200, { session: token, account: pub, isNew: !known });
    };
    if (req.mode === 'auth.apple') {
      const a = await verifyApple(req.token).catch(() => null);
      if (!a) return reply(401, { error: 'bad_token' });
      return signIn('apple', a.id, { email: a.email, name: clean(req.name, 80) || null });
    }
    if (req.mode === 'auth.vk') {
      const v = await verifyVk(req.token).catch(() => null);
      if (!v) return reply(401, { error: 'bad_token' });
      return signIn('vk', v.id, v);
    }
    if (req.mode === 'auth.config') {
      // Email sign-in is offered once the sender domain is confirmed in Postbox (its DNS records are in place).
      const now = Date.now();
      if (!mailReady.at || now - mailReady.at > (mailReady.ok ? 6 * 3600e3 : 5 * 60e3)) {
        const r = await fetch(`https://postbox.cloud.yandex.net/v2/email/identities/${(process.env.MAIL_FROM || 'noreply@essola.ru').split('@')[1]}`, { headers: { 'X-YaCloud-SubjectToken': iam }, signal: AbortSignal.timeout(5000) }).catch(() => null);
        const j = r && r.ok ? await r.json().catch(() => ({})) : {};
        mailReady.ok = !!j.VerifiedForSendingStatus;
        mailReady.at = now;
      }
      return reply(200, { email: mailReady.ok });
    }
    if (req.mode === 'auth.email.start') {
      const email = String(req.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return reply(400, { error: 'bad_email' });
      const ck = `codes/${sha(email)}.json`;
      const prev = await get(ck, null);
      if (prev && Date.now() - prev.sentAt < 60e3) return reply(429, { error: 'too_often' });
      const code = String(crypto.randomInt(100000, 1000000));
      await put(ck, { hash: sha(`${email}:${code}`), exp: Date.now() + 10 * 60e3, tries: 0, sentAt: Date.now() });
      const sent = await sendCode(email, code, iam).then(() => true, () => false);
      return sent ? reply(200, { ok: true }) : reply(503, { error: 'mail_unavailable' });
    }
    if (req.mode === 'auth.email.verify') {
      const email = String(req.email || '').trim().toLowerCase();
      const ck = `codes/${sha(email)}.json`;
      const c = await get(ck, null);
      if (!c || c.exp < Date.now() || c.tries >= 5) return reply(400, { error: 'expired' });
      if (c.hash !== sha(`${email}:${String(req.code || '').trim()}`)) {
        await put(ck, { ...c, tries: c.tries + 1 });
        return reply(400, { error: 'wrong_code' });
      }
      await cacheDel(ck, iam);
      return signIn('email', email, { email, name: clean(req.name, 80) || null });
    }
    if (req.mode === 'me.get' || req.mode === 'me.save' || req.mode === 'data.get' || req.mode === 'data.put' || req.mode === 'account.delete' || req.mode === 'auth.logout') {
      const me = await sessionUid();
      if (!me) return reply(401, { error: 'no_session' });
      const acc = await get(`accounts/${me}.json`, null);
      if (!acc) return reply(401, { error: 'no_account' });
      if (req.mode === 'me.get') {
        const { links, sessions, ...pub } = acc;
        return reply(200, { account: pub });
      }
      if (req.mode === 'me.save') {
        for (const k of ['name', 'nick', 'skinType']) if (k in (req.patch || {})) acc[k] = clean(req.patch[k], 80) || null;
        if (Array.isArray(req.patch?.hair)) acc.hair = req.patch.hair.slice(0, 10).map((x) => clean(x, 20));
        if (acc.nick && rude(acc.nick)) return reply(400, { error: 'rude' });
        await put(`accounts/${me}.json`, acc);
        const { links, sessions, ...pub } = acc;
        return reply(200, { account: pub });
      }
      if (req.mode === 'data.get') return reply(200, { data: await get(`accounts/${me}/data.json`, {}) });
      if (req.mode === 'data.put') {
        const raw = JSON.stringify(req.data || {});
        if (raw.length > 3_000_000) return reply(413, { error: 'too_big' });
        await put(`accounts/${me}/data.json`, req.data || {});
        return reply(200, { ok: true });
      }
      if (req.mode === 'auth.logout') {
        await cacheDel(`sessions/${sha(String(req.session))}.json`, iam);
        return reply(200, { ok: true });
      }
      // account.delete: the sign-in links, sessions, synced data and the account itself.
      await Promise.all([...(acc.links || []).map((k) => cacheDel(k, iam)), ...(acc.sessions || []).map((h) => cacheDel(`sessions/${h}.json`, iam)), cacheDel(`accounts/${me}/data.json`, iam), cacheDel(`accounts/${me}.json`, iam)]);
      return reply(200, { ok: true });
    }
    if (req.mode === 'support.msg') {
      const email = String(req.email || '').trim().slice(0, 120);
      const text = clean(req.text, 3000);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || text.length < 3) return reply(400, { error: 'bad_message' });
      if (!(await allow('support', 10))) return reply(429, { error: 'limit' });
      const list = await get('support.json', []);
      await put('support.json', [{ at: new Date().toISOString(), email, text }, ...list].slice(0, 1000));
      return reply(200, { ok: true });
    }
    // ---- Reports, account deletion (App Store rules for apps with user content) ----
    if (req.mode === 'report') {
      const me = (await actor()) || 'anon';
      if (!(await allow('report', 30))) return reply(429, { error: 'limit' });
      const item = { at: new Date().toISOString(), from: me, kind: clean(req.kind, 20), target: clean(req.target, 120), author: uid(req.author), text: clean(req.text, 300), reason: clean(req.reason, 200) };
      const list = await get('reports.json', []);
      await put('reports.json', [item, ...list].slice(0, 2000));
      return reply(200, { ok: true });
    }
    if (req.mode === 'user.delete') {
      const me = await actor();
      if (!me) return NO_ACTOR();
      const prev = await get(`users/${me}.json`, null);
      // Profile, published recipes, followers and notifications are removed; forum posts stay but lose the name.
      await Promise.all([put(`users/${me}.json`, { id: me, nick: 'удалённый пользователь', deleted: true }), put(`users/${me}/recipes.json`, []), put(`users/${me}/followers.json`, []), put(`notif/${me}.json`, [])]);
      if (prev?.nick) {
        const nicks = await get('nicks.json', {});
        delete nicks[String(prev.nick).toLowerCase()];
        await put('nicks.json', nicks);
      }
      const feed = await get('community/recent.json', []);
      await put('community/recent.json', feed.filter((x) => x.user?.id !== me));
      const idx = await get('forum/index.json', []);
      for (const row of idx) {
        const t = await get(`forum/t/${row.id}.json`, null);
        if (!t) continue;
        let changed = false;
        if (t.author?.id === me) {
          t.author = { id: 'deleted', nick: 'удалённый пользователь' };
          changed = true;
        }
        for (const p of t.posts) {
          if (p.author?.id === me) {
            p.author = { id: 'deleted', nick: 'удалённый пользователь' };
            changed = true;
          }
        }
        if (changed) await put(`forum/t/${row.id}.json`, t);
      }
      await put('forum/index.json', idx.map((r) => (r.author?.id === me ? { ...r, author: { id: 'deleted', nick: 'удалённый пользователь' } } : r)));
      return reply(200, { ok: true });
    }
    if (req.mode === 'user.save') {
      const id = await actor();
      if (!id) return NO_ACTOR();
      const prev = await get(`users/${id}.json`, {});
      let nick = clean(req.nick, 24) || prev.nick || 'user';
      if (/^essola/i.test(nick)) nick = `${nick}_`;
      const user = { ...prev, id, nick, name: clean(req.name, 60) || prev.name || '', bio: clean(req.bio, 160) || prev.bio || '' };
      await put(`users/${id}.json`, user);
      // nick → id, for @mentions in the forum
      // @mentions of a nick already taken by someone else keep going to its first owner.
      const nicks = await get('nicks.json', {});
      if (!nicks[nick.toLowerCase()]) await put('nicks.json', { ...nicks, [nick.toLowerCase()]: id });
      return reply(200, { user });
    }
    if (req.mode === 'user.get') {
      const id = uid(req.id);
      const [user, recipes, followers, follows] = await Promise.all([get(`users/${id}.json`, null), get(`users/${id}/recipes.json`, []), get(`users/${id}/followers.json`, []), get(`users/${id}/following.json`, [])]);
      return reply(200, { user, recipes, followers: followers.length, follows: follows.length, following: followers.includes(uid(req.viewer)) });
    }
    if (req.mode === 'recipe.publish') {
      const id = await actor();
      if (!id) return NO_ACTOR();
      const r = req.recipe || {};
      if (!r.id || !r.title) return reply(400, { error: 'bad_recipe' });
      const user = await get(`users/${id}.json`, { id, nick: 'user' });
      const recipe = JSON.parse(JSON.stringify(r).slice(0, 20000));
      const mine = (await get(`users/${id}/recipes.json`, [])).filter((x) => x.id !== recipe.id);
      await put(`users/${id}/recipes.json`, [recipe, ...mine].slice(0, 100));
      const feed = (await get('community/recent.json', [])).filter((x) => x.recipe?.id !== recipe.id);
      await put('community/recent.json', [{ user: { id, nick: user.nick, name: user.name }, recipe, at: new Date().toISOString() }, ...feed].slice(0, 150));
      return reply(200, { ok: true });
    }
    if (req.mode === 'community.recent') {
      return reply(200, { items: await get('community/recent.json', []) });
    }
    if (req.mode === 'follow') {
      const me = await actor();
      const target = uid(req.target);
      if (!me || !target || me === target) return reply(400, { error: 'bad_follow' });
      const list = (await get(`users/${target}/followers.json`, [])).filter((x) => x !== me);
      if (req.on) list.push(me);
      await put(`users/${target}/followers.json`, list);
      const mine = (await get(`users/${me}/following.json`, [])).filter((x) => x !== target);
      if (req.on) mine.push(target);
      await put(`users/${me}/following.json`, mine);
      return reply(200, { followers: list.length, following: !!req.on });
    }
    // ---- Essola Club: free for now; membership lives on the account, the monthly promo code is set in the admin panel ----
    if (req.mode === 'club.get' || req.mode === 'club.join' || req.mode === 'club.leave') {
      const me = await sessionUid();
      const terms = { limit: LIMIT, club: CLUB_LIMIT, describe: DESCRIBE_LIMIT[0], describeClub: DESCRIBE_LIMIT[1], price: 0 };
      if (!me) return reply(200, { member: false, signedIn: false, terms });
      const acc = await get(`accounts/${me}.json`, null);
      if (!acc) return reply(401, { error: 'no_account' });
      if (req.mode !== 'club.get') {
        acc.club = req.mode === 'club.join' ? acc.club || { since: new Date().toISOString() } : null;
        await put(`accounts/${me}.json`, acc);
        // The badge on the public profile.
        const pub = await get(`users/${me}.json`, null);
        if (pub) await put(`users/${me}.json`, { ...pub, club: !!acc.club });
        const members = (await get('club/members.json', [])).filter((x) => x !== me);
        if (acc.club) members.push(me);
        await put('club/members.json', members);
      }
      const promo = acc.club ? await get('club/promo.json', null) : null;
      return reply(200, { member: !!acc.club, since: acc.club?.since || null, signedIn: true, terms, promo: promo && promo.code ? promo : null });
    }
    // ---- Admin panel: spending, reports ----
    if (req.mode === 'admin.check' || req.mode === 'admin.stats' || req.mode === 'admin.reports' || req.mode === 'editorial.remove' || req.mode === 'admin.club' || req.mode === 'admin.promo') {
      if (!(await adminOk())) return reply(403, { error: 'not_admin' });
      if (req.mode === 'admin.check') return reply(200, { ok: true });
      if (req.mode === 'admin.reports') return reply(200, { items: (await get('reports.json', [])).slice(0, 300), support: (await get('support.json', [])).slice(0, 300) });
      if (req.mode === 'admin.club') return reply(200, { members: (await get('club/members.json', [])).length, promo: await get('club/promo.json', null) });
      if (req.mode === 'admin.promo') {
        const promo = clean(req.code, 40) ? { code: clean(req.code, 40), text: clean(req.text, 200), until: clean(req.until, 10), at: new Date().toISOString() } : null;
        await put('club/promo.json', promo);
        return reply(200, { promo });
      }
      if (req.mode === 'editorial.remove') {
        const next = (await get('editorial.json', [])).filter((r) => r.id !== String(req.id || ''));
        await put('editorial.json', next);
        return reply(200, { count: next.length });
      }
      // Spending of every function instance, added up per day and kind of request.
      await flushStats(iam, true);
      const n = Math.min(Math.max(Number(req.days) || 30, 1), 120);
      const days = [...Array(n)].map((_, i) => new Date(Date.now() + 3 * 3600e3 - (n - 1 - i) * 86400e3).toISOString().slice(0, 10));
      const out = await Promise.all(
        days.map(async (d) => {
          const files = await cacheList(`stats/${d}/`, iam);
          const parts = await Promise.all(files.map((k) => cacheGet(k, iam)));
          const modes = {};
          for (const p of parts) for (const [m, v] of Object.entries(p || {})) {
            const t = (modes[m] ??= { calls: 0, tokens: 0, rub: 0, search: 0 });
            for (const f of ['calls', 'tokens', 'rub', 'search']) t[f] += Number(v[f]) || 0;
          }
          return { day: d, modes, rub: Object.values(modes).reduce((a, v) => a + v.rub, 0) };
        }),
      );
      const [letuList, obf] = await Promise.all([loadLetu(iam), loadCatalog(iam)]);
      return reply(200, { days: out, base: { total: letuList.length + obf.length, letu: letuList.length, obf: obf.length } });
    }
    // Recipes the admin imported from a table, shown to everyone next to the built-in editorial ones.
    if (req.mode === 'editorial.list') {
      return reply(200, { items: await get('editorial.json', []) });
    }
    if (req.mode === 'editorial.add') {
      if (!(await adminOk())) return reply(403, { error: 'not_admin' });
      const incoming = (Array.isArray(req.recipes) ? req.recipes : []).filter((r) => r && r.id && r.title && Array.isArray(r.ingredients)).slice(0, 500);
      const list = await get('editorial.json', []);
      const ids = new Set(incoming.map((r) => r.id));
      const next = [...incoming.map((r) => ({ ...r, own: false, editorial: true, photo: undefined })), ...list.filter((r) => !ids.has(r.id))].slice(0, 3000);
      await put('editorial.json', next);
      return reply(200, { count: next.length });
    }
    // Forum: an index of topics (newest activity first) plus one file per topic with its replies.
    // ---- Forum: topics, threaded replies, likes, the official @essola account and notifications ----
    const official = req.official ? await adminOk() : false;
    const ESSOLA = { id: 'essola', nick: 'essola' };
    // Who is writing: the admin may post as @essola; nobody else may take that name.
    const authorOf = (me) => {
      if (official) return ESSOLA;
      const nick = clean(req.nick, 24) || 'гость';
      return { id: me, nick: /^essola/i.test(nick) ? `${nick}_` : nick };
    };
    const SEED = (() => {
      try {
        return require('./forum-seed.json');
      } catch {
        return [];
      }
    })();
    const rowOf = (t) => ({ id: t.id, title: t.title, cat: t.cat, author: t.author, at: t.at, last: t.posts.length ? t.posts[t.posts.length - 1].at : t.at, replies: t.posts.length, likes: (t.likes || []).length, preview: String(t.text || '').slice(0, 160) });
    const loadTopic = async (tid) => {
      const seed = SEED.find((x) => x.id === tid);
      return (await get(`forum/t/${tid}.json`, null)) || (seed ? JSON.parse(JSON.stringify(seed)) : null);
    };
    const saveTopic = async (t) => {
      await put(`forum/t/${t.id}.json`, t);
      const idx = await get('forum/index.json', []);
      await put('forum/index.json', [rowOf(t), ...idx.filter((x) => x.id !== t.id)].slice(0, 5000));
    };
    const notify = async (to, n) => {
      if (!to || to === 'essola') return;
      const list = await get(`notif/${to}.json`, []);
      await put(`notif/${to}.json`, [{ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: new Date().toISOString(), ...n }, ...list].slice(0, 100));
    };
    if (req.mode === 'forum.list') {
      const idx = await get('forum/index.json', []);
      const have = new Set(idx.map((x) => x.id));
      let list = [...idx, ...SEED.filter((t) => !have.has(t.id)).map(rowOf)].sort((a, b) => (a.last < b.last ? 1 : -1));
      if (req.cat) list = list.filter((t) => t.cat === req.cat);
      const page = Math.max(Number(req.page) || 1, 1);
      return reply(200, { items: list.slice((page - 1) * 40, page * 40), total: list.length });
    }
    if (req.mode === 'forum.get') {
      const t = await loadTopic(clean(req.tid, 40));
      return reply(t ? 200 : 404, t ? { topic: t } : { error: 'not_found' });
    }
    if (req.mode === 'forum.create') {
      const me = await actor();
      if (!me) return NO_ACTOR();
      await ensureUser(get, put, me, req.nick);
      const title = clean(req.title, 120);
      const text = clean(req.text, 4000);
      if (!me || title.length < 4) return reply(400, { error: 'bad_topic' });
      const at = new Date().toISOString();
      const tid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const t = { id: tid, title, text, cat: clean(req.cat, 30) || 'Общее', author: authorOf(me), at, likes: [], posts: [] };
      await saveTopic(t);
      return reply(200, { id: tid });
    }
    if (req.mode === 'forum.reply') {
      const me = await actor();
      if (!me) return NO_ACTOR();
      await ensureUser(get, put, me, req.nick);
      const text = clean(req.text, 3000);
      const t = await loadTopic(clean(req.tid, 40));
      if (!me || !t || !text) return reply(400, { error: 'bad_reply' });
      const parent = t.posts.find((p) => p.id === clean(req.parent, 20)) || null;
      const author = authorOf(me);
      const post = { id: Date.now().toString(36), parent: parent ? parent.id : null, author, text, at: new Date().toISOString(), likes: [] };
      t.posts = [...t.posts, post].slice(-1000);
      await saveTopic(t);
      // Notifications: the topic's author, the author of the post replied to, and everyone @mentioned.
      const snippet = text.slice(0, 140);
      const sent = new Set([author.id]);
      const send = async (to, type) => {
        if (!to || sent.has(to)) return;
        sent.add(to);
        await notify(to, { type, tid: t.id, title: t.title, from: author.nick, text: snippet });
      };
      if (parent) await send(parent.author.id, 'reply');
      await send(t.author.id, 'topic');
      const nicks = await get('nicks.json', {});
      for (const m of text.matchAll(/@([\p{L}\d_.-]{2,24})/gu)) await send(nicks[m[1].toLowerCase()], 'mention');
      return reply(200, { topic: t });
    }
    if (req.mode === 'forum.like') {
      const me = await actor();
      const t = await loadTopic(clean(req.tid, 40));
      if (!me || !t) return reply(400, { error: 'bad_like' });
      const pid = clean(req.pid, 20);
      const target = pid ? t.posts.find((p) => p.id === pid) : t;
      if (!target) return reply(404, { error: 'not_found' });
      target.likes = (target.likes || []).filter((x) => x !== me);
      if (req.on) target.likes.push(me);
      await saveTopic(t);
      if (req.on && target.author && target.author.id !== me) await notify(target.author.id, { type: 'like', tid: t.id, title: t.title, from: clean(req.nick, 24) || 'кто-то', text: pid ? String(target.text).slice(0, 100) : '' });
      return reply(200, { topic: t });
    }
    // ---- Stories on the home screen: posted by the admin, shown to everyone ----
    if (req.mode === 'stories.list') {
      return reply(200, { items: await get('stories.json', []) });
    }
    if (req.mode === 'stories.add') {
      if (!(await adminOk())) return reply(403, { error: 'not_admin' });
      const img = String(req.image || '');
      if (!/^[A-Za-z0-9+/=]+$/.test(img) || img.length > 900000) return reply(400, { error: 'bad_image' });
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      await put(`stories/img/${id}.json`, { data: img });
      const item = { id, title: clean(req.title, 40) || 'essola', text: clean(req.text, 300), link: clean(req.link, 200), at: new Date().toISOString() };
      await put('stories.json', [item, ...(await get('stories.json', []))].slice(0, 50));
      return reply(200, { item });
    }
    if (req.mode === 'stories.remove') {
      if (!(await adminOk())) return reply(403, { error: 'not_admin' });
      await put('stories.json', (await get('stories.json', [])).filter((x) => x.id !== clean(req.sid, 20)));
      return reply(200, { ok: true });
    }
    if (req.mode === 'stories.img') {
      const x = await get(`stories/img/${clean(req.sid, 20)}.json`, null);
      return reply(x ? 200 : 404, x || { error: 'not_found' });
    }
    if (req.mode === 'notif.list') {
      const me = await actor();
      return reply(200, { items: me ? await get(`notif/${me}.json`, []) : [] });
    }
    if (req.mode === 'social.get' || req.mode === 'social.like' || req.mode === 'social.comment' || req.mode === 'social.rate') {
      const key = `social/${crypto.createHash('sha1').update(String(req.key || '')).digest('hex')}.json`;
      // Reading shows «mine» for the claimed id; writing needs a proven one.
      const me = req.mode === 'social.get' ? uid(req.id) : await actor();
      if (req.mode !== 'social.get' && !me) return NO_ACTOR();
      const data = await get(key, { likes: [], comments: [] });
      if (req.mode === 'social.like' && me) {
        data.likes = data.likes.filter((x) => x !== me);
        if (req.on) data.likes.push(me);
        await put(key, data);
      }
      // Product reviews: one per person (a new one replaces the old), with the person's stars next to it.
      const product = String(req.key || '').startsWith('product:');
      if (req.mode === 'social.comment' && me && clean(req.text, 500)) {
        await ensureUser(get, put, me, req.nick);
        const n = Math.round(Number(req.stars));
        if (product && n >= 1 && n <= 5) data.rates = { ...(data.rates || {}), [me]: n };
        const prev = product ? data.comments.filter((c) => c.user !== me) : data.comments;
        data.comments = [...prev, { id: Date.now().toString(36), user: me, nick: clean(req.nick, 24) || 'user', text: clean(req.text, 500), at: new Date().toISOString() }].slice(-200);
        await put(key, data);
      }
      if (req.mode === 'social.rate' && me) {
        const n = Math.round(Number(req.stars));
        if (n >= 1 && n <= 5) {
          data.rates = { ...(data.rates || {}), [me]: n };
          await put(key, data);
        }
      }
      const votes = Object.values(data.rates || {});
      const rating = { avg: votes.length ? Math.round((votes.reduce((a, b) => a + b, 0) / votes.length) * 10) / 10 : 0, count: votes.length, mine: (data.rates || {})[me] || 0 };
      return reply(200, { likes: data.likes.length, liked: data.likes.includes(me), comments: data.comments.slice(-50).map((c) => ({ ...c, stars: (data.rates || {})[c.user] || 0 })), rating });
    }
    if (req.mode === 'catalog') {
      // Ready-made catalog built weekly by CI (scripts/build-catalog.ts), kept warm between calls.
      const [obf, letuList] = await Promise.all([loadCatalog(iam), loadLetu(iam)]);
      const words = String(req.q || '').toLowerCase().split(/\s+/).filter((w) => w.length > 1);
      // Without a text query the filtered and sorted list is kept in memory: switching sort or paging is instant.
      const ing = String(req.ing || '').replace(/[^a-z0-9-]/g, '').slice(0, 80);
      const withIng = ing ? await ingrList(ing, iam) : null;
      const memoKey = !words.length && `${letuList.length}|${obf.length}|${req.cat || ''}|${req.sort || ''}|${ing}`;
      let list = memoKey && sortedMemo.get(memoKey);
      if (!list) {
        // Letual first: Russian shelf products the users actually buy; then Open Beauty Facts.
        list = [...letuList, ...obf];
        if (withIng) list = list.filter((x) => withIng.has(x.k));
        if (req.cat) list = list.filter((x) => x.c === req.cat);
        if (words.length) list = keywordSearch(list, String(req.q));
        // Products without a published composition (z) have no score: they go last when sorting by score.
        if (req.sort === 'best') list = [...list].sort((a, b) => (a.z || 0) - (b.z || 0) || b.s - a.s);
        else if (req.sort === 'worst') list = [...list].sort((a, b) => (a.z || 0) - (b.z || 0) || a.s - b.s);
        if (memoKey) {
          if (sortedMemo.size > 60) sortedMemo.clear();
          sortedMemo.set(memoKey, list);
        }
      }
      const size = Math.min(Number(req.size) || 40, 40);
      const page = Math.max(Number(req.page) || 1, 1);
      return reply(200, { items: await withCompositions(list.slice((page - 1) * size, page * size).map(({ g, _h, _score, ...x }) => x), iam), total: list.length });
    }
    if (req.mode === 'match') {
      // «Подбор средств»: catalog cards filtered by category, goal tags (any) and free-from tags (all), computed at build time.
      const cats = new Set((req.cats || []).map(String));
      const goals = String(req.goals || '').replace(/[^A-Z]/g, '');
      const free = String(req.free || '').replace(/[^a-z]/g, '');
      const base = await loadLetu(iam);
      // Before the catalog has been rebuilt with tags, filter by category only and let the app check the compositions.
      const tagged = base.some((x) => x.m);
      // Chosen ingredients: the product must contain all of them (lists built by CI, see ingrList).
      const ingSlugs = (Array.isArray(req.ings) ? req.ings : []).map((x) => String(x).replace(/[^a-z0-9-]/g, '').slice(0, 80)).filter(Boolean).slice(0, 6);
      const ingSets = await Promise.all(ingSlugs.map((x) => ingrList(x, iam)));
      let list = base.filter((x) => !x.z && (!tagged || x.m) && (!cats.size || cats.has(x.c)) && ingSets.every((set) => set.has(x.k)));
      if (tagged && goals) list = list.filter((x) => [...goals].some((g) => x.m.includes(g)));
      if (tagged && free) list = list.filter((x) => [...free].every((f) => x.m.includes(f)));
      // How many of the chosen goals a product covers comes first, then the chosen order.
      const cover = (x) => (goals && x.m ? [...goals].filter((g) => x.m.includes(g)).length : 0);
      if (req.sort === 'rating') list = [...list].sort((a, b) => cover(b) - cover(a) || (b.r || 0) - (a.r || 0) || b.p - a.p);
      else if (req.sort === 'popular') list = [...list].sort((a, b) => cover(b) - cover(a) || b.p - a.p);
      else list = [...list].sort((a, b) => cover(b) - cover(a) || b.s - a.s || b.p - a.p);
      const size = Math.min(Number(req.size) || 30, 40);
      const page = Math.max(Number(req.page) || 1, 1);
      const items = await withCompositions(list.slice((page - 1) * size, page * size).map(({ g, _h, _score, ...x }) => x), iam);
      return reply(200, { items, total: list.length, untagged: !tagged });
    }
    if (req.mode === 'similar') {
      // Analogs by composition from our Letual base: overlap of the composition fingerprints
      // (first meaningful ingredients, earlier positions weigh more).
      const q = String(req.g || '').split('.').filter(Boolean).slice(0, 16);
      if (q.length < 2) return reply(200, { items: [] });
      const w = (i) => 1 / (1 + i * 0.18);
      const qw = new Map(q.map((h, i) => [h, w(i)]));
      const qTotal = q.reduce((a, _, i) => a + w(i), 0);
      const skip = String(req.k || '');
      const scored = [];
      for (const x of await loadLetu(iam)) {
        if (!x.g || x.k === skip) continue;
        const g = x.g.split('.');
        let common = 0;
        let cTotal = 0;
        const hit = [];
        g.forEach((h, i) => {
          cTotal += w(i);
          const v = qw.get(h);
          if (v) {
            common += (v + w(i)) / 2;
            hit.push(h);
          }
        });
        if (hit.length < 2) continue;
        const sim = (2 * common) / (qTotal + cTotal);
        if (sim >= 0.3) scored.push({ x, sim, hit });
      }
      scored.sort((a, b) => b.sim - a.sim || b.x.p - a.x.p);
      // One card per product name: the same cream in several volumes would fill the list.
      const seenTitles = new Set();
      const top = [];
      for (const s of scored) {
        const t = `${s.x.b}|${s.x.t}`.toLowerCase();
        if (seenTitles.has(t)) continue;
        seenTitles.add(t);
        top.push(s);
        if (top.length >= 8) break;
      }
      const withX = await withCompositions(top.map(({ x: { g, _h, _score, ...x } }) => x), iam);
      return reply(200, { items: withX.map((x, i) => ({ ...x, match: Math.round(top[i].sim * 100), common: top[i].hit })) });
    }
    if (req.mode === 'cosing') {
      // EU facts for a composition: functions and Annex entries (banned, restricted, allowed colourants/preservatives/UV filters).
      const db = await loadCosing(iam);
      const items = {};
      for (const name of (Array.isArray(req.names) ? req.names : []).slice(0, 150)) {
        const key = cosingKeys(name).find((k) => db[k]);
        if (key) items[String(name).slice(0, 120)] = db[key];
      }
      return reply(200, { items });
    }
    if (req.mode === 'search') {
      return reply(200, { items: await searchCache(req.q, iam) });
    }
    if (req.mode === 'nk') {
      // «Честный знак»: the GTIN from the DataMatrix code → the published card in the National Catalog
      // (official API with the participant's key), its composition if the maker filled it in.
      const gtin = String(req.gtin || '').replace(/\D/g, '').padStart(14, '0').slice(-14);
      if (!/^\d{14}$/.test(gtin) || /^0+$/.test(gtin)) return reply(400, { error: 'bad_gtin' });
      const ck = `nk/${gtin}.json`;
      const hit = await cacheGet(ck, iam);
      if (hit) return reply(200, hit);
      // Our own bases first: a composition someone already matched to this code, then Open Beauty Facts.
      const ean = gtin.replace(/^0/, '');
      const codes = [...new Set([ean, gtin, gtin.replace(/^0+/, '')])];
      for (const c of codes) {
        const mine = await cacheGet(keyFor({ barcode: c }), iam);
        if (mine?.ingredients?.length >= 3) return reply(200, { found: true, gtin, title: mine.title || '', brand: '', ingredients: mine.ingredients, source: 'essola' });
      }
      const obfHit = (await loadCatalog(iam)).find((x) => codes.includes(String(x.k)));
      if (obfHit?.x) return reply(200, { found: true, gtin, item: (({ g, _h, _score, ...x }) => x)(obfHit), title: obfHit.t, brand: obfHit.b, ingredients: [] });
      if (!process.env.NK_API_KEY) return reply(200, { found: false, reason: 'no_key' });
      const nkUrl = `https://xn--80aqu.xn----7sbabas4ajkhfocclk9d3cvfsa.xn--p1ai/v3/product?gtin=${gtin}&apikey=${encodeURIComponent(process.env.NK_API_KEY)}`;
      // The catalog sometimes drops a connection (one quick retry) and can hang on unknown codes: then we move on.
      let res = await fetch(nkUrl, { signal: AbortSignal.timeout(6000) }).catch((e) => ({ ok: false, status: String(e) }));
      if (!res.ok && /fetch failed|ECONNRESET/.test(String(res.status))) res = await fetch(nkUrl, { signal: AbortSignal.timeout(6000) }).catch((e) => ({ ok: false, status: String(e) }));
      if (!res.ok) console.log('nk http', res.status);
      const json = res.ok ? await res.json().catch(() => null) : null;
      const card = Array.isArray(json?.result) ? json.result[0] : json?.result || (json?.good_name ? json : null);
      const attrs = [...(card?.good_attrs || []), ...(card?.attrs || [])];
      const val = (re) => attrs.find((a) => re.test(String(a.attr_name || a.name || '')))?.attr_value ?? attrs.find((a) => re.test(String(a.attr_name || a.name || '')))?.value;
      const title = String(card?.good_name || val(/наименование/i) || '').trim();
      const brand = String(card?.brand_name || val(/товарный знак|бренд/i) || '').trim();
      const comp = String(val(/состав|ингредиент/i) || '').trim();
      const ingredients = comp ? comp.replace(/^[^:]{0,30}:\s*/, '').split(/\s*[,;]\s*/).map((x) => x.replace(/[.\s]+$/, '').trim()).filter((x) => x.length > 1 && x.length < 90) : [];
      console.log('nk card:', gtin, !!card, title.slice(0, 60), 'ingredients', ingredients.length);
      // Not every maker fills in the composition: then the name goes on to our base and the web.
      let out = { found: !!card, gtin, title, brand, ingredients };
      // Not in the catalog (an ordinary barcode of an unmarked product): its name from the web, by the code.
      const webOk = async () => allow('web');
      if (!card) {
        const docs = (await webOk()) ? await search(ean, iam).catch(() => []) : [];
        const named = docs.map((d) => d.title.replace(/\s*[|—–-]\s*(купить|цена|отзывы|интернет-магазин|ozon|озон|wildberries|вайлдберриз|яндекс маркет|золотое яблоко|летуаль).*$/i, '').replace(new RegExp(ean, 'g'), '').trim()).find((t) => t.length > 5 && !/штрих|barcode|ean|gtin|код товара/i.test(t));
        if (named) out = { ...out, title: named };
      }
      if (out.ingredients.length < 3 && out.title) {
        const more = await findByLabel(out.brand, out.title, '', iam, textModel, webOk, () => allow('pick', DESCRIBE_LIMIT[0], DESCRIBE_LIMIT[1])).catch(() => ({}));
        out = { ...out, ...more };
      }
      if (card || out.item || out.ingredients.length >= 3) await cachePut(ck, iam, out, true).catch(() => {});
      return reply(200, out);
    }
    if (req.mode === 'barcode.web') {
      // Unknown barcode: search the web (marketplaces, shops, barcode catalogs) for the product name.
      const code = String(req.barcode || '').replace(/\D/g, '');
      if (code.length < 8) return reply(400, { error: 'bad_barcode' });
      const cached = await cacheGet(`bcweb/${code}.json`, iam);
      if (cached) return reply(200, cached);
      if (!(await allow('web'))) return reply(429, { error: 'limit' });
      const docs = await search(`${code}`, iam).catch(() => []);
      const clean = (t) =>
        t
          .replace(/\s*[|—–-]\s*(купить|цена|отзывы|интернет-магазин|ozon|озон|wildberries|вайлдберриз|яндекс маркет|золотое яблоко|летуаль|магнит косметик|подружка|рив гош).*$/i, '')
          .replace(/^(купить|отзывы о|отзывы на)\s+/i, '')
          .replace(new RegExp(code, 'g'), '')
          .replace(/\s+/g, ' ')
          .trim();
      const titles = docs.map((d) => clean(d.title)).filter((t) => t.length > 5 && !/штрих|barcode|ean|gtin|код товара/i.test(t)).slice(0, 6);
      const out = { name: titles[0] || null, titles, shops: docs.slice(0, 5).map((d) => ({ url: d.url, title: d.title })) };
      if (out.name) await cachePut(`bcweb/${code}.json`, iam, out).catch(() => {});
      return reply(200, out);
    }
    if (req.mode === 'barcode.save') {
      // A barcode someone matched to a composition (photo or a product from our base): remembered for everyone.
      const ingredients = (req.ingredients || []).filter((x) => typeof x === 'string' && x.length > 1 && x.length < 90).slice(0, 80);
      const code = String(req.barcode || '').replace(/\D/g, '');
      if (code.length < 8 || !(await plausibleList(ingredients, iam))) return reply(400, { error: 'bad_product' });
      const who = await actor();
      if (!who || !(await allow('submit', 30))) return reply(429, { error: 'limit' });
      const done = await userSubmit(keyFor({ barcode: code }), iam, sha(`${who}|${ip}`), { title: String(req.title || '').slice(0, 200), ingredients, source: 'essola' });
      return reply(200, { ok: true, done });
    }
    if (req.mode === 'save') {
      // A composition the user's phone read from a shop page: keep it for everyone.
      const ingredients = (req.ingredients || []).filter((x) => typeof x === 'string' && x.length > 1 && x.length < 90).slice(0, 80);
      let host0 = '';
      try {
        host0 = new URL(String(req.url)).hostname;
      } catch {}
      if (!/(^|\.)(letu\.ru|goldapple\.ru|wildberries\.[a-z]{2,3}|wb\.ru|ozon\.[a-z]{2,3})$/i.test(host0) || !(await plausibleList(ingredients, iam))) return reply(400, { error: 'bad_product' });
      const who = await actor();
      if (!who || !(await allow('submit', 30))) return reply(429, { error: 'limit' });
      const done = await userSubmit(keyFor({ url: req.url }), iam, sha(`${who}|${ip}`), { title: String(req.title || '').slice(0, 200), url: req.url, ingredients, source: 'shop' });
      if (done === 'kept') return reply(200, { ok: true, done });
      const host = (() => { try { return new URL(req.url).hostname.replace(/^www\./, ''); } catch { return 'shop'; } })();
      await shopAdd(iam, keyFor({ url: req.url }), String(req.title || '').slice(0, 200), String(req.image || '').slice(0, 400) || null, ingredients, host, clean(req.brand, 60), req.url).catch(() => {});
      return reply(200, { ok: true });
    }
    if (req.mode === 'byname') {
      // A product name read from a shop page → the same product in our base (same brand, most words in common).
      const name = clean(req.name, 300);
      if (keywords(name).length < 2) return reply(200, {});
      const base = await loadLetu(iam);
      const brandWord = keywords(clean(req.brand, 80) || name)[0] || '';
      const brandVars = variants(brandWord);
      const sameBrand = (x) => brandVars.some((v) => norm(x.b).replace(/ /g, '').includes(v.replace(/ /g, '')) || ` ${norm(x.t)} `.includes(` ${v} `));
      const seenT = new Set();
      console.log('byname', name.slice(0, 90), req.web ? 'web' : '');
      const found = keywordSearch(base, `${clean(req.brand, 80)} ${name}`, 0.7).filter((x) => !x.z && sameBrand(x) && !seenT.has(norm(x.t)) && seenT.add(norm(x.t))).slice(0, 3);
      if (found[0] && found[0]._score >= 0.75 && (found.length === 1 || found[1]._score < found[0]._score)) {
        const [item] = await withCompositions([(({ g, _h, _score, ...x }) => x)(found[0])], iam);
        return reply(200, { item });
      }
      // The shop page gave only the name: look for the composition on the web (same daily limit as other web searches).
      if (req.web) {
        const brand = clean(req.brand, 80);
        const more = await findByLabel(brand || brandWord, brand ? name : name.split(' ').slice(1).join(' '), '', iam, textModel, () => allow('web'), () => allow('pick', DESCRIBE_LIMIT[0], DESCRIBE_LIMIT[1])).catch(() => ({}));
        if (more.item?.x || more.ingredients?.length) return reply(200, more);
      }
      return reply(200, {});
    }
    if (req.mode === 'link') {
      // Wildberries / Ozon / Gold Apple link: the shop's composition when it is open, otherwise the product
      // found in our base by the words of its name (or of the link), then the web.
      // Someone already read this page in the app: the saved composition answers at once.
      // (Wildberries answers from its own card, which is always current — no cache for it.)
      const isWb = /wildberries\.|(^|\/\/|\.)wbx?\.ru/i.test(String(req.url || ''));
      const seen = isWb ? null : await cacheGet(keyFor({ url: String(req.url || '') }), iam);
      if (seen?.ingredients?.length >= 3) return reply(200, { shop: 'cache', title: seen.title, ingredients: seen.ingredients });
      const info = await fromMarketplace(String(req.url || ''));
      if (!info) return reply(400, { error: 'unsupported_shop' });
      console.log('link', info.shop, String(info.title || '').slice(0, 90), 'composition', String(info.composition || '').length);
      const list = info.composition ? info.composition.replace(/^[^:]{0,30}:\s*/, '').split(/\s*[,;]\s*/).map((x) => x.replace(/[.\s]+$/, '').trim()).filter((x) => x.length > 1 && x.length < 90) : [];
      // The seller's own card is the product itself: its composition counts even when short («масло ши 100%»),
      // a similar product from the base or the web would be a different one.
      if (list.length >= 4 || (info.shop === 'wb' && list.length >= 1)) {
        // A product read from the seller's card joins the shared base (the daily catalog build scores it).
        if (info.title) await shopAdd(iam, keyFor({ url: info.url || String(req.url || '') }), info.title, info.image || '', list, info.shop, info.brand, info.url || String(req.url || '')).catch(() => {});
        return reply(200, { shop: info.shop, title: info.title, brand: info.brand, ingredients: list });
      }
      const name = [info.brand, info.title].filter(Boolean).join(' ');
      if (!name) return reply(200, { shop: info.shop, none: true });
      const base = await loadLetu(iam);
      // A link names the brand first (Ozon slug: «epilprofi uvlazhnyayushchiy krem…»): a candidate of another brand
      // is a different product, however similar the words.
      const brandWord = keywords(info.brand || info.title || '')[0] || '';
      const brandVars = variants(brandWord);
      const sameBrand = (x) => !brandWord || brandVars.some((v) => norm(x.b).replace(/ /g, '').includes(v.replace(/ /g, '')) || ` ${norm(x.t)} `.includes(` ${v} `));
      // The same product listed twice (another volume or a re-listing) counts once.
      const seenT = new Set();
      const found = keywordSearch(base, name).filter((x) => !x.z && sameBrand(x) && !seenT.has(norm(x.t)) && seenT.add(norm(x.t))).slice(0, 5);
      if (found[0] && (found.length === 1 || (found[0]._score >= 0.8 && found[1]._score < found[0]._score))) {
        const [item] = await withCompositions([(({ g, _h, _score, ...x }) => x)(found[0])], iam);
        return reply(200, { shop: info.shop, title: info.title, brand: info.brand, item });
      }
      if (found.length) {
        const items = await withCompositions(found.map(({ g, _h, _score, ...x }) => x), iam);
        return reply(200, { shop: info.shop, title: info.title, brand: info.brand, candidates: items });
      }
      const more = await findByLabel(info.brand || brandWord, info.brand ? info.title || '' : (info.title || '').split(' ').slice(1).join(' '), '', iam, textModel, () => allow('web'), () => allow('pick', DESCRIBE_LIMIT[0], DESCRIBE_LIMIT[1])).catch(() => ({}));
      return reply(200, { shop: info.shop, title: info.title, brand: info.brand, ...more });
    }
    if (req.mode === 'url') {
      let host = '';
      try {
        host = new URL(req.url).hostname;
      } catch {}
      if (!SHOPS.test(host)) return reply(400, { error: 'unsupported_shop' });
      const key = keyFor({ url: req.url });
      const cached = await cacheGet(key, iam);
      if (cached?.ingredients?.length) return reply(200, { product: cached, cached: true });
      if (!(await allow('web'))) return reply(429, { error: 'limit' });
      const page = await fromShopPage(req.url);
      if (page.error || !page.composition) return reply(200, { product: null, error: page.error || 'no_composition', title: page.title || null });
      let ingredients = page.composition.split(/\s*[,;]\s*/).map((x) => x.replace(/\.$/, '').trim()).filter((x) => x.length > 1 && x.length < 90);
      // Russian-only lists are translated to INCI once, then cached for everyone.
      if ((page.composition.match(/[а-яё]/gi) || []).length > page.composition.length * 0.3) {
        const t = await chat(textModel, [{ role: 'user', content: `Переведи состав косметики в INCI, по порядку, через «; », без пояснений:\n${page.composition.slice(0, 1500)}` }], 600, true);
        const list = t.split(/\s*[;\n]\s*/).map((x) => x.trim()).filter((x) => x.length > 1 && x.length < 90);
        if (list.length >= 3) ingredients = list;
      }
      const product = { title: page.title, image: page.image, url: req.url, ingredients, source: host.replace(/^www\./, '') };
      await cachePut(key, iam, product);
      await shopAdd(iam, key, product.title, product.image, ingredients, product.source).catch(() => {});
      return reply(200, { product });
    }
    if (req.mode === 'review') {
      const list = (req.items || []).slice(0, 40).join(', ');
      if (!list) return reply(400, { error: 'empty' });
      const notes = (req.notes || []).slice(0, 6).join('; ');
      // Advice the person already applied from earlier reviews: the technologist finishes instead of improving forever.
      const done = (req.done || []).slice(0, 12).map((x) => clean(x, 60)).filter(Boolean).join(', ');
      // The same formula gets the same answer for everyone, without a new model call.
      // «Технолог обычный» answers the same coded lines with the light model: a few times cheaper.
      const lite = req.tier === 'lite';
      const rk = `${lite ? 'reviewL2' : 'review5'}/${sha(`${req.kind || ''}|${list}|${notes}|${done}`)}.json`;
      const cachedReview = await cacheGet(rk, iam);
      if (cachedReview && cachedReview.verdict !== undefined) return reply(200, balanceReview(cachedReview, req.items || [], req.kind));
      if (lite) curMode = 'review.lite';
      const made = await shared(rk, async () => {
        if (!(await (lite ? allow('review.lite', DESCRIBE_LIMIT[0], DESCRIBE_LIMIT[1]) : allow('review')))) return null;
        const text = await chat(lite ? textModel : process.env.REVIEW_MODEL || 'yandexgpt-5.1/latest', [{ role: 'user', content: `${REVIEW}\n\n${req.kind ? `Тип: ${req.kind}\n` : ''}Формула: ${list}${notes ? `\nЗамечания: ${notes}` : ''}${done ? `\nУже применено по твоим прошлым советам: ${done}. Формула доработана — не предлагай новых улучшений. Пиши строки «+», «-», «x» только если есть настоящая ошибка (из «Замечаний», опасная доля, нестабильность); иначе ответь строкой «О: …» — какое средство получилось, для чего и кому — и строкой «В: Формула готова…».` : ''}` }], 500, true);
        const out = { add: [], reduce: [], remove: [], warn: [] };
        for (const line of text.split('\n').map((l) => l.trim().replace(/^[-*•]\s+(?=[+x!-])/, ''))) {
          const [head, ...rest] = line.slice(1).split('|').map((x) => x.trim());
          if (/^О:/i.test(line)) out.summary = line.replace(/^О:\s*/i, '');
          else if (/^В:/i.test(line)) out.verdict = line.replace(/^В:\s*/i, '');
          else if (line[0] === '+' && head) out.add.push({ name: head, pct: rest[0], why: rest[1] });
          else if ((line[0] === '-' || line[0] === '−') && head) out.reduce.push({ name: head, to: rest[0], why: rest[1] });
          else if ((line[0] === 'x' || line[0] === 'х' || line[0] === '×') && head) out.remove.push({ name: head, why: rest[0] });
          else if (line[0] === '!' && head) out.warn.push(head);
        }
        balanceReview(out, req.items || [], req.kind);
        await cachePut(rk, iam, out, true);
        return out;
      });
      if (!made) return reply(429, { error: 'limit' });
      return reply(200, { ...made, _usage: lastUsage });
    }
    if (req.mode === 'compare') {
      // Two products side by side: the technologist explains how they differ, for what and for which zone.
      const side = (x) => ({ title: clean(x?.title, 160), items: (Array.isArray(x?.items) ? x.items : []).slice(0, 35).map((i) => clean(i, 60)).filter(Boolean) });
      const a = side(req.a);
      const b = side(req.b);
      if (a.items.length < 2 || b.items.length < 2) return reply(400, { error: 'empty' });
      // The same pair in the same order (the answer says «А» and «Б») gets the same answer for everyone.
      const pair = `${a.title}|${a.items.join(',')}||${b.title}|${b.items.join(',')}`;
      const lite = req.tier === 'lite';
      const ck = `${lite ? 'compareL1' : 'compare3'}/${sha(pair)}.json`;
      const hit = await cacheGet(ck, iam);
      if (hit?.text) return reply(200, hit);
      if (lite) {
        // The cheap technologist: light model, a few dozen coded tokens, the text is assembled here.
        curMode = 'compare.lite';
        const out = await shared(ck, async () => {
          if (!(await allow('compare.lite', DESCRIBE_LIMIT[0], DESCRIBE_LIMIT[1]))) return null;
          const o = decodeCompare(await chat(textModel, [{ role: 'system', content: COMPARE_LITE }, { role: 'user', content: `Средство А: ${a.title || 'без названия'}. Состав: ${a.items.join(', ')}\nСредство Б: ${b.title || 'без названия'}. Состав: ${b.items.join(', ')}` }], 160, true));
          if (o.text) await cachePut(ck, iam, o, true);
          return o;
        });
        if (!out) return reply(429, { error: 'limit' });
        return reply(200, { ...out, _usage: lastUsage });
      }
      const out = await shared(ck, async () => {
        if (!(await allow('compare'))) return null;
        const text = await chat(
          process.env.REVIEW_MODEL || 'yandexgpt-5.1/latest',
          [{ role: 'user', content: `${COMPARE}\n\nСредство А: ${a.title || 'без названия'}\nСостав А: ${a.items.join(', ')}\n\nСредство Б: ${b.title || 'без названия'}\nСостав Б: ${b.items.join(', ')}` }],
          300,
          true,
        );
        const o = { text: String(text).replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim() };
        if (o.text) await cachePut(ck, iam, o, true);
        return o;
      });
      if (!out) return reply(429, { error: 'limit' });
      return reply(200, { ...out, _usage: lastUsage });
    }
    if (req.mode === 'describe') {
      const list = (req.ingredients || []).slice(0, 40).join(', ');
      if (!list) return reply(400, { error: 'empty' });
      // One description per composition for everyone: opening the same product again costs no tokens.
      const dk = `desc3/${crypto.createHash('sha1').update(`${req.kind || ''}|${list}`).digest('hex')}.json`;
      const hit = await cacheGet(dk, iam);
      if (hit && hit.lead) return reply(200, hit);
      const out = await shared(dk, async () => {
        if (!(await allow('describe', DESCRIBE_LIMIT[0], DESCRIBE_LIMIT[1]))) return null;
        const o = decodeDescribe(await chat(textModel, [{ role: 'system', content: DESCRIBE }, { role: 'user', content: `${req.kind ? `Средство: ${String(req.kind).slice(0, 160)}. ` : ''}Состав: ${list}` }], 220, true));
        if (o && o.lead) await cachePut(dk, iam, o, true);
        return o;
      });
      if (!out) return reply(429, { error: 'limit' });
      return reply(200, out);
    }
    if (req.mode === 'label') {
      // Front of the pack → brand and name only: a small photo and a one-line answer keep it cheap.
      const image = String(req.image || '');
      if (!image || image.length > 2_000_000 || !imageOk(image, 1600)) return reply(400, { error: 'bad_image' });
      if (!(await allow('photo'))) return reply(429, { error: 'limit' });
      const url = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
      const models = [process.env.VLM_MODEL, 'qwen3.6-35b-a3b/latest', 'aliceai-vlm/latest', 'gemma-3-27b-it/latest'].filter(Boolean);
      const msg = [{ role: 'user', content: [{ type: 'text', text: LABEL }, { type: 'image_url', image_url: { url } }] }];
      let t = null, last;
      for (const m of models) {
        try {
          const noThink = { chat_template_kwargs: { enable_thinking: false } };
          t = await chat(m, msg, 80, true, noThink).catch((e) => (/ 400:/.test(String(e.message)) ? chat(m, msg, 80, true) : Promise.reject(e)));
          break;
        } catch (e) {
          last = e;
          if (!/ (400|403|404):/.test(String(e.message))) throw e;
        }
      }
      if (t === null) throw last;
      t = t.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      const nc = t.match(/НЕ\s*КОСМЕТИКА\s*:?\s*([^\n]{0,60})/i);
      if (nc) return reply(200, { notCosmetic: nc[1].trim() || 'не косметика', _usage: lastUsage });
      const [brand = '', name = '', kind = ''] = t.split('\n')[0].split('|').map((x) => x.replace(/^["«]|["»]$/g, '').trim());
      console.log('label:', brand, '|', name);
      const found = await findByLabel(brand, name, kind, iam, textModel, () => allow('web'), () => allow('pick', DESCRIBE_LIMIT[0], DESCRIBE_LIMIT[1]));
      return reply(200, { brand: brand.slice(0, 60), name: name.slice(0, 120), kind: kind.slice(0, 40), ...found, _usage: lastUsage });
    }
    const image = String(req.image || '');
    console.log('scan request, image chars:', image.length);
    if (!image || image.length > 4_000_000 || !imageOk(image, 3200)) return reply(400, { error: 'bad_image' });
    if (!(await allow('photo'))) return reply(429, { error: 'limit' });
    const url = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
    // Vision models differ per account; try the configured one first, then known multimodal ids.
    const models = [process.env.VLM_MODEL, 'qwen3.6-35b-a3b/latest', 'aliceai-vlm/latest', 'gemma-3-27b-it/latest'].filter(Boolean);
    const msg = [{ role: 'user', content: [{ type: 'text', text: SCAN }, { type: 'image_url', image_url: { url } }] }];
    let out = null, last;
    for (const m of models) {
      try {
        // Qwen "thinks" before answering, which multiplies the cost; ask the server to skip it.
        const noThink = { chat_template_kwargs: { enable_thinking: false } };
        const t = await chat(m, msg, 1400, true, noThink).catch((e) => (/ 400:/.test(String(e.message)) ? chat(m, msg, 1400, true) : Promise.reject(e)));
        const nc = t.match(/НЕ\s*КОСМЕТИКА\s*:?\s*([^\n]{0,60})/i);
        if (nc) return reply(200, { ingredients: [], notCosmetic: nc[1].trim() || 'не косметика', _usage: lastUsage });
        // «Нет состава» (in any wording) means the photo has no ingredient list: never a one-item composition.
        if (/нет\s+состава|пустой\s+ответ|состав\s+(не\s+(найден|виден|указан)|отсутствует)|no\s+ingredients/i.test(t) && !/[;,]/.test(t)) {
          out = { ingredients: [], raw: 'no_composition' };
          break;
        }
        const json = t.includes('"ingredients"') && t.match(/\[[\s\S]*?\]/);
        const list = json ? [...json[0].matchAll(/"([^"\n]{2,89})"/g)].map((x) => x[1]) : t.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[^:\n]{0,20}:\s*/, '').split(/\s*[;\n]\s*/).map((x) => x.replace(/^(\d+[.)]\s+|[-*•]\s+)/, '').replace(/[.]$/, '').trim()).filter((x) => x.length > 1 && x.length < 90);
        out = { ingredients: list, raw: t.slice(0, 200) };
        console.log('vision model ok:', m);
        break;
      } catch (e) {
        last = e;
        if (!/ (400|403|404):/.test(String(e.message))) throw e;
      }
    }
    if (!out) throw last;
    const ingredients = Array.isArray(out.ingredients) ? out.ingredients.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : [];
    console.log('scan ingredients:', ingredients.length);
    // The photo is the person's: what it shows joins the barcode under the same rules as other phone submissions.
    if (req.barcode && String(req.barcode).replace(/\D/g, '').length >= 8 && (await plausibleList(ingredients, iam))) {
      const who = await actor();
      if (who) await userSubmit(keyFor({ barcode: req.barcode }), iam, sha(`${who}|${ip}`), { title: String(req.title || '').slice(0, 200) || null, ingredients, source: 'scan' }).catch(() => {});
    }
    return reply(200, ingredients.length ? { ingredients, _usage: lastUsage } : { ingredients, why: out.raw ?? '', _usage: lastUsage });
  } catch (e) {
    console.error(e);
    return reply(500, { error: 'failed', detail: String(e && e.message || e).slice(0, 400) });
  }
}
module.exports._keywordSearch = keywordSearch;
module.exports._balanceReview = balanceReview;

module.exports._decodeDescribe = decodeDescribe;
module.exports._decodeCompare = decodeCompare;
module.exports._imageOk = imageOk;
