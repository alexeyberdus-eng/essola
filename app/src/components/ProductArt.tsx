import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { SITE } from '../data/shop-site';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import type { Product } from '../data/shop';
import { colors, fonts } from '../theme';

const TONES: Record<string, [string, string]> = {
  Масла: ['#F1EDFF', '#A77BFF'],
  'Эфирные масла': ['#FFF0F9', '#E08BF5'],
  Гидролаты: ['#EEF1FF', '#8C9CFF'],
  'Глины и маски': ['#F6F5F9', '#B9A6E0'],
  'Для бороды': ['#EFEAF8', '#6A4BF2'],
  Аксессуары: ['#EEF7F2', '#7FC7A0'],
};

/** Product visual: a bottle/jar silhouette tinted by category. */
export function ProductArt({ p, height = 110 }: { p: Product; height?: number }) {
  const photo = SITE[p.id]?.image;
  if (photo)
    return (
      <View style={[styles.art, { height, backgroundColor: '#F6F3EE' }]}>
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" transition={150} />
        <Text style={styles.volume}>{p.volume}</Text>
      </View>
    );
  const [bg, tone] = TONES[p.category] ?? TONES['Масла'];
  const jar = p.category === 'Глины и маски';
  const small = p.category === 'Эфирные масла';
  return (
    <View style={[styles.art, { height, backgroundColor: bg }]}>
      <Svg width="100%" height="100%" viewBox="0 0 120 100">
        <Defs>
          <SvgGradient id={`g${p.id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tone} stopOpacity="0.55" />
            <Stop offset="1" stopColor={tone} stopOpacity="0.95" />
          </SvgGradient>
        </Defs>
        {jar ? (
          <>
            <Rect x="38" y="30" width="44" height="10" rx="4" fill={colors.ink} />
            <Rect x="35" y="39" width="50" height="46" rx="12" fill="rgba(255,255,255,0.7)" stroke="rgba(22,18,31,0.1)" />
            <Rect x="35" y="58" width="50" height="27" rx="12" fill={`url(#g${p.id})`} />
          </>
        ) : (
          <>
            <Rect x={small ? 55 : 53} y={small ? 26 : 14} width={small ? 10 : 14} height={small ? 12 : 18} rx="3" fill={colors.ink} />
            <Path d={small ? 'M50 38h20v44a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6Z' : 'M46 32h28v50a7 7 0 0 1-7 7H53a7 7 0 0 1-7-7Z'} fill="rgba(255,255,255,0.7)" stroke="rgba(22,18,31,0.1)" />
            <Path d={small ? 'M50 58h20v24a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6Z' : 'M46 56h28v26a7 7 0 0 1-7 7H53a7 7 0 0 1-7-7Z'} fill={`url(#g${p.id})`} />
            <Rect x={small ? 53 : 50} y={small ? 44 : 40} width={small ? 14 : 20} height="9" rx="2" fill="#fff" opacity="0.9" />
          </>
        )}
      </Svg>
      <Text style={styles.volume}>{p.volume}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  art: { borderRadius: 14, overflow: 'hidden' },
  volume: { position: 'absolute', left: 8, top: 8, fontFamily: fonts.semibold, fontSize: 11, color: colors.ink2, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' },
});
