import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../../components/Icon';
import { Press } from '../../components/ui';
import { colors, fonts } from '../../theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Рецепты', icon: 'flask' },
  scanner: { label: 'Сканер', icon: 'scan' },
  profile: { label: 'Кабинет', icon: 'user' },
};

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

// Floating frosted pill instead of the stock tab bar.
function TabBar({ state, navigation }: BarProps) {
  const insets = useSafeAreaInsets();
  const onScanner = state.routes[state.index]?.name === 'scanner';
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <View style={[styles.bar, onScanner && styles.barDark]}>
        {Platform.OS === 'ios' && <BlurView intensity={40} tint={onScanner ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const active = state.index === i;
          const fg = onScanner ? (active ? colors.night : colors.nightInk) : active ? colors.paper : colors.ink2;
          return (
            <Press
              key={route.key}
              accessibilityLabel={tab.label}
              onPress={() => navigation.navigate(route.name)}
              style={[styles.item, active && (onScanner ? styles.itemActiveDark : styles.itemActive)]}
            >
              <Icon name={tab.icon} size={19} color={fg} />
              {active && <Text style={[styles.label, { color: fg }]}>{tab.label}</Text>}
            </Press>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <TabBar {...(props as unknown as BarProps)} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="scanner" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    gap: 4,
    padding: 5,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(251,249,244,0.72)' : 'rgba(251,249,244,0.97)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
    shadowColor: '#2B2110',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  barDark: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(31,28,23,0.6)' : 'rgba(31,28,23,0.95)',
    borderColor: colors.nightLine,
  },
  item: { height: 46, minWidth: 54, paddingHorizontal: 16, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  itemActive: { backgroundColor: colors.ink },
  itemActiveDark: { backgroundColor: colors.nightInk },
  label: { fontFamily: fonts.medium, fontSize: 13.5 },
});
