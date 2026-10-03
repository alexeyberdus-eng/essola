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
Предлагай изменения ТОЛЬКО если они действительно нужны: ошибка, нестабильность, опасная доля или явная нехватка эффекта для задачи. Не улучшай ради улучшения. Если формула уже сбалансирована и стабильна — ответь одной строкой «В: Хорошая, стабильная формула…» с коротким объяснением и больше ничего не пиши. Строк «+» — 0–3 (конкретные ингредиенты), «-», «x», «!» — 0–2. В «+» только ингредиенты, которых НЕТ в формуле (сверяй INCI и русские названия, синонимы тоже). Если уже имеющегося компонента мало или много — пиши строку «-» с новой долей (она может быть и больше текущей). Учитывай «Тип»: для чего средство и задачу. Сумма формулы должна остаться 100%: если что-то добавляешь, обязательно добавь строку «-», за счёт чего (компонента с самой большой долей в ЭТОЙ формуле) и до какой доли. Новую долю считай от текущей доли в формуле: например, было Aqua 12%, добавляешь 2% — пиши «- Aqua | 10%». Никогда не пиши типичную долю из других рецептов, только пересчёт этой формулы.
Пример:
В: Получится лёгкий увлажняющий тоник, но кислоты многовато для ежедневного ухода. Смягчите формулу пантенолом и добавьте увлажнитель.
+ Panthenol | 1% | смягчит действие кислоты и успокоит кожу
+ Sodium Hyaluronate | 0,2% | дополнительное увлажнение без липкости
- Lactic Acid | 5% | 8% может раздражать при ежедневном использовании /no_think`;
const LABEL = `На фото лицевая сторона упаковки косметического средства. Ответь ОДНОЙ строкой: бренд | название средства как на упаковке (с линейкой, без объёма) | тип по-русски (крем, шампунь, сыворотка…). Если бренда не видно, но ты узнаёшь средство по названию и дизайну, назови бренд (например, Egg Mellow — Too Cool For School). Без пояснений. Если на фото не косметика — ответь «НЕ КОСМЕТИКА: что это». /no_think`;
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

// Letual catalog (collected weekly by CI with Letual's permission): compact cards in memory,
// compositions in sharded files loaded only for the cards being shown.
let letu = null, letuAt = 0;
async function loadLetu(iam) {
  if (letu && Date.now() - letuAt < 6 * 3600e3) return letu;
  const data = await cacheGet('letu/index.json', iam);
  if (Array.isArray(data)) [letu, letuAt] = [data, Date.now()];
  return letu || [];
}
const shards = new Map();
const sortedMemo = new Map();
async function letuShard(h, iam) {
  if (shards.has(h)) return shards.get(h);
  const data = (await cacheGet(`letu/x/${h}.json`, iam)) || {};
  if (shards.size > 1500) shards.delete(shards.keys().next().value);
  shards.set(h, data);
  return data;
}
async function withCompositions(items, iam) {
  const need = [...new Set(items.filter((x) => !x.x && !x.z && x.k.startsWith('letu:')).map((x) => crypto.createHash('sha1').update(x.k).digest('hex').slice(0, 3)))];
  const loaded = Object.fromEntries(await Promise.all(need.map(async (h) => [h, await letuShard(h, iam)])));
  return items.map((x) => (x.x || x.z ? x : { ...x, x: loaded[crypto.createHash('sha1').update(x.k).digest('hex').slice(0, 3)]?.[x.k] || '' }));
}

const norm = (x) => String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();

/** Brand + name read from the pack → the product in our Letual base (titles there are Russian, packs often English,
 * so a small text model picks among the brand's products), or a composition found on the web. */
async function findByLabel(brand, name, kind, iam, model) {
  const b = norm(brand).replace(/ /g, '');
  const base = await loadLetu(iam);
  const ours = b.length >= 2 ? base.filter((x) => { const xb = norm(x.b).replace(/ /g, ''); return xb && (xb === b || (b.length >= 4 && (xb.includes(b) || b.includes(xb)))); }) : [];
  if (ours.length) {
    const words = norm(`${name} ${kind}`).split(' ').filter((w) => w.length > 2 && !/^\d+(мл|ml|г|g)?$/.test(w));
    const score = (x) => words.filter((w) => norm(x.t).includes(w)).length + (x.z ? -5 : 0);
    const top = [...ours].sort((a, c) => score(c) - score(a) || (c.p || 0) - (a.p || 0)).slice(0, 60);
    let pick = top.length === 1 && !top[0].z ? top[0] : null;
    if (!pick) {
      const list = top.map((x, i) => `${i + 1}. ${x.t}`).join('\n');
      const ans = await chat(model, [{ role: 'user', content: `На упаковке: «${brand} ${name}»${kind ? ` (${kind})` : ''}. Какой товар из списка — это то же средство (переводы и сокращения допустимы)? Ответь только номером, или 0, если такого нет.\n${list}` }], 8, true).catch(() => '0');
      const n = parseInt(String(ans).match(/\d+/)?.[0] || '0', 10);
      pick = n > 0 && n <= top.length ? top[n - 1] : null;
    }
    if (pick) {
      const [item] = await withCompositions([(({ g, ...x }) => x)(pick)], iam);
      if (item.x) return { item };
      return { item, none: true };
    }
  }
  // Not in our base: find the product's pages on the web, open a few and let the model copy the ingredient list out.
  const ck = `label/${crypto.createHash('sha1').update(norm(`${brand} ${name}`)).digest('hex')}.json`;
  const hit = await cacheGet(ck, iam);
  if (hit && hit.ingredients) return hit;
  const queries = [`${brand} ${name} ingredients`, `${brand} ${name} состав`, `${brand} ${name} site:incidecoder.com`];
  const docs = (await Promise.all(queries.map((q) => search(q, iam).catch(() => [])))).flat();
  // Marketplaces render their pages with scripts (nothing to read) and some shops block robots: skip them.
  const skip = /wildberries|ozon\.|goldapple|market\.yandex|aliexpress|youtube|vk\.com|pinterest|instagram/;
  const seen = new Set();
  const pages = docs.filter((d) => d.url && !skip.test(d.url) && !seen.has(d.url) && seen.add(d.url)).sort((a, b) => Number(/incidecoder|skinsort|cosdna|inci/.test(b.url)) - Number(/incidecoder|skinsort|cosdna|inci/.test(a.url))).slice(0, 4);
  const texts = await Promise.all(pages.map((d) => pageIngredients(d.url).catch(() => '')));
  const snippets = docs.slice(0, 6).map((d) => `${d.title} — ${d.text}`).join('\n');
  const text = [...texts.filter(Boolean), snippets].join('\n---\n').slice(0, 9000);
  console.log('label web:', pages.length, 'pages,', texts.filter(Boolean).length, 'with text');
  if (!text.trim()) return {};
  const out = await chat(model, [{ role: 'user', content: `Ниже тексты страниц о средстве «${brand} ${name}». Найди его полный состав (ingredients, INCI). Выпиши ингредиенты через запятую, как в источнике, без пояснений. Если полного состава этого средства нет — ответь «нет».\n${text}` }], 700, true).catch(() => '');
  const ingredients = String(out).replace(/^[^:\n]{0,25}:\s*/, '').split(/\s*,\s*/).map((x) => x.replace(/[.\s]+$/, '').trim()).filter((x) => x.length > 1 && x.length < 90);
  if (ingredients.length < 5) return {};
  const found = { ingredients, web: true };
  await cachePut(ck, iam, found, true).catch(() => {});
  return found;
}

/** One page's text around its ingredient list (what a reader sees, without markup). */
async function pageIngredients(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EssolaBot/1.0; +https://essola.ru)', Accept: 'text/html' }, signal: AbortSignal.timeout(7000) });
  if (!res.ok) return '';
  const html = (await res.text()).slice(0, 1_500_000);
  const text = strip(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<\/(p|div|li|h\d|br|tr)>/gi, '\n'));
  const at = text.search(/ingredients|состав|inci/i);
  return at < 0 ? '' : text.slice(Math.max(0, at - 100), at + 2500);
}

/** Someone who posts gets a public profile with their nickname (if they had none), so tapping the nick opens it. */
async function ensureUser(get, put, id, nick) {
  if (!id || !nick) return;
  if (!(await get(`users/${id}.json`, null))) await put(`users/${id}.json`, { id, nick: String(nick).slice(0, 24) });
}

module.exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return reply(204, {});
  if (event.httpMethod === 'GET') {
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
  if (process.env.APP_KEY && h['x-app-key'] !== process.env.APP_KEY) return reply(401, { error: 'unauthorized' });
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '{}';
    const req = JSON.parse(raw);
    const textModel = process.env.TEXT_MODEL || 'yandexgpt-lite/latest';
    const iam = context?.token?.access_token;
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
    // ---- Reports, account deletion (App Store rules for apps with user content) ----
    if (req.mode === 'report') {
      const me = uid(req.id);
      if (!me) return reply(400, { error: 'bad_report' });
      const item = { at: new Date().toISOString(), from: me, kind: clean(req.kind, 20), target: clean(req.target, 120), author: uid(req.author), text: clean(req.text, 300), reason: clean(req.reason, 200) };
      const list = await get('reports.json', []);
      await put('reports.json', [item, ...list].slice(0, 2000));
      return reply(200, { ok: true });
    }
    if (req.mode === 'user.delete') {
      const me = uid(req.id);
      if (!me) return reply(400, { error: 'bad_user' });
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
      const id = uid(req.id);
      if (!id) return reply(400, { error: 'bad_user' });
      const prev = await get(`users/${id}.json`, {});
      let nick = clean(req.nick, 24) || prev.nick || 'user';
      if (/^essola/i.test(nick)) nick = `${nick}_`;
      const user = { ...prev, id, nick, name: clean(req.name, 60) || prev.name || '', bio: clean(req.bio, 160) || prev.bio || '' };
      await put(`users/${id}.json`, user);
      // nick → id, for @mentions in the forum
      const nicks = await get('nicks.json', {});
      if (nicks[nick.toLowerCase()] !== id) await put('nicks.json', { ...nicks, [nick.toLowerCase()]: id });
      return reply(200, { user });
    }
    if (req.mode === 'user.get') {
      const id = uid(req.id);
      const [user, recipes, followers, follows] = await Promise.all([get(`users/${id}.json`, null), get(`users/${id}/recipes.json`, []), get(`users/${id}/followers.json`, []), get(`users/${id}/following.json`, [])]);
      return reply(200, { user, recipes, followers: followers.length, follows: follows.length, following: followers.includes(uid(req.viewer)) });
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
      const mine = (await get(`users/${me}/following.json`, [])).filter((x) => x !== target);
      if (req.on) mine.push(target);
      await put(`users/${me}/following.json`, mine);
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
    // ---- Forum: topics, threaded replies, likes, the official @essola account and notifications ----
    const ADMINS = ['5d94e597ea00166f5be0b0512fa5847f2f44bd49f682d6c8644f6571f434d32c'];
    const isAdmin = () => ADMINS.includes(crypto.createHash('sha256').update(String(req.email || '').trim().toLowerCase()).digest('hex'));
    const ESSOLA = { id: 'essola', nick: 'essola' };
    // Who is writing: the admin may post as @essola; nobody else may take that name.
    const authorOf = (me) => {
      if (req.official && isAdmin()) return ESSOLA;
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
      await ensureUser(get, put, uid(req.id), req.nick);
      const me = uid(req.id);
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
      await ensureUser(get, put, uid(req.id), req.nick);
      const me = uid(req.id);
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
      const me = uid(req.id);
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
      if (!isAdmin()) return reply(403, { error: 'not_admin' });
      const img = String(req.image || '');
      if (!/^[A-Za-z0-9+/=]+$/.test(img) || img.length > 900000) return reply(400, { error: 'bad_image' });
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      await put(`stories/img/${id}.json`, { data: img });
      const item = { id, title: clean(req.title, 40) || 'essola', text: clean(req.text, 300), link: clean(req.link, 200), at: new Date().toISOString() };
      await put('stories.json', [item, ...(await get('stories.json', []))].slice(0, 50));
      return reply(200, { item });
    }
    if (req.mode === 'stories.remove') {
      if (!isAdmin()) return reply(403, { error: 'not_admin' });
      await put('stories.json', (await get('stories.json', [])).filter((x) => x.id !== clean(req.sid, 20)));
      return reply(200, { ok: true });
    }
    if (req.mode === 'stories.img') {
      const x = await get(`stories/img/${clean(req.sid, 20)}.json`, null);
      return reply(x ? 200 : 404, x || { error: 'not_found' });
    }
    if (req.mode === 'notif.list') {
      const me = uid(req.id);
      return reply(200, { items: me ? await get(`notif/${me}.json`, []) : [] });
    }
    if (req.mode === 'social.get' || req.mode === 'social.like' || req.mode === 'social.comment' || req.mode === 'social.rate') {
      const key = `social/${crypto.createHash('sha1').update(String(req.key || '')).digest('hex')}.json`;
      const me = uid(req.id);
      const data = await get(key, { likes: [], comments: [] });
      if (req.mode === 'social.like' && me) {
        data.likes = data.likes.filter((x) => x !== me);
        if (req.on) data.likes.push(me);
        await put(key, data);
      }
      if (req.mode === 'social.comment' && me && clean(req.text, 500)) {
        await ensureUser(get, put, me, req.nick);
        data.comments = [...data.comments, { id: Date.now().toString(36), user: me, nick: clean(req.nick, 24) || 'user', text: clean(req.text, 500), at: new Date().toISOString() }].slice(-200);
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
      return reply(200, { likes: data.likes.length, liked: data.likes.includes(me), comments: data.comments.slice(-50), rating });
    }
    if (req.mode === 'catalog') {
      // Ready-made catalog built weekly by CI (scripts/build-catalog.ts), kept warm between calls.
      const [obf, letuList] = await Promise.all([loadCatalog(iam), loadLetu(iam)]);
      const words = String(req.q || '').toLowerCase().split(/\s+/).filter((w) => w.length > 1);
      // Without a text query the filtered and sorted list is kept in memory: switching sort or paging is instant.
      const memoKey = !words.length && `${letuList.length}|${obf.length}|${req.cat || ''}|${req.sort || ''}`;
      let list = memoKey && sortedMemo.get(memoKey);
      if (!list) {
        // Letual first: Russian shelf products the users actually buy; then Open Beauty Facts.
        list = [...letuList, ...obf];
        if (req.cat) list = list.filter((x) => x.c === req.cat);
        if (words.length) list = list.filter((x) => words.every((w) => `${x.t} ${x.b}`.toLowerCase().includes(w)));
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
      return reply(200, { items: await withCompositions(list.slice((page - 1) * size, page * size).map(({ g, ...x }) => x), iam), total: list.length });
    }
    if (req.mode === 'match') {
      // «Подбор средств»: catalog cards filtered by category, goal tags (any) and free-from tags (all), computed at build time.
      const cats = new Set((req.cats || []).map(String));
      const goals = String(req.goals || '').replace(/[^A-Z]/g, '');
      const free = String(req.free || '').replace(/[^a-z]/g, '');
      const base = await loadLetu(iam);
      // Before the catalog has been rebuilt with tags, filter by category only and let the app check the compositions.
      const tagged = base.some((x) => x.m);
      let list = base.filter((x) => !x.z && (!tagged || x.m) && (!cats.size || cats.has(x.c)));
      if (tagged && goals) list = list.filter((x) => [...goals].some((g) => x.m.includes(g)));
      if (tagged && free) list = list.filter((x) => [...free].every((f) => x.m.includes(f)));
      // How many of the chosen goals a product covers comes first, then the chosen order.
      const cover = (x) => (goals && x.m ? [...goals].filter((g) => x.m.includes(g)).length : 0);
      if (req.sort === 'rating') list = [...list].sort((a, b) => cover(b) - cover(a) || (b.r || 0) - (a.r || 0) || b.p - a.p);
      else if (req.sort === 'popular') list = [...list].sort((a, b) => cover(b) - cover(a) || b.p - a.p);
      else list = [...list].sort((a, b) => cover(b) - cover(a) || b.s - a.s || b.p - a.p);
      const size = Math.min(Number(req.size) || 30, 40);
      const page = Math.max(Number(req.page) || 1, 1);
      const items = await withCompositions(list.slice((page - 1) * size, page * size).map(({ g, ...x }) => x), iam);
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
      const withX = await withCompositions(top.map(({ x: { g, ...x } }) => x), iam);
      return reply(200, { items: withX.map((x, i) => ({ ...x, match: Math.round(top[i].sim * 100), common: top[i].hit })) });
    }
    if (req.mode === 'search') {
      return reply(200, { items: await searchCache(req.q, iam) });
    }
    if (req.mode === 'barcode.web') {
      // Unknown barcode: search the web (marketplaces, shops, barcode catalogs) for the product name.
      const code = String(req.barcode || '').replace(/\D/g, '');
      if (code.length < 8) return reply(400, { error: 'bad_barcode' });
      const cached = await cacheGet(`bcweb/${code}.json`, iam);
      if (cached) return reply(200, cached);
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
      if (code.length < 8 || ingredients.length < 3) return reply(400, { error: 'bad_product' });
      if (!(await cacheGet(keyFor({ barcode: code }), iam))) await cachePut(keyFor({ barcode: code }), iam, { title: String(req.title || '').slice(0, 200), ingredients, source: 'essola' });
      return reply(200, { ok: true });
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
    if (req.mode === 'label') {
      // Front of the pack → brand and name only: a small photo and a one-line answer keep it cheap.
      const image = String(req.image || '');
      if (!image || image.length > 3_000_000) return reply(400, { error: 'bad_image' });
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
      const found = await findByLabel(brand, name, kind, iam, textModel);
      return reply(200, { brand: brand.slice(0, 60), name: name.slice(0, 120), kind: kind.slice(0, 40), ...found, _usage: lastUsage });
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
