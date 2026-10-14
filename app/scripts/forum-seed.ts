// Writes the forum's starter topics (from src/data/forum-faq.ts) for the server: each is a topic by @essola
// with @essola's answer as the first reply. Run: npx tsx scripts/forum-seed.ts
import { writeFileSync } from 'fs';
import { FAQ } from '../src/data/forum-faq';

const ESSOLA = { id: 'essola', nick: 'essola' };
const base = Date.parse('2026-10-03T09:00:00Z');
const topics = FAQ.map((f, i) => {
  const at = new Date(base - i * 7 * 60000).toISOString();
  return {
    id: f.id,
    title: f.title,
    text: `Нас часто об этом спрашивают: «${f.q}»${f.tags.length ? `\n\n${f.tags.map((t) => `#${t.replace(/\s+/g, '_')}`).join(' ')}` : ''}`,
    cat: f.cat,
    author: ESSOLA,
    at,
    likes: [],
    posts: [{ id: 'a1', parent: null, author: ESSOLA, text: f.a, at, likes: [] }],
  };
});
writeFileSync(new URL('../../server/yandex-scan/forum-seed.json', import.meta.url), JSON.stringify(topics));
console.log('forum seed topics', topics.length);
