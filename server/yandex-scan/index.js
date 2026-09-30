// Yandex Cloud Function: photo of a label -> clean INCI list.
// Step 1: Vision OCR reads the text. Step 2: YandexGPT Lite fixes typos and keeps only the ingredient list.
// Env: YC_API_KEY (service-account API key), YC_FOLDER_ID, APP_KEY (shared secret the app sends in X-App-Key).
const OCR_URL = 'https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText';
const GPT_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

const PROMPT = `Ты помогаешь разбирать состав косметики по тексту с фото упаковки. Текст распознан автоматически и может содержать опечатки, переносы и лишние строки (срок годности, адрес, инструкции).
Найди список ингредиентов (обычно после слов «Состав», «Ingredients», «INCI») и верни ТОЛЬКО JSON без пояснений:
{"ingredients": ["Aqua", "Glycerin", ...]}
Правила: сохраняй исходный порядок; исправляй очевидные опечатки в названиях INCI (Glycerln → Glycerin, Niacinam ide → Niacinamide); склеивай слова, разорванные переносом; не добавляй ингредиенты, которых нет в тексте; если состава нет, верни {"ingredients": []}.`;

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Content-Type': 'application/json' };
const reply = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
const auth = { Authorization: `Api-Key ${process.env.YC_API_KEY}`, 'x-folder-id': process.env.YC_FOLDER_ID, 'Content-Type': 'application/json' };

async function ocr(base64) {
  const res = await fetch(OCR_URL, { method: 'POST', headers: auth, body: JSON.stringify({ mimeType: 'JPEG', languageCodes: ['ru', 'en'], model: 'page', content: base64 }) });
  if (!res.ok) throw new Error(`OCR ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json?.result?.textAnnotation?.fullText ?? '';
}

async function clean(text) {
  const res = await fetch(GPT_URL, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      modelUri: `gpt://${process.env.YC_FOLDER_ID}/yandexgpt-lite/latest`,
      completionOptions: { stream: false, temperature: 0, maxTokens: '1200' },
      messages: [{ role: 'system', text: PROMPT }, { role: 'user', text: text.slice(0, 6000) }],
    }),
  });
  if (!res.ok) throw new Error(`GPT ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const out = json?.result?.alternatives?.[0]?.message?.text ?? '';
  const m = out.match(/\{[\s\S]*\}/);
  const list = m ? JSON.parse(m[0]).ingredients : [];
  return Array.isArray(list) ? list.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : [];
}

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return reply(204, {});
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (process.env.APP_KEY && headers['x-app-key'] !== process.env.APP_KEY) return reply(401, { error: 'unauthorized' });
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '{}';
    const { image } = JSON.parse(raw);
    if (!image || image.length > 12_000_000) return reply(400, { error: 'bad_image' });
    const text = await ocr(image.replace(/^data:image\/\w+;base64,/, ''));
    let ingredients = [];
    try {
      ingredients = text.trim() ? await clean(text) : [];
    } catch (e) {
      console.error(e); // GPT is optional: fall back to raw OCR text
    }
    return reply(200, { text, ingredients });
  } catch (e) {
    console.error(e);
    return reply(500, { error: 'scan_failed' });
  }
};
