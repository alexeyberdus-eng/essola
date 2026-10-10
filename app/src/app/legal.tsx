import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glow } from '../components/silk';
import { IconButton, Press, tap } from '../components/ui';
import { colors, fonts, space } from '../theme';
import { DOCS, Key } from '../data/legal';


/** Community rules, privacy policy and terms of use. */
export default function Legal() {
  const insets = useSafeAreaInsets();
  const [k, setK] = useState<Key>('rules');
  const d = DOCS[k];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <View style={{ height: 52, justifyContent: 'center' }}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>
        <View style={styles.seg}>
          {(
            [
              ['rules', 'Правила'],
              ['privacy', 'Данные'],
              ['terms', 'Условия'],
            ] as const
          ).map(([key, l]) => (
            <Press key={key} haptic={false} onPress={() => { tap(); setK(key); }} style={[styles.segItem, k === key && styles.segOn]}>
              <Text style={[styles.segText, k === key && { color: '#fff' }]}>{l}</Text>
            </Press>
          ))}
        </View>
        <Text style={styles.h1}>{d.title}</Text>
        <Text style={styles.updated}>Редакция от {d.updated}</Text>
        {d.sections.map((x) => (
          <View key={x.h} style={styles.block}>
            <Text style={styles.h2}>{x.h}</Text>
            <Text style={styles.p}>{x.p}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E1F1', gap: 4 },
  segItem: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.accent },
  segText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  h1: { fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.8, color: colors.ink, marginTop: 20 },
  updated: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 4 },
  block: { marginTop: 18, gap: 6 },
  h2: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  p: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink2 },
});
