import type { Recipe } from '../data/recipes';
import { readJSON, writeJSON } from './storage';

// Community features live on our Yandex Cloud function next to the product base.
const url = process.env.EXPO_PUBLIC_SCAN_URL;
const key = process.env.EXPO_PUBLIC_SCAN_KEY ?? '';
export const socialEnabled = !!url;

async function call<T>(body: object): Promise<T> {
  const res = await fetch(url!, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Key': key }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`SOCIAL_${res.status}`);
  return (await res.json()) as T;
}

let cachedId: string | null = null;
/** Stable anonymous id of this device's profile. */
export async function myId() {
  if (cachedId) return cachedId;
  let id = await readJSON<string | null>('essola.uid', null);
  if (!id) {
    id = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await writeJSON('essola.uid', id);
  }
  cachedId = id;
  return id;
}

export type PublicUser = { id: string; nick: string; name?: string; bio?: string };
export type CommunityItem = { user: PublicUser; recipe: Recipe; at: string };
export type Social = { likes: number; liked: boolean; comments: { id: string; user: string; nick: string; text: string; at: string }[]; rating?: { avg: number; count: number; mine: number } };

export async function saveMe(nick: string, name?: string | null) {
  if (!socialEnabled) return;
  await call({ mode: 'user.save', id: await myId(), nick, name: name ?? '' }).catch(() => {});
}

export async function publishRecipe(recipe: Recipe) {
  if (!socialEnabled) return;
  await call({ mode: 'recipe.publish', id: await myId(), recipe: { ...recipe, own: false, photo: undefined } }).catch(() => {});
}

export async function recentRecipes(): Promise<CommunityItem[]> {
  if (!socialEnabled) return [];
  return (await call<{ items: CommunityItem[] }>({ mode: 'community.recent' })).items ?? [];
}

export async function getUser(id: string) {
  return call<{ user: PublicUser | null; recipes: Recipe[]; followers: number; follows?: number; following: boolean }>({ mode: 'user.get', id, viewer: await myId() });
}

export async function follow(target: string, on: boolean) {
  const res = await call<{ followers: number; following: boolean }>({ mode: 'follow', id: await myId(), target, on });
  const list = await readJSON<string[]>('essola.following', []);
  await writeJSON('essola.following', on ? [...new Set([...list, target])] : list.filter((x) => x !== target));
  return res;
}

export async function social(key: string): Promise<Social> {
  return call<Social>({ mode: 'social.get', key, id: await myId() });
}
export async function like(key: string, on: boolean): Promise<Social> {
  return call<Social>({ mode: 'social.like', key, on, id: await myId() });
}
export async function rate(key: string, stars: number): Promise<Social> {
  return call<Social>({ mode: 'social.rate', key, stars, id: await myId() });
}
export async function comment(key: string, nick: string, text: string): Promise<Social> {
  return call<Social>({ mode: 'social.comment', key, nick, text, id: await myId() });
}


export type ForumAuthor = { id: string; nick: string };
export type TopicRow = { id: string; title: string; cat: string; author: ForumAuthor; at: string; last: string; replies: number; likes?: number; preview: string };
export type ForumPost = { id: string; parent?: string | null; author: ForumAuthor; text: string; at: string; likes?: string[] };
export type Topic = { id: string; title: string; text: string; cat: string; author: ForumAuthor; at: string; likes?: string[]; posts: ForumPost[] };
/** Admin posting as the official @essola account (checked on the server by the admin's email). */
export type AsOfficial = { email: string } | null;
export const FORUM_CATS = ['Общее', 'Рецепты', 'Уход за кожей', 'Волосы', 'Ингредиенты', 'Покупки'];

export async function forumList(cat?: string, page = 1) {
  if (!socialEnabled) return { items: [] as TopicRow[], total: 0 };
  return call<{ items: TopicRow[]; total: number }>({ mode: 'forum.list', cat, page });
}
export async function forumGet(tid: string) {
  return (await call<{ topic: Topic }>({ mode: 'forum.get', tid })).topic;
}
export async function forumCreate(nick: string, title: string, text: string, cat: string, official: AsOfficial = null) {
  return (await call<{ id: string }>({ mode: 'forum.create', id: await myId(), nick, title, text, cat, official: !!official, email: official?.email })).id;
}
export async function forumReply(tid: string, nick: string, text: string, parent: string | null = null, official: AsOfficial = null) {
  return (await call<{ topic: Topic }>({ mode: 'forum.reply', tid, id: await myId(), nick, text, parent, official: !!official, email: official?.email })).topic;
}
export async function forumLike(tid: string, pid: string | null, on: boolean, nick: string) {
  return (await call<{ topic: Topic }>({ mode: 'forum.like', tid, pid, on, nick, id: await myId() })).topic;
}
export type Notice = { id: string; at: string; type: 'reply' | 'topic' | 'mention' | 'like'; tid: string; title: string; from: string; text: string };
export async function notifications(): Promise<Notice[]> {
  if (!socialEnabled) return [];
  return (await call<{ items: Notice[] }>({ mode: 'notif.list', id: await myId() })).items ?? [];
}

/** Recipes the admin published from a table. */
export async function editorialList(): Promise<Recipe[]> {
  if (!socialEnabled) return [];
  return (await call<{ items: Recipe[] }>({ mode: 'editorial.list' })).items ?? [];
}
export async function editorialAdd(email: string, recipes: Recipe[]) {
  return call<{ count: number }>({ mode: 'editorial.add', email, recipes });
}

/** Stories the admin posted (images are fetched separately, see storyImage). */
export type ServerStory = { id: string; title: string; text: string; link?: string; at: string };
export async function storiesList(): Promise<ServerStory[]> {
  if (!socialEnabled) return [];
  return (await call<{ items: ServerStory[] }>({ mode: 'stories.list' }).catch(() => ({ items: [] }))).items ?? [];
}
export async function storyImage(sid: string): Promise<string | null> {
  const r = await call<{ data?: string }>({ mode: 'stories.img', sid }).catch(() => null);
  return r?.data ? `data:image/jpeg;base64,${r.data}` : null;
}
export async function storyAdd(email: string, title: string, text: string, image: string) {
  return (await call<{ item: ServerStory }>({ mode: 'stories.add', email, title, text, image })).item;
}
export async function storyRemove(email: string, sid: string) {
  await call({ mode: 'stories.remove', email, sid });
}
