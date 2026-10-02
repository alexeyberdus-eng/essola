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
const DESCRIBE = `Ты косметолог-технолог. По списку ингредиентов (по убыванию доли) коротко и понятно объясни, что даёт средство. Верни ТОЛЬКО JSON:
{"lead":"1–2 предложения: что это за средство и для какой кожи","effects":[{"title":"2–3 слова","text":"какие компоненты и что делают, до 12 слов"}],"use":["куда и как применять, до 12 слов"]}
effects: 2–4 пункта, use: 1–3 пункта. Без медицинских обещаний, без выдуманных ингредиентов.`;

const REVIEW = `Ты косметолог-технолог. Дана формула: ингредиент, доля, роль. Базовые проверки (сумма 100%, консервант, эмульгатор, pH) уже показаны пользователю — повторяй их только если есть «Замечания». Оцени формулу и предложи, чем её конкретно улучшить: какие активы или компоненты добавить для эффекта, текстуры и стабильности, что убавить или убрать. Ответ строго строками, без markdown:
В: вывод в 2 предложениях — что получится и главный совет
+ ингредиент (INCI) | доля | что даст, до 14 слов
- ингредиент | новая доля | почему, до 12 слов
x ингредиент | почему, до 12 слов
! предупреждение, до 12 слов
Строк «+» — 2–4 (обязательно, называй конкретные ингредиенты), «-», «x», «!» — 0–2.
Пример:
В: Получится лёгкий увлажняющий тоник, но кислоты многовато для ежедневного ухода. Смягчите формулу пантенолом и добавьте увлажнитель.
+ Panthenol | 1% | смягчит действие кислоты и успокоит кожу
+ Sodium Hyaluronate | 0,2% | дополнительное увлажнение без липкости
- Lactic Acid | 5% | 8% может раздражать при ежедневном использовании /no_think`;
const ANALOGS = `Ты косметолог-технолог. Даны состав средства пользователя и найденные товары магазина (номер, название, фрагмент страницы). Оцени для каждого товара совпадение по составу 0–100: ключевые активы весят больше всего, затем база и назначение. 100 — только если полный состав товара виден во фрагменте и практически совпадает. Если состава не видно, оценивай по активам, их концентрациям, дополнительным компонентам и типу средства из названия; разным товарам ставь разные оценки, отличие в концентрации или лишние активы снижают оценку. Не косметику и не похожие по назначению товары исключи. Верни ТОЛЬКО JSON:
{"items":[{"n":1,"match":72,"common":["общий ингредиент по-русски"],"note":"чем похож или отличается, до 10 слов"}]}
Максимум 5 товаров, по убыванию match. /no_think`;
const SEARCH_URL = 'https://searchapi.api.cloud.yandex.net/v2/web/search';

