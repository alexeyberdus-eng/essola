import * as Haptics from 'expo-haptics';
import { ReactNode, useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleProp, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts, radius, scoreColor, type } from '../theme';
import { Icon, IconName } from './Icon';

export function T({ v = 'body', style, ...rest }: TextProps & { v?: keyof typeof type }) {
  return <Text {...rest} style={[type[v], style]} />;
}

export function tap(kind: 'light' | 'medium' | 'success' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Pressable that gently sinks on touch — used for every tappable surface. */
export function Press({
  children,
  onPress,
  style,
  disabled,
  haptic = true,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 4 }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      onPress={() => {
        if (haptic) tap();
        onPress?.();
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.45 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: 'primary' | 'outline' | 'ghost' | 'light';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = variant === 'primary' ? colors.paper : colors.ink;
  return (
    <Press onPress={onPress} disabled={disabled || loading} style={[s.btn, s[`btn_${variant}`], style]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={19} color={fg} />}
          <Text style={[s.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Press>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Press onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && { color: colors.paper }]}>{label}</Text>
    </Press>
  );
}

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'gold' }) {
  const map = {
    neutral: [colors.paper, colors.ink2, colors.line],
    good: ['#EDF1E8', colors.good, '#D6E0CC'],
    warn: ['#F7EEDC', colors.warn, '#EADBB9'],
    bad: ['#F5E6E1', colors.bad, '#EBCFC6'],
    gold: [colors.goldSoft, colors.goldDeep, '#E4D2AC'],
  }[tone];
  return (
    <View style={[s.tag, { backgroundColor: map[0], borderColor: map[2] }]}>
      <Text style={[s.tagText, { color: map[1] }]}>{label}</Text>
    </View>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line2 }, style]} />;
}

export function ScoreRing({ value, size = 64, stroke = 3, label, dark }: { value: number; size?: number; stroke?: number; label?: string; dark?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const col = scoreColor(value);
  return (
    <View style={{ alignItems: 'center', gap: 8, flex: label ? 1 : undefined }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? colors.nightLine : colors.line} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={col}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(c * value) / 100} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <Text style={{ fontFamily: fonts.medium, fontSize: size * 0.3, letterSpacing: -0.5, color: dark ? colors.nightInk : colors.ink }}>{value}</Text>
      </View>
      {label && (
        <Text numberOfLines={1} adjustsFontSizeToFit style={[type.label, { fontSize: 8.5, letterSpacing: 0.5, textAlign: 'center' }, dark && { color: colors.nightMuted }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

export function SectionTitle({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1, gap: 6 }}>
        {kicker && <T v="label">{kicker}</T>}
        <T v="heading" style={{ fontSize: 21, lineHeight: 26 }}>
          {title}
        </T>
      </View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btn_primary: { backgroundColor: colors.ink },
  btn_outline: { borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card },
  btn_ghost: { backgroundColor: 'transparent' },
  btn_light: { backgroundColor: colors.paper },
  btnText: { fontFamily: fonts.medium, fontSize: 15.5, letterSpacing: -0.1 },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line2,
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink2 },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  tagText: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.8, textTransform: 'uppercase' },
});
