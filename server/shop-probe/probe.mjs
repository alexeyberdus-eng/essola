// Diagnostic: where Letual keeps the composition in its product JSON.
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const id = '3288';
const walk = (o, path = '', out = []) => {
  if (typeof o === 'string') {
    if (/aqua|glycerin|dimethicone|состав|ingredient/i.test(o)) out.push(`${path} = ${JSON.stringify(o.slice(0, 300))}`);
  } else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
    if (/sostav|ingred|compos|состав/i.test(k)) out.push(`KEY ${path}.${k} = ${JSON.stringify(v).slice(0, 300)}`);
    walk(v, `${path}.${k}`, out);
  }
  return out;
};
for (const u of [
  `https://www.letu.ru/s/api/product/v3/product-detail/${id}?locale=ru-RU&pushSite=storeMobileRU`,
  `https://www.letu.ru/s/api/product/v1/multi/${id}?pushSite=storeMobileRU`,
  `https://www.letu.ru/storeru/product/x/${id}?pushSite=storeMobileRU&format=json&locale=ru-RU`,
]) {
  try {
    const r = await fetch(u, { headers: UA });
    const t = await r.text();
    console.log('\n==', r.status, t.length, u);
    let j;
    try { j = JSON.parse(t); } catch { console.log(t.slice(0, 300)); continue; }
    console.log('top keys:', Object.keys(j).slice(0, 40).join(','));
    console.log(walk(j).slice(0, 15).join('\n'));
  } catch (e) { console.log('err', u, String(e)); }
}
