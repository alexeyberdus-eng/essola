import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Glow } from '../components/silk';
import { Button, IconButton } from '../components/ui';
import { colors, fonts, space } from '../theme';

/** A product from the base whose composition the shop doesn't show: its card with a quiet note instead of a score. */
export default function ItemScreen() {
  const insets = useSafeAreaInsets();
  const { title, brand, image, url } = useLocalSearchParams<{ title?: string; brand?: string; image?: string; url?: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <View style={{ height: 52, justifyContent: 'center' }}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/shop'))} />
        </View>
        <View style={styles.photo}>
          {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" /> : <Icon name="drop" size={40} color={colors.faint} />}
        </View>
        {!!brand && <Text style={styles.brand}>{brand}</Text>}
        <Text style={styles.title}>{title}</Text>
        <View style={styles.note}>
          <Icon name="alert" size={18} color={colors.violet} />
          <Text style={styles.noteText}>Состав недоступен</Text>
        </View>
        <Button label="Сфотографировать состав" icon="camera" onPress={() => router.navigate('/scanner')} style={{ marginTop: 18 }} />
        {!!url && <Button label="Открыть в магазине" icon="external" variant="outline" onPress={() => Linking.openURL(url).catch(() => {})} style={{ marginTop: 10 }} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { height: 280, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6F7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brand: { fontFamily: fonts.semibold, fontSize: 12.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.violet, marginTop: 18 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, letterSpacing: -0.6, color: colors.ink, marginTop: 4 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: colors.tint },
  noteText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
