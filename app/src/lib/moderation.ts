import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { myId, socialEnabled } from './social';
import { readJSON, writeJSON } from './storage';
import { cloud, setSession } from './cloud';

// What the App Store asks of apps with user content: report content, hide (block) users, accept community rules
// before posting, and delete the account from inside the app.

const url = process.env.EXPO_PUBLIC_SCAN_URL;
const key = process.env.EXPO_PUBLIC_SCAN_KEY ?? '';
async function call(body: object) {
  const res = await fetch(url!, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Key': key }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`MOD_${res.status}`);
  return res.json();
}

const BLOCKED = 'essola.blocked';
const RULES = 'essola.rulesAccepted';
let blocked: string[] = [];
const listeners = new Set<(b: string[]) => void>();
readJSON<string[]>(BLOCKED, []).then((b) => {
  blocked = b;
  listeners.forEach((f) => f(b));
});

/** Users this person chose to hide: their posts, comments and reviews are not shown. */
export function useBlocked() {
  const [list, setList] = useState(blocked);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  const isBlocked = useCallback((id?: string) => !!id && list.includes(id), [list]);
  return { blocked: list, isBlocked };
}

function setBlocked(next: string[]) {
  blocked = next;
  writeJSON(BLOCKED, next);
  listeners.forEach((f) => f(next));
}

export async function report(kind: string, target: string, author: string | undefined, text: string, reason: string) {
  if (!socialEnabled) return;
  await call({ mode: 'report', id: await myId(), kind, target, author, text: text.slice(0, 300), reason }).catch(() => {});
}

/** "…" on someone's post: report it or hide its author. */
export function moderate(opts: { kind: string; target: string; author?: { id: string; nick: string }; text: string }) {
  const author = opts.author;
  const reasons = ['Оскорбление или травля', 'Спам или реклама', 'Опасный совет', 'Другое'];
  Alert.alert(author ? `@${author.nick}` : 'Сообщение', undefined, [
    {
      text: 'Пожаловаться',
      onPress: () =>
        Alert.alert('Что не так?', 'Мы проверим сообщение в течение суток и удалим его, если оно нарушает правила.', [
          ...reasons.map((r) => ({
            text: r,
            onPress: () => {
              report(opts.kind, opts.target, author?.id, opts.text, r);
              Alert.alert('Спасибо', 'Жалоба отправлена.');
            },
          })),
          { text: 'Отмена', style: 'cancel' as const },
        ]),
    },
    ...(author && author.id !== 'essola'
      ? [
          {
            text: `Скрыть @${author.nick}`,
            style: 'destructive' as const,
            onPress: () => {
              setBlocked([...new Set([...blocked, author.id])]);
              Alert.alert('Пользователь скрыт', 'Вы больше не увидите его сообщения. Вернуть можно в кабинете → «Скрытые пользователи».');
            },
          },
        ]
      : []),
    { text: 'Отмена', style: 'cancel' as const },
  ]);
}

export function unblockAll() {
  setBlocked([]);
}

/** Before the first post: the community rules must be accepted once. Resolves true when they are. */
export async function ensureRules(): Promise<boolean> {
  if (await readJSON<boolean>(RULES, false)) return true;
  return new Promise((resolve) =>
    Alert.alert(
      'Правила сообщества',
      'Пишите уважительно: без оскорблений, травли, спама и рекламы. Не давайте медицинских обещаний — делитесь опытом. Сообщения с нарушениями удаляются, а авторы блокируются.',
      [
        { text: 'Прочитать полностью', onPress: () => (router.push('/legal' as never), resolve(false)) },
        { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Принимаю',
          onPress: () => {
            writeJSON(RULES, true);
            resolve(true);
          },
        },
      ],
    ),
  );
}

/** Explains a refused post. */
export function postError(e: unknown) {
  if (String(e).includes('400')) Alert.alert('Не отправлено', 'В сообщении есть недопустимые слова. Перефразируйте, пожалуйста.');
  else Alert.alert('Не отправлено', 'Проверьте интернет и попробуйте ещё раз.');
}

/** Deletes everything the person published, their account on our server and the data on this phone. */
export async function deleteAccount() {
  if (socialEnabled) await call({ mode: 'user.delete', id: await myId() }).catch(() => {});
  await cloud('account.delete').catch(() => {});
  await setSession(null);
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((k) => k.startsWith('essola.') || k.startsWith('ai:') || k.startsWith('ai2:'));
  await AsyncStorage.multiRemove(keys).catch(() => {});
}
