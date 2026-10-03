import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// VK ID (id.vk.com), OAuth 2.1 with PKCE: no secret on the phone. VK only redirects to the https address registered
// for the app, so it points at our scan function, which bounces the code back into the app (Expo Go or the build).
const clientId = process.env.EXPO_PUBLIC_VK_ID;
const bounce = process.env.EXPO_PUBLIC_SCAN_URL;
export const vkEnabled = !!clientId && !!bounce;

export type VkUser = { id: string; firstName: string; lastName: string; email: string | null; avatar: string | null; /** checked by our server, which then opens the account */ accessToken: string };

const b64url = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = () => b64url(Crypto.randomUUID() + Crypto.randomUUID()).replace(/-/g, '');

async function form(url: string, body: Record<string, string>) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error_description || json.error || `VK_${res.status}`);
  return json;
}

/** Opens VK ID, returns the person's VK profile, or null when they closed the window. */
export async function signInWithVk(): Promise<VkUser | null> {
  if (!vkEnabled) throw new Error('Вход через VK ID пока не настроен');
  const verifier = randomString();
  const challenge = b64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  const back = Linking.createURL('vk');
  // The function keeps where to return under this state (it only redirects to app links: exp://, essola://).
  const state = randomString().slice(0, 40);
  const reg = await fetch(bounce!, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Key': process.env.EXPO_PUBLIC_SCAN_KEY ?? '' }, body: JSON.stringify({ mode: 'vk.start', state, back }) }).catch(() => null);
  if (!reg?.ok) throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
  const redirect = bounce!;
  const auth = `https://id.vk.com/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: clientId!,
    redirect_uri: redirect,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'vkid.personal_info email',
  }).toString()}`;
  const res = await WebBrowser.openAuthSessionAsync(auth, back);
  if (res.type !== 'success') return null;
  const q = Linking.parse(res.url).queryParams ?? {};
  const code = String(q.code ?? '');
  if (!code || q.state !== state) throw new Error('VK не подтвердил вход. Попробуйте ещё раз.');
  const token = await form('https://id.vk.com/oauth2/auth', {
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    client_id: clientId!,
    device_id: String(q.device_id ?? ''),
    redirect_uri: redirect,
    state,
  });
  const info = await form('https://id.vk.com/oauth2/user_info', { client_id: clientId!, access_token: token.access_token });
  const u = info.user ?? {};
  return { id: String(u.user_id ?? token.user_id), firstName: u.first_name ?? '', lastName: u.last_name ?? '', email: u.email || null, avatar: u.avatar || null, accessToken: token.access_token };
}
