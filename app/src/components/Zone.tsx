import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, shadow } from '../theme';
import { Icon } from './Icon';
import { Press, tap } from './ui';

/** Compact dropdown ("Лицо ▾") that opens a small list of zones. */
export function Zone<K extends string>({ options, value, onChange }: { options: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void }) {
  const [open, setOpen] = useState(false);
  const label = options.find(([k]) => k === value)?.[1] ?? '';
  return (
    <>
      <Press haptic={false} onPress={() => { tap(); setOpen(true); }} style={styles.btn} accessibilityLabel={`Зона: ${label}`}>
        <Text style={styles.btnText}>{label}</Text>
        <Icon name="chevronDown" size={14} color={colors.ink} strokeWidth={2.2} />
      </Press>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {options.map(([k, l]) => (
              <Press key={k} haptic={false} onPress={() => { tap(); onChange(k); setOpen(false); }} style={styles.row}>
                <Text style={[styles.rowText, k === value && { color: colors.violet, fontFamily: fonts.semibold }]}>{l}</Text>
                {k === value && <Icon name="check" size={16} color={colors.violet} strokeWidth={2.2} />}
              </Press>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: 'rgba(21,23,43,0.06)' },
  btnText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(21,23,43,0.25)', justifyContent: 'center', padding: 40 },
  sheet: { backgroundColor: '#fff', borderRadius: 22, paddingVertical: 6, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 46 },
  rowText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
});
