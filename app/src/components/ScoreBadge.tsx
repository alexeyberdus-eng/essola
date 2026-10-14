import { StyleSheet, Text, View } from 'react-native';
import { fonts, scoreColor } from '../theme';

/** Square score tile: the number in the score colour inside a frame of the same colour. */
export function ScoreBadge({ value, size = 46 }: { value: number; size?: number }) {
  const c = scoreColor(value);
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.3, borderColor: c, backgroundColor: `${c}14` }]}>
      <Text style={[styles.num, { color: c, fontSize: size * 0.36 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: fonts.display, textAlign: 'center' },
});
