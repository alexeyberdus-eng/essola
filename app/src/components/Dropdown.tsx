import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, LAVENDER } from '../theme';
import { Icon } from './Icon';
import { Press, tap } from './ui';

type Option = { key: string; label: string };

/**
 * A compact pill: small caption, the chosen value and a chevron. Tapping opens a sheet with the options.
 * Single choice by default; `multi` lets several be picked (the sheet then closes with «Готово»).
 */
export function Dropdown({
  label,
  options,
  value,
  onChange,
  multi,
  allowNone,
  placeholder = 'Любое',
  style,
}: {
  label: string;
  options: Option[];
  value: string | string[] | null;
  onChange: (v: string | string[] | null) => void;
  multi?: boolean;
  /** single choice: offer an «any» row that clears the value */
  allowNone?: boolean;
  placeholder?: string;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const picked = Array.isArray(value) ? value : value ? [value] : [];
  const shown = picked.length ? (picked.length === 1 ? options.find((o) => o.key === picked[0])?.label ?? placeholder : `${options.find((o) => o.key === picked[0])?.label} +${picked.length - 1}`) : placeholder;
  const active = picked.length > 0;
  const choose = (k: string) => {
    tap();
    if (!multi) {
      onChange(k);
      setOpen(false);
      return;
    }
    onChange(picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k]);
  };
  return (
    <>
      <Press haptic={false} onPress={() => { tap(); setOpen(true); }} style={[styles.pill, active && styles.pillOn, style]} accessibilityLabel={`${label}: ${shown}`}>
        {active && <LinearGradient colors={['#F4F0FF', '#EAE3FF']} style={StyleSheet.absoluteFill} />}
        <Text style={styles.caption} numberOfLines={1}>{label}</Text>
        <View style={styles.row}>
          <Text style={[styles.value, active && { color: colors.violetDeep }]} numberOfLines={1}>{shown}</Text>
          <Icon name="chevronDown" size={13} color={active ? colors.violet : colors.muted} strokeWidth={2.2} />
        </View>
      </Press>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.shade} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grab} />
          <View style={styles.head}>
            <Text style={styles.title}>{label}</Text>
            {multi && picked.length > 0 && (
              <Press haptic={false} onPress={() => onChange([])} accessibilityLabel="Сбросить">
                <Text style={styles.reset}>Сбросить</Text>
              </Press>
            )}
          </View>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 6 }}>
            {!multi && allowNone && (
              <Option label={placeholder} on={!picked.length} onPress={() => { tap(); onChange(null); setOpen(false); }} />
            )}
            {options.map((o) => (
              <Option key={o.key} label={o.label} on={picked.includes(o.key)} multi={multi} onPress={() => choose(o.key)} />
            ))}
          </ScrollView>
          {multi && (
            <Press onPress={() => setOpen(false)} style={styles.done}>
              <LinearGradient colors={LAVENDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.doneText}>Готово</Text>
            </Press>
          )}
        </View>
      </Modal>
    </>
  );
}

function Option({ label, on, multi, onPress }: { label: string; on: boolean; multi?: boolean; onPress: () => void }) {
  return (
    <Press haptic={false} onPress={onPress} style={[styles.opt, on && styles.optOn]}>
      <Text style={[styles.optText, on && { color: colors.violetDeep, fontFamily: fonts.semibold }]}>{label}</Text>
      {multi ? (
        <View style={[styles.box, on && styles.boxOn]}>{on && <Icon name="check" size={13} color="#fff" strokeWidth={2.6} />}</View>
      ) : (
        on && <Icon name="check" size={17} color={colors.violet} strokeWidth={2.4} />
      )}
    </Press>
  );
}

const styles = StyleSheet.create({
  pill: { flex: 1, minWidth: 0, height: 54, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E1F1', overflow: 'hidden' },
  pillOn: { borderColor: 'rgba(138,116,242,0.45)' },
  caption: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  value: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  shade: { flex: 1, backgroundColor: 'rgba(21,23,43,0.28)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#E2E0EE', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  reset: { fontFamily: fonts.semibold, fontSize: 14, color: colors.violet },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 50, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#F7F6FC' },
  optOn: { backgroundColor: '#EFEAFF' },
  optText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#C9C4E0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  done: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 14 },
  doneText: { fontFamily: fonts.semibold, fontSize: 16, color: '#fff' },
});
