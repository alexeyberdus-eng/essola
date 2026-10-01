// Yandex Cloud Function for essola lab.
//  mode "scan":     label photo -> clean INCI list (vision model, Alice AI VLM by default)
//  mode "describe": ingredient list -> short "what this composition does" (text model)
// Scores are NOT produced here: the app computes them from its own ingredient base.
// Env: YC_API_KEY, YC_FOLDER_ID, APP_KEY, VLM_MODEL (model id from AI Studio), TEXT_MODEL (default yandexgpt-lite).
const URL = 'https://llm.api.cloud.yandex.net/v1/chat/completions'; // OpenAI-compatible AI Studio API

const SCAN = `На фото упаковка косметики. Найди список ингредиентов (после «Состав», «Ingredients», «INCI») и верни ТОЛЬКО JSON:
{"ingredients":["Aqua","Glycerin",...]}
Правила: сохраняй порядок; каждый ингредиент — отдельный элемент; если состав на русском, переведи каждый ингредиент в международное название INCI (например «масло ши» → "Butyrospermum Parkii Butter", «пчелиный воск» → "Cera Alba"); раскрывай группы («масла: ши, касторовое» → два отдельных ингредиента); исправляй опечатки; не выдумывай того, чего нет на фото. Если состава не видно: {"ingredients":[]}.`;
const DESCRIBE = `Ты косметолог-технолог. По списку ингредиентов (по убыванию доли) коротко и понятно объясни, что даёт средство. Верни ТОЛЬКО JSON:
{"lead":"1–2 предложения: что это за средство и для какой кожи","effects":[{"title":"2–3 слова","text":"какие компоненты и что делают, до 12 слов"}],"use":["куда и как применять, до 12 слов"]}
effects: 2–4 пункта, use: 1–3 пункта. Без медицинских обещаний, без выдуманных ингредиентов.`;

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Content-Type': 'application/json' };
const reply = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

async function chat(model, messages, maxTokens) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.YC_API_KEY}`, 'OpenAI-Project': process.env.YC_FOLDER_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: `gpt://${process.env.YC_FOLDER_ID}/${model}`, messages, temperature: 0.1, max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${await res.text()}`);
  const text = (await res.json())?.choices?.[0]?.message?.content ?? '';
  const m = text.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : {};
}

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return reply(204, {});
  const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (process.env.APP_KEY && h['x-app-key'] !== process.env.APP_KEY) return reply(401, { error: 'unauthorized' });
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '{}';
    const req = JSON.parse(raw);
    if (req.mode === 'describe') {
      const list = (req.ingredients || []).slice(0, 40).join(', ');
      if (!list) return reply(400, { error: 'empty' });
      const out = await chat(process.env.TEXT_MODEL || 'yandexgpt-lite/latest', [{ role: 'system', content: DESCRIBE }, { role: 'user', content: `${req.kind ? `Тип: ${req.kind}. ` : ''}Состав: ${list}` }], 600);
      return reply(200, out);
    }
    const image = String(req.image || '');
    if (!image || image.length > 12_000_000) return reply(400, { error: 'bad_image' });
    const url = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
    // Vision models differ per account; try the configured one first, then known multimodal ids.
    const models = [process.env.VLM_MODEL, 'aliceai-vlm/latest', 'qwen3.6-35b-a3b/latest', 'qwen3.6-35b/latest', 'qwen2.5-vl-32b-instruct/latest', 'gemma-3-27b-it/latest'].filter(Boolean);
    const msg = [{ role: 'user', content: [{ type: 'text', text: SCAN }, { type: 'image_url', image_url: { url } }] }];
    let out = null, last;
    for (const m of models) {
      try {
        out = await chat(m, msg, 1200);
        console.log('vision model ok:', m);
        break;
      } catch (e) {
        last = e;
        if (!/ (400|403|404):/.test(String(e.message))) throw e;
      }
    }
    if (!out) throw last;
    const ingredients = Array.isArray(out.ingredients) ? out.ingredients.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : [];
    return reply(200, { ingredients });
  } catch (e) {
    console.error(e);
    return reply(500, { error: 'failed', detail: String(e && e.message || e).slice(0, 400) });
  }
};
