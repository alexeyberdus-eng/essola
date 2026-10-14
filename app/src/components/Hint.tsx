import { useEffect, useState } from 'react';
import { LayoutAnimation, StyleSheet, Text, View } from 'react-native';
import { readJSON, writeJSON } from '../lib/storage';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';
import { Press } from './ui';

/** First-visit tip for a section: shown once, gone for good after «Понятно». */
export function Hint({ id, title, text }: { id: string; title: string; text: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    readJSON<boolean>(`hint.${id}`, false).then((seen) => !seen && setShow(true));
  }, [id]);
  if (!show) return null;
  return (
    <View style={styles.box}>
      <View style={styles.icon}>
        <Icon name="spark" size={16} color="#fff" strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
        <Press
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShow(false);
            writeJSON(`hint.${id}`, true);
          }}
          style={styles.ok}
        >
          <Text style={styles.okText}>Понятно</Text>
        </Press>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 12, padding: 14, marginTop: 12, borderRadius: 20, backgroundColor: '#F1ECFF', borderWidth: 1, borderColor: '#DCD2FF' },
  icon: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink2, marginTop: 2 },
  ok: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 14, height: 32, borderRadius: 99, backgroundColor: colors.violet, justifyContent: 'center' },
  okText: { fontFamily: fonts.semibold, fontSize: 13, color: '#fff' },
});
