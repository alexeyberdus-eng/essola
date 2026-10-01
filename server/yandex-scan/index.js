// Yandex Cloud Function for essola lab.
//  mode "scan":     label photo -> clean INCI list (vision model, Alice AI VLM by default)
//  mode "describe": ingredient list -> short "what this composition does" (text model)
//  mode "review":   builder formula -> technologist's advice: what to add / reduce / remove (text model)
//  mode "analogs":  composition -> Gold Apple products found via Yandex Search API, ranked by the text model
// Scores are NOT produced here: the app computes them from its own ingredient base.
// Env: YC_API_KEY, YC_FOLDER_ID, APP_KEY, VLM_MODEL (model id from AI Studio), TEXT_MODEL (default yandexgpt-lite).
const URL = 'https://llm.api.cloud.yandex.net/v1/chat/completions'; // OpenAI-compatible AI Studio API

const SCAN = `Выпиши с фото состав косметики (после «Состав»/«Ingredients») по порядку, каждый ингредиент в INCI (русские переведи: «масло ши» → Butyrospermum Parkii Butter), группы раскрывай, опечатки исправляй, ничего не выдумывай. Ответ — только список через «; ». Нет состава — пустой ответ. /no_think`;
const DESCRIBE = `Ты косметолог-технолог. По списку ингредиентов (по убыванию доли) коротко и понятно объясни, что даёт средство. Верни ТОЛЬКО JSON:
{"lead":"1–2 предложения: что это за средство и для какой кожи","effects":[{"title":"2–3 слова","text":"какие компоненты и что делают, до 12 слов"}],"use":["куда и как применять, до 12 слов"]}
effects: 2–4 пункта, use: 1–3 пункта. Без медицинских обещаний, без выдуманных ингредиентов.`;

const REVIEW = `Ты косметолог-технолог. Дана формула: ингредиент, доля, роль. Базовые проверки (сумма, консервант, эмульгатор, pH) уже сделаны — не повторяй их, кроме случаев из «Замечания». Дай точечные улучшения. Ответ строго строками, без пояснений и markdown:
В: вывод одним предложением
+ ингредиент | доля | зачем (до 8 слов)
- ингредиент | до какой доли | почему (до 8 слов)
x ингредиент | почему (до 8 слов)
! важное предупреждение (до 10 слов)
Строк «+», «-», «x», «!» — по 0–2, только по делу. /no_think`;
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

let lastUsage;
async function chat(model, messages, maxTokens, raw = false) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.YC_API_KEY}`, 'OpenAI-Project': process.env.YC_FOLDER_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: `gpt://${process.env.YC_FOLDER_ID}/${model}`, messages, temperature: 0.1, max_tokens: maxTokens }),
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
      const notes = (req.notes || []).slice(0, 6).join('; ');
      const text = await chat(process.env.REVIEW_MODEL || 'yandexgpt-5.1/latest', [{ role: 'user', content: `${REVIEW}\n\n${req.kind ? `Тип: ${req.kind}\n` : ''}Формула: ${list}${notes ? `\nЗамечания: ${notes}` : ''}` }], 350, true);
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
        const t = await chat(m, msg, 2500, true);
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
    return reply(200, ingredients.length ? { ingredients, _usage: lastUsage } : { ingredients, why: out.raw ?? '', _usage: lastUsage });
  } catch (e) {
    console.error(e);
    return reply(500, { error: 'failed', detail: String(e && e.message || e).slice(0, 400) });
  }
};
