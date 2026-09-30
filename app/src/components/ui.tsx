import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
import { colors, fonts, glowShadow, radius, STRIP, type } from '../theme';
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
  hitSlop,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  hitSlop?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  // Layout props must sit on the Pressable itself, otherwise flex children collapse inside rows.
  const { flex, alignSelf, width, ...inner } = StyleSheet.flatten(style) ?? {};
  const outer = { flex, alignSelf, width };
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 4 }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={hitSlop}
      style={outer}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      onPress={() => {
        if (haptic) tap();
        onPress?.();
      }}
    >
      <Animated.View style={[inner, { transform: [{ scale }] }, disabled && { opacity: 0.4 }]}>{children}</Animated.View>
    </Pressable>
  );
}

type ButtonVariant = 'honey' | 'dark' | 'outline';
const BTN: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  honey: { bg: colors.honey, fg: colors.ink },
  dark: { bg: colors.ink, fg: colors.bg },
  outline: { bg: colors.card, fg: colors.ink, border: colors.line },
};

export function Button({
  label,
  onPress,
  icon,
  iconRight,
  variant = 'honey',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  iconRight?: IconName;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = BTN[variant];
  return (
    <Press
      onPress={onPress}
      disabled={disabled || loading}
      style={[s.btn, { backgroundColor: c.bg }, c.border ? { borderWidth: 1, borderColor: c.border } : null, variant === 'honey' && glowShadow, style]}
    >
      {variant === 'honey' && (
        // Silk accent: soft vertical honey gradient with a light top edge.
        <LinearGradient colors={[colors.honeyTop, colors.honeyBottom]} style={[StyleSheet.absoluteFill, s.btnFill]} />
      )}
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <View style={s.btnContent}>
          {icon && <Icon name={icon} size={18} color={c.fg} strokeWidth={1.8} />}
          <Text style={[s.btnText, { color: c.fg }]}>{label}</Text>
          {iconRight && <Icon name={iconRight} size={18} color={c.fg} strokeWidth={1.8} />}
        </View>
      )}
    </Press>
  );
}

export function IconButton({ icon, onPress, label, color = colors.ink }: { icon: IconName; onPress?: () => void; label: string; color?: string }) {
  return (
    <Press onPress={onPress} style={s.iconBtn} accessibilityLabel={label}>
      <Icon name={icon} size={19} color={color} />
    </Press>
  );
}

/** Horizontal row of small segment chips. */
export function Seg<K extends string>({
  options,
  value,
  onChange,
  small,
  inset = 0,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  small?: boolean;
  inset?: number;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -inset }} contentContainerStyle={{ gap: 6, paddingHorizontal: inset }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Press key={o.key} onPress={() => onChange(o.key)} style={[s.seg, small && s.segSm, on && s.segOn]}>
            <Text style={[s.segText, small && { fontSize: 12 }, on && { color: colors.ink, fontFamily: fonts.semibold }]}>{o.label}</Text>
          </Press>
        );
      })}
    </ScrollView>
  );
}

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'honey' }) {
  const [bg, fg] = {
    neutral: [colors.surf, colors.ink2],
    good: [colors.goodSoft, colors.good],
    warn: [colors.warnSoft, colors.warn],
    bad: [colors.badSoft, colors.bad],
    honey: [colors.honeySoft, colors.honeyText],
  }[tone];
  return (
    <View style={[s.tag, { backgroundColor: bg }]}>
      <Text style={[s.tagText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.line }, style]} />;
}

export function Wordmark({ size = 25, badge = 'lab' }: { size?: number; badge?: string | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityRole="header" accessibilityLabel="Essola">
      <Text style={{ fontFamily: fonts.semibold, fontSize: size, letterSpacing: -size * 0.055, color: colors.ink }}>essola</Text>
      {badge && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

/** Score shown as a pH-style indicator strip with a pointer at the value. */
export function ScoreStrip({ value }: { value: number }) {
  return (
    <View>
      <View style={s.strip}>
        {STRIP.map((c) => (
          <View key={c} style={[s.stripCell, { backgroundColor: c }]} />
        ))}
        <View style={[s.pointer, { left: `${Math.min(98, Math.max(2, value))}%` }]} />
      </View>
      <View style={s.scale}>
        <Text style={type.mono}>0 · риск</Text>
        <Text style={type.mono}>50</Text>
        <Text style={type.mono}>100 · чисто</Text>
      </View>
    </View>
  );
}

export function MetricTable({ rows }: { rows: [string, number][] }) {
  return (
    <View>
      {rows.map(([label, v]) => (
        <View key={label} style={s.metric}>
          <Text style={s.metricLabel}>{label}</Text>
          <View style={s.metricBar}>
            <View style={[s.metricFill, { width: `${v}%` }]} />
          </View>
          <Text style={s.metricValue}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

export function SectionHead({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        {kicker && <T v="label">{kicker}</T>}
        <T v="heading">{title}</T>
      </View>
      {right}
    </View>
  );
}

export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.honeyText }}>{label}</Text>
      <Icon name="arrowRight" size={14} color={colors.honeyText} />
    </Press>
  );
}

const s = StyleSheet.create({
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 1 },
  btnFill: { borderRadius: 14, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  btn: { height: 52, borderRadius: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontFamily: fonts.semibold, fontSize: 15 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  seg: { height: 34, paddingHorizontal: 14, borderRadius: 99, backgroundColor: colors.surf, justifyContent: 'center' },
  segSm: { height: 30, paddingHorizontal: 12, borderRadius: 99 },
  segOn: { backgroundColor: colors.honey },
  segText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  tag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
  tagText: { fontFamily: fonts.medium, fontSize: 11.5 },
  badge: { backgroundColor: colors.honey, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, marginTop: 2 },
  badgeText: { fontFamily: fonts.monoMedium, fontSize: 9, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.ink },
  strip: { flexDirection: 'row', gap: 3, height: 14, marginTop: 10 },
  stripCell: { flex: 1, borderRadius: 3 },
  pointer: {
    position: 'absolute',
    top: -9,
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.ink,
  },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line },
  metricLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  metricBar: { width: '38%', height: 4, borderRadius: 2, backgroundColor: colors.surf },
  metricFill: { height: 4, borderRadius: 2, backgroundColor: colors.ink },
  metricValue: { width: 28, textAlign: 'right', fontFamily: fonts.monoMedium, fontSize: 13, color: colors.ink },
});
