import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

// Vector rendition of "The ESSOLA" wordmark: high-contrast Didone caps, script "The"
// and the oil drop hanging from the O. Sizes are derived from `size` (cap height in px).
export function Logo({ size = 22, color = colors.ink, showThe = true }: { size?: number; color?: string; showThe?: boolean }) {
  const letter = { fontFamily: 'BodoniModa_400Regular', fontSize: size * 1.38, lineHeight: size * 1.5, color, includeFontPadding: false } as const;
  const gap = size * 0.42;
  const drop = size * 0.34;
  return (
    <View style={{ paddingTop: showThe ? size * 1.25 : 0, paddingBottom: drop * 0.9 }} accessibilityRole="header" accessibilityLabel="The Essola">
      {showThe && (
        <Text style={[styles.the, { fontSize: size * 1.55, lineHeight: size * 1.9, color, left: -size * 0.1, top: -size * 0.3 }]}>The</Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap }}>
        {['E', 'S', 'S'].map((l, i) => (
          <Text key={i} style={letter}>
            {l}
          </Text>
        ))}
        <View>
          <Text style={letter}>O</Text>
          <Svg width={drop} height={drop * 1.5} viewBox="0 0 20 30" style={{ position: 'absolute', bottom: -drop * 1.1, alignSelf: 'center' }}>
            <Path d="M10 0 C 10 8 18 14 18 21 A 8 8 0 0 1 2 21 C 2 14 10 8 10 0 Z" fill={color} />
          </Svg>
        </View>
        {['L', 'A'].map((l) => (
          <Text key={l} style={letter}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Drop-under-O monogram for avatars and compact spots. */
export function LogoMark({ size = 40, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'BodoniModa_400Regular', fontSize: size * 0.72, lineHeight: size * 0.8, color, marginTop: -size * 0.12 }}>O</Text>
      <Svg width={size * 0.16} height={size * 0.24} viewBox="0 0 20 30" style={{ position: 'absolute', bottom: size * 0.04 }}>
        <Path d="M10 0 C 10 8 18 14 18 21 A 8 8 0 0 1 2 21 C 2 14 10 8 10 0 Z" fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  the: { position: 'absolute', fontFamily: 'MrsSaintDelafield_400Regular' },
});
