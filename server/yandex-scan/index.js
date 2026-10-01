// Yandex Cloud Function for essola lab.
//  mode "scan":     label photo -> clean INCI list (vision model, Alice AI VLM by default)
//  mode "describe": ingredient list -> short "what this composition does" (text model)
//  mode "review":   builder formula -> technologist's advice: what to add / reduce / remove (text model)
//  mode "analogs":  composition -> Gold Apple products found via Yandex Search API, ranked by the text model
// Scores are NOT produced here: the app computes them from its own ingredient base.
// Env: YC_API_KEY, YC_FOLDER_ID, APP_KEY, VLM_MODEL (model id from AI Studio), TEXT_MODEL (default yandexgpt-lite).
const URL = 'https://llm.api.cloud.yandex.net/v1/chat/completions'; // OpenAI-compatible AI Studio API

const SCAN = `На фото упаковка косметики. Найди список ингредиентов (после «Состав», «Ingredients», «INCI») и верни ТОЛЬКО JSON:
{"ingredients":["Aqua","Glycerin",...]}
Правила: сохраняй порядок; каждый ингредиент — отдельный элемент; если состав на русском, переведи каждый ингредиент в международное название INCI (например «масло ши» → "Butyrospermum Parkii Butter", «пчелиный воск» → "Cera Alba"); раскрывай группы («масла: ши, касторовое» → два отдельных ингредиента); исправляй опечатки; не выдумывай того, чего нет на фото. Если состава не видно: {"ingredients":[]}. /no_think`;
const DESCRIBE = `Ты косметолог-технолог. По списку ингредиентов (по убыванию доли) коротко и понятно объясни, что даёт средство. Верни ТОЛЬКО JSON:
{"lead":"1–2 предложения: что это за средство и для какой кожи","effects":[{"title":"2–3 слова","text":"какие компоненты и что делают, до 12 слов"}],"use":["куда и как применять, до 12 слов"]}
effects: 2–4 пункта, use: 1–3 пункта. Без медицинских обещаний, без выдуманных ингредиентов.`;

const REVIEW = `Ты косметолог-технолог. Тебе дают черновик формулы (ингредиент и доля в %). Оцени её и подскажи, как улучшить. Верни ТОЛЬКО JSON:
{"verdict":"1–2 предложения: насколько формула рабочая и безопасная","add":[{"name":"ингредиент","pct":"0.5–1%","why":"до 12 слов"}],"reduce":[{"name":"ингредиент","to":"доля","why":"до 12 слов"}],"remove":[{"name":"ингредиент","why":"до 12 слов"}],"warn":["важное предупреждение, до 14 слов"]}
Внимательно определи роль каждого ингредиента (торговые названия вроде Olivem 1000 — это эмульгаторы, не советуй добавить то, что уже есть). Учитывай тип средства, сумму 100%, консервант для водных формул, эмульгатор для эмульсий, рабочие концентрации активов. Каждый список 0–3 пункта, пустой если нечего сказать. Без медицинских обещаний. /no_think`;
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

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Content-Type': 'application/json' };
const reply = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

async function chat(model, messages, maxTokens) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.YC_API_KEY}`, 'OpenAI-Project': process.env.YC_FOLDER_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: `gpt://${process.env.YC_FOLDER_ID}/${model}`, messages, temperature: 0.1, max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const msg = json?.choices?.[0]?.message ?? {};
  const text = (msg.content || msg.reasoning_content || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  console.log('model reply', json?.choices?.[0]?.finish_reason, JSON.stringify(json?.usage), text.slice(0, 300));
  const m = text.match(/\{[\s\S]*\}/);
  try {
    if (m) return JSON.parse(m[0]);
  } catch {}
  // Cut-off or sloppy JSON: salvage every quoted string after "ingredients".
  const tail = text.split(/"ingredients"\s*:/)[1];
  if (tail) return { ingredients: [...tail.matchAll(/"([^"\n]{2,80})"/g)].map((x) => x[1]) };
  return { raw: text.slice(0, 200) };
}

module.exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return reply(204, {});
  const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (process.env.APP_KEY && h['x-app-key'] !== process.env.APP_KEY) return reply(401, { error: 'unauthorized' });
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '{}';
    const req = JSON.parse(raw);
    const textModel = process.env.TEXT_MODEL || 'yandexgpt-lite/latest';
    if (req.mode === 'review') {
      const list = (req.items || []).slice(0, 40).join(', ');
      if (!list) return reply(400, { error: 'empty' });
      const out = await chat(process.env.REVIEW_MODEL || 'yandexgpt-5.1/latest', [{ role: 'user', content: `${REVIEW}\n\n${req.kind ? `Тип: ${req.kind}. ` : ''}Формула: ${list}` }], 1000);
      return reply(200, out);
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
      return reply(200, { items });
    }
    if (req.mode === 'describe') {
      const list = (req.ingredients || []).slice(0, 40).join(', ');
      if (!list) return reply(400, { error: 'empty' });
      const out = await chat(textModel, [{ role: 'system', content: DESCRIBE }, { role: 'user', content: `${req.kind ? `Тип: ${req.kind}. ` : ''}Состав: ${list}` }], 600);
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
        out = await chat(m, msg, 4000);
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
    return reply(200, ingredients.length ? { ingredients } : { ingredients, why: out.raw ?? '' });
  } catch (e) {
    console.error(e);
    return reply(500, { error: 'failed', detail: String(e && e.message || e).slice(0, 400) });
  }
};
