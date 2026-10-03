import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../components/Icon';
import { Button, Hairline, Press, T, tap, Wordmark } from '../components/ui';
import { vkEnabled } from '../lib/vk';
import { useAuth } from '../context/AuthContext';
import { colors, fonts, radius, space } from '../theme';

const PERKS: [IconName, string][] = [
  ['heart', 'Избранные рецепты на всех устройствах'],
  ['history', 'История ваших сканов составов'],
  ['user', 'Разбор под ваш тип кожи'],
];

const NICK_A = ['glow', 'silk', 'petal', 'honey', 'velvet', 'aqua', 'rose', 'lilac', 'pearl', 'mint', 'peach', 'lotus', 'amber', 'dewy', 'sunny'];
const NICK_B = ['lab', 'potion', 'drop', 'serum', 'bloom', 'balm', 'mist', 'cream', 'leaf', 'cloud', 'flask', 'muse'];
/** Friendly English nickname like "silk_potion27". */
function makeNick() {
  const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];
  return `${pick(NICK_A)}_${pick(NICK_B)}${Math.floor(Math.random() * 90 + 10)}`;
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { appleAvailable, signInWithApple, signInWithVk, requestEmailCode, verifyEmailCode, updateProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [nick, setNick] = useState(makeNick);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'nick'>('email');
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  const done = () => {
    tap('success');
    close();
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code !== 'ERR_REQUEST_CANCELED') setError(err.message ?? 'Что-то пошло не так');
    } finally {
      setBusy(false);
    }
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Press onPress={close} style={styles.close} accessibilityLabel="Закрыть">
            <Icon name="close" size={18} />
          </Press>
        </View>

        <View style={styles.brand}>
          <Wordmark size={34} />
          <T v="label">Лаборатория домашней косметики</T>
        </View>

        <Text style={styles.title}>Войдите, чтобы сохранить всё важное</Text>

        <View style={styles.perks}>
          {PERKS.map(([icon, text]) => (
            <View key={text} style={styles.perk}>
              <Icon name={icon} size={17} color={colors.honeyText} />
              <T style={{ flex: 1 }}>{text}</T>
            </View>
          ))}
        </View>

        {step !== 'nick' && Platform.OS === 'ios' && appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={14}
            style={styles.apple}
            onPress={() => run(async () => {
              const r = await signInWithApple();
              if (r.needsNick) {
                setNick(makeNick());
                setStep('nick');
              } else done();
            })}
          />
        )}

        {step !== 'nick' && vkEnabled && (
          <Press
            onPress={() => run(async () => {
              // After VK the person always picks their public nickname.
              const r = await signInWithVk();
              if (!r) return;
              if (r.needsNick) {
                setNick(makeNick());
                setStep('nick');
              } else done();
            })}
            disabled={busy}
            style={[styles.vk, Platform.OS === 'ios' && appleAvailable && { marginTop: 10 }]}
            accessibilityLabel="Войти через VK ID"
          >
            <Text style={styles.vkLogo}>VK</Text>
            <Text style={styles.vkText}>Войти через VK ID</Text>
          </Press>
        )}

        {step !== 'nick' && ((Platform.OS === 'ios' && appleAvailable) || vkEnabled) && (
          <View style={styles.or}>
            <Hairline style={{ flex: 1 }} />
            <T v="label">или по почте</T>
            <Hairline style={{ flex: 1 }} />
          </View>
        )}

        {step === 'nick' ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.title}>Вы вошли! Придумайте ник</Text>
            <T>Его увидят на форуме и в комментариях. Имя и почта не показываются.</T>
            <View style={styles.field}>
              <Text style={styles.at}>@</Text>
              <TextInput value={nick} onChangeText={(v) => setNick(v.replace(/[^a-z0-9_.]/gi, '').toLowerCase().slice(0, 24))} placeholder="ник" placeholderTextColor={colors.faint} autoCapitalize="none" autoFocus style={styles.input} />
              <Press haptic={false} onPress={() => setNick(makeNick())} hitSlop={8} accessibilityLabel="Другой ник">
                <Icon name="swap" size={17} color={colors.violet} />
              </Press>
            </View>
            <Button
              label="Готово"
              loading={busy}
              disabled={nick.length < 3}
              onPress={() =>
                run(async () => {
                  await updateProfile({ nick });
                  done();
                })
              }
            />
          </View>
        ) : step === 'email' ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={[styles.field, { flex: 1 }]}>
                <TextInput value={first} onChangeText={setFirst} placeholder="Имя" placeholderTextColor={colors.faint} style={styles.input} autoComplete="given-name" />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <TextInput value={last} onChangeText={setLast} placeholder="Фамилия" placeholderTextColor={colors.faint} style={styles.input} autoComplete="family-name" />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.at}>@</Text>
              <TextInput value={nick} onChangeText={(v) => setNick(v.replace(/[^a-z0-9_.]/gi, '').toLowerCase().slice(0, 24))} placeholder="ник" placeholderTextColor={colors.faint} autoCapitalize="none" style={styles.input} />
              <Press haptic={false} onPress={() => setNick(makeNick())} hitSlop={8} accessibilityLabel="Другой ник">
                <Icon name="swap" size={17} color={colors.violet} />
              </Press>
            </View>
            <View style={styles.field}>
              <Icon name="mail" size={18} color={colors.muted} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
                returnKeyType="next"
              />
            </View>
            <Button
              label="Получить код"
              loading={busy}
              disabled={!validEmail}
              onPress={() =>
                run(async () => {
                  const res = await requestEmailCode(email.trim());
                  setDemo(res.demo);
                  setStep('code');
                })
              }
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <T>
              {demo ? 'Демо-режим: сервер не подключён, подойдёт любой код из 6 цифр.' : `Мы отправили 6-значный код на ${email.trim()}. Введите его ниже.`}
            </T>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              placeholderTextColor={colors.faint}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              style={styles.code}
              maxLength={6}
              autoFocus
            />
            <Button
              label="Войти"
              loading={busy}
              disabled={code.length !== 6}
              onPress={() =>
                run(async () => {
                  await verifyEmailCode(email.trim(), code, { name: [first.trim(), last.trim()].filter(Boolean).join(' ') || undefined, nick: nick || undefined });
                  done();
                })
              }
            />
            <Press
              onPress={() => {
                setStep('email');
                setCode('');
              }}
              style={{ alignSelf: 'center', padding: 8 }}
            >
              <T v="label">Изменить почту</T>
            </Press>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <T v="small" style={{ textAlign: 'center', marginTop: 'auto', paddingTop: space.xl }}>
          Продолжая, вы соглашаетесь с условиями использования и политикой конфиденциальности Essola.
        </T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  at: { fontFamily: fonts.semibold, fontSize: 16, color: colors.violet },
  wrap: { flexGrow: 1, paddingHorizontal: space.gutter + 4, gap: space.xl },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  brand: { alignItems: 'center', gap: 10, marginTop: space.md },
  title: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 31, letterSpacing: -0.9, color: colors.ink, textAlign: 'center' },
  perks: { gap: 12, padding: 18, borderRadius: radius.lg, backgroundColor: colors.honeySoft },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  apple: { height: 54, width: '100%' },
  vk: { height: 54, borderRadius: 14, backgroundColor: '#0077FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  vkLogo: { fontFamily: fonts.bold, fontSize: 15, color: '#0077FF', backgroundColor: '#fff', borderRadius: 7, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 1 },
  vkText: { fontFamily: fonts.semibold, fontSize: 17, color: '#fff' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  input: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  code: {
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 28,
    letterSpacing: 12,
    color: colors.ink,
  },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.bad, textAlign: 'center' },
});
