// One-off: reads essola.ru to fill product cards (names, descriptions, photo URLs).
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1' };
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\n\s*\n+/g, '\n').trim();
const abs = (u, base) => { try { return new URL(u, base).href; } catch { return null; } };
const res = await fetch('https://essola.ru/', { headers: UA });
const html = await res.text();
console.log('STATUS', res.status, 'LEN', html.length, 'TITLE', (html.match(/<title>([^<]*)/i) || [])[1]);
const imgs = [...new Set([...html.matchAll(/(?:src|data-src|data-original|href|content)=["']([^"']+\.(?:png|jpe?g|webp)(?:\?[^"']*)?)["']/gi)].map((m) => abs(m[1], 'https://essola.ru/')))];
console.log('IMAGES', imgs.length);
imgs.forEach((u) => console.log('IMG', u));
const bg = [...html.matchAll(/url\(['"]?([^'")]+\.(?:png|jpe?g|webp))/gi)].map((m) => abs(m[1], 'https://essola.ru/'));
bg.forEach((u) => console.log('BG', u));
const links = [...new Set([...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => abs(m[1], 'https://essola.ru/')).filter((u) => u && u.includes('essola.ru')))];
console.log('LINKS', links.length);
links.forEach((u) => console.log('LINK', u));
console.log('TEXT-----\n' + strip(html).slice(0, 6000));
for (const u of links.filter((x) => !/\.(css|js|png|jpe?g|webp|svg|ico)(\?|$)/.test(x)).slice(0, 25)) {
  try {
    const r = await fetch(u, { headers: UA });
    const h = await r.text();
    const og = (h.match(/property=["']og:image["'][^>]+content=["']([^"']+)/i) || [])[1];
    console.log(`\nPAGE ${u} ${r.status} og:${og || '-'}\n` + strip(h).slice(0, 1500));
  } catch (e) { console.log('PAGE ERR', u, String(e)); }
}