const strip = (x) => x.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/** Yandex web search limited to one shop; returns [{url,title,text}]. */
async function search(queryText, iam) {
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
async function shopAdd(iam, key, title, image, ingredients, source) {
  if (!title || !ingredients || ingredients.length < 4) return;
  const list = (await cacheGet('shop.json', iam)) || [];
  const next = (Array.isArray(list) ? list : []).filter((x) => x.k !== key);
  next.push({ k: key, t: String(title).slice(0, 160), i: image || '', x: `Ingredients: ${ingredients.join(', ')}`, s: source || '' });
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
async function search(q, iam) {
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

let lastUsage;
async function chat(model, messages, maxTokens, raw = false, extra = {}) {
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.YC_API_KEY}`, 'OpenAI-Project': process.env.YC_FOLDER_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: `gpt://${process.env.YC_FOLDER_ID}/${model}`, messages, temperature: 0.1, max_tokens: maxTokens, ...extra }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  lastUsage = json?.usage;
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

module.exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return reply(204, {});
  const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (process.env.APP_KEY && h['x-app-key'] !== process.env.APP_KEY) return reply(401, { error: 'unauthorized' });
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '{}';
    const req = JSON.parse(raw);
    const textModel = process.env.TEXT_MODEL || 'yandexgpt-lite/latest';
    const iam = context?.token?.access_token;
    if (req.mode === 'product') {
      const product = await cacheGet(keyFor(req), iam);
      return reply(200, { product });
    }
    // ---- Community: profiles, published recipes, follows, likes and comments (MVP: device id, no passwords) ----
    const uid = (x) => String(x || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
    const clean = (x, n) => String(x || '').replace(/[<>]/g, '').trim().slice(0, n);
    const get = async (k, def) => (await cacheGet(k, iam)) ?? def;
    const put = (k, v) => cachePut(k, iam, v, true);
    if (req.mode === 'user.save') {
      const id = uid(req.id);
      if (!id) return reply(400, { error: 'bad_user' });
      const prev = await get(`users/${id}.json`, {});
      const user = { ...prev, id, nick: clean(req.nick, 24) || prev.nick || 'user', name: clean(req.name, 60) || prev.name || '', bio: clean(req.bio, 160) || prev.bio || '' };
      await put(`users/${id}.json`, user);
      return reply(200, { user });
    }
    if (req.mode === 'user.get') {
      const id = uid(req.id);
      const [user, recipes, followers] = await Promise.all([get(`users/${id}.json`, null), get(`users/${id}/recipes.json`, []), get(`users/${id}/followers.json`, [])]);
      return reply(200, { user, recipes, followers: followers.length, following: followers.includes(uid(req.viewer)) });
    }
    if (req.mode === 'recipe.publish') {
      const id = uid(req.id);
      const r = req.recipe || {};
      if (!id || !r.id || !r.title) return reply(400, { error: 'bad_recipe' });
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
      const me = uid(req.id);
      const target = uid(req.target);
      if (!me || !target || me === target) return reply(400, { error: 'bad_follow' });
      const list = (await get(`users/${target}/followers.json`, [])).filter((x) => x !== me);
      if (req.on) list.push(me);
      await put(`users/${target}/followers.json`, list);
      return reply(200, { followers: list.length, following: !!req.on });
    }
    // Recipes the admin imported from a table, shown to everyone next to the built-in editorial ones.
    if (req.mode === 'editorial.list') {
      return reply(200, { items: await get('editorial.json', []) });
    }
    if (req.mode === 'editorial.add') {
      const ADMINS = ['5d94e597ea00166f5be0b0512fa5847f2f44bd49f682d6c8644f6571f434d32c'];
      const who = crypto.createHash('sha256').update(String(req.email || '').trim().toLowerCase()).digest('hex');
      if (!ADMINS.includes(who)) return reply(403, { error: 'not_admin' });
      const incoming = (Array.isArray(req.recipes) ? req.recipes : []).filter((r) => r && r.id && r.title && Array.isArray(r.ingredients)).slice(0, 500);
      const list = await get('editorial.json', []);
      const ids = new Set(incoming.map((r) => r.id));
      const next = [...incoming.map((r) => ({ ...r, own: false, editorial: true, photo: undefined })), ...list.filter((r) => !ids.has(r.id))].slice(0, 3000);
      await put('editorial.json', next);
      return reply(200, { count: next.length });
    }
    // Forum: an index of topics (newest activity first) plus one file per topic with its replies.
    if (req.mode === 'forum.list') {
      const idx = await get('forum/index.json', []);
      const list = req.cat ? idx.filter((t) => t.cat === req.cat) : idx;
      const page = Math.max(Number(req.page) || 1, 1);
      return reply(200, { items: list.slice((page - 1) * 30, page * 30), total: list.length });
    }
    if (req.mode === 'forum.get') {
      const t = await get(`forum/t/${clean(req.tid, 40)}.json`, null);
      return reply(t ? 200 : 404, t ? { topic: t } : { error: 'not_found' });
    }
    if (req.mode === 'forum.create') {
      const me = uid(req.id);
      const title = clean(req.title, 120);
      const text = clean(req.text, 4000);
      if (!me || title.length < 4) return reply(400, { error: 'bad_topic' });
      const at = new Date().toISOString();
      const tid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const author = { id: me, nick: clean(req.nick, 24) || 'гость' };
      const cat = clean(req.cat, 30) || 'Общее';
      await put(`forum/t/${tid}.json`, { id: tid, title, text, cat, author, at, posts: [] });
      const idx = await get('forum/index.json', []);
      await put('forum/index.json', [{ id: tid, title, cat, author, at, last: at, replies: 0, preview: text.slice(0, 160) }, ...idx].slice(0, 5000));
      return reply(200, { id: tid });
    }
    if (req.mode === 'forum.reply') {
      const me = uid(req.id);
      const tid = clean(req.tid, 40);
      const text = clean(req.text, 3000);
      const t = await get(`forum/t/${tid}.json`, null);
      if (!me || !t || !text) return reply(400, { error: 'bad_reply' });
      const at = new Date().toISOString();
      t.posts = [...t.posts, { id: Date.now().toString(36), author: { id: me, nick: clean(req.nick, 24) || 'гость' }, text, at }].slice(-1000);
      await put(`forum/t/${tid}.json`, t);
      const idx = await get('forum/index.json', []);
      const row = idx.find((x) => x.id === tid);
      if (row) await put('forum/index.json', [{ ...row, last: at, replies: t.posts.length }, ...idx.filter((x) => x.id !== tid)]);
      return reply(200, { topic: t });
    }
    if (req.mode === 'social.get' || req.mode === 'social.like' || req.mode === 'social.comment') {
      const key = `social/${crypto.createHash('sha1').update(String(req.key || '')).digest('hex')}.json`;
      const me = uid(req.id);
      const data = await get(key, { likes: [], comments: [] });
      if (req.mode === 'social.like' && me) {
        data.likes = data.likes.filter((x) => x !== me);
        if (req.on) data.likes.push(me);
        await put(key, data);
      }
      if (req.mode === 'social.comment' && me && clean(req.text, 500)) {
        data.comments = [...data.comments, { id: Date.now().toString(36), user: me, nick: clean(req.nick, 24) || 'user', text: clean(req.text, 500), at: new Date().toISOString() }].slice(-200);
        await put(key, data);
      }
      return reply(200, { likes: data.likes.length, liked: data.likes.includes(me), comments: data.comments.slice(-50) });
    }
    if (req.mode === 'catalog') {
      // Ready-made catalog built weekly by CI (scripts/build-catalog.ts), kept warm between calls.
      const all = await loadCatalog(iam);
      const words = String(req.q || '').toLowerCase().split(/\s+/).filter((w) => w.length > 1);
      let list = all;
      if (req.cat) list = list.filter((x) => x.c === req.cat);
      if (words.length) list = list.filter((x) => words.every((w) => `${x.t} ${x.b}`.toLowerCase().includes(w)));
      if (req.sort === 'best') list = [...list].sort((a, b) => b.s - a.s);
      else if (req.sort === 'worst') list = [...list].sort((a, b) => a.s - b.s);
      const size = Math.min(Number(req.size) || 40, 100);
      const page = Math.max(Number(req.page) || 1, 1);
      return reply(200, { items: list.slice((page - 1) * size, page * size), total: list.length });
    }
    if (req.mode === 'search') {
      return reply(200, { items: await search(req.q, iam) });
    }
    if (req.mode === 'save') {
      // A composition the user's phone read from a shop page: keep it for everyone.
      const ingredients = (req.ingredients || []).filter((x) => typeof x === 'string' && x.length > 1 && x.length < 90).slice(0, 80);
      if (!req.url || ingredients.length < 3) return reply(400, { error: 'bad_product' });
      await cachePut(keyFor({ url: req.url }), iam, { title: String(req.title || '').slice(0, 200), url: req.url, ingredients, source: 'shop' });
      await shopAdd(iam, keyFor({ url: req.url }), String(req.title || '').slice(0, 200), null, ingredients, 'shop').catch(() => {});
      return reply(200, { ok: true });
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
      const text = await chat(process.env.REVIEW_MODEL || 'yandexgpt-5.1/latest', [{ role: 'user', content: `${REVIEW}\n\n${req.kind ? `Тип: ${req.kind}\n` : ''}Формула: ${list}${notes ? `\nЗамечания: ${notes}` : ''}` }], 500, true);
      const out = { add: [], reduce: [], remove: [], warn: [] };
      for (const line of text.split('\n').map((l) => l.trim().replace(/^[-*•]\s+(?=[+x!-])/, ''))) {
        const [head, ...rest] = line.slice(1).split('|').map((x) => x.trim());
        if (/^В:/i.test(line)) out.verdict = line.replace(/^В:\s*/i, '');
        else if (line[0] === '+' && head) out.add.push({ name: head, pct: rest[0], why: rest[1] });
        else if ((line[0] === '-' || line[0] === '−') && head) out.reduce.push({ name: head, to: rest[0], why: rest[1] });
        else if ((line[0] === 'x' || line[0] === 'х' || line[0] === '×') && head) out.remove.push({ name: head, why: rest[0] });
        else if (line[0] === '!' && head) out.warn.push(head);
      }
      return reply(200, { ...out, _usage: lastUsage });
    }
    if (req.mode === 'analogs') {
      const list = (req.ingredients || []).slice(0, 25).join(', ');
      const keys = (req.keys || []).slice(0, 3).join(' ');
      if (!list) return reply(400, { error: 'empty' });
      const docs = (await search(`${req.kind || 'косметика'} ${keys} site:goldapple.ru`, context?.token?.access_token))
        .filter((d) => /goldapple\.ru\/\d/.test(d.url) && d.title)
        .slice(0, 8);
      console.log('analogs docs:', docs.length);
      if (!docs.length) return reply(200, { items: [] });
      // Without the product's own ingredient list in the snippet a match can only be partial.
      const lower = (req.ingredients || []).map((i) => String(i).toLowerCase());
      const seen = (d) => !!d && lower.filter((i) => `${d.title} ${d.text}`.toLowerCase().includes(i)).length >= Math.min(5, lower.length);
      const found = docs.map((d, i) => `${i + 1}. ${d.title} — ${d.text}`).join('\n');
      const out = await chat(process.env.REVIEW_MODEL || 'yandexgpt-5.1/latest', [{ role: 'user', content: `${ANALOGS}\n\nСостав пользователя: ${list}\nТовары:\n${found}` }], 1000);
      const items = (Array.isArray(out.items) ? out.items : [])
        .map((x) => ({ ...docs[(x.n | 0) - 1], match: Math.max(0, Math.min(seen(docs[(x.n | 0) - 1]) ? 100 : 75, x.match | 0)), common: Array.isArray(x.common) ? x.common.slice(0, 4) : [], note: x.note || '' }))
        .filter((x) => x.url && x.match >= 20)
        .sort((a, b) => b.match - a.match)
        .slice(0, 5)
        .map(({ text, ...x }) => x);
      return reply(200, { items, _usage: lastUsage });
    }
    if (req.mode === 'describe') {
      const list = (req.ingredients || []).slice(0, 40).join(', ');
      if (!list) return reply(400, { error: 'empty' });
      // One description per composition for everyone: opening the same product again costs no tokens.
      const dk = `desc/${crypto.createHash('sha1').update(`${req.kind || ''}|${list}`).digest('hex')}.json`;
      const hit = await cacheGet(dk, iam);
      if (hit && hit.lead) return reply(200, hit);
      const out = await chat(textModel, [{ role: 'system', content: DESCRIBE }, { role: 'user', content: `${req.kind ? `Тип: ${req.kind}. ` : ''}Состав: ${list}` }], 600);
      if (out && out.lead) await cachePut(dk, iam, out, true);
      return reply(200, out);
    }
    const image = String(req.image || '');
    console.log('scan request, image chars:', image.length);
    if (!image || image.length > 12_000_000) return reply(400, { error: 'bad_image' });
    const url = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
    // Vision models differ per account; try the configured one first, then known multimodal ids.
    const models = [process.env.VLM_MODEL, 'qwen3.6-35b-a3b/latest', 'aliceai-vlm/latest', 'gemma-3-27b-it/latest'].filter(Boolean);
    const msg = [{ role: 'user', content: [{ type: 'text', text: SCAN }, { type: 'image_url', image_url: { url } }] }];
    let out = null, last;
    for (const m of models) {
      try {
        // Qwen "thinks" before answering, which multiplies the cost; ask the server to skip it.
        const noThink = { chat_template_kwargs: { enable_thinking: false } };
        const t = await chat(m, msg, 2500, true, noThink).catch((e) => (/ 400:/.test(String(e.message)) ? chat(m, msg, 2500, true) : Promise.reject(e)));
        const nc = t.match(/НЕ\s*КОСМЕТИКА\s*:?\s*([^\n]{0,60})/i);
        if (nc) return reply(200, { ingredients: [], notCosmetic: nc[1].trim() || 'не косметика', _usage: lastUsage });
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
    if (req.barcode && ingredients.length >= 3) await cachePut(keyFor({ barcode: req.barcode }), iam, { title: req.title || null, ingredients, source: 'scan' });
    return reply(200, ingredients.length ? { ingredients, _usage: lastUsage } : { ingredients, why: out.raw ?? '', _usage: lastUsage });
  } catch (e) {
    console.error(e);
    return reply(500, { error: 'failed', detail: String(e && e.message || e).slice(0, 400) });
  }
};
