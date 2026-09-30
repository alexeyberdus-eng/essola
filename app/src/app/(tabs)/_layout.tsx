import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../../components/Icon';
import { Press, tap } from '../../components/ui';
import { colors } from '../../theme';

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Лента' },
  wiki: { icon: 'book', label: 'Энциклопедия' },
  scanner: { icon: 'scan', label: 'Сканер' },
  analogs: { icon: 'swap', label: 'Аналоги' },
  profile: { icon: 'user', label: 'Кабинет' },
};

// Floating frosted-glass bar; the scanner sits in the middle as a raised honey button.
function TabBar({ state, navigation }: BarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  if (current === 'scanner') return null; // full-screen camera has its own close button

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.shadowBox}>
      <View style={styles.bar}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.86)' }]} />
        ) : (
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        )}
        {state.routes.map((route) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const on = current === route.name;
          if (route.name === 'scanner') {
            return (
              <Press
                key={route.key}
                haptic={false}
                onPress={() => {
                  tap('medium');
                  navigation.navigate('scanner');
                }}
                style={styles.fab}
                accessibilityLabel={tab.label}
              >
                <LinearGradient colors={[colors.honeyTop, colors.honeyBottom]} style={[StyleSheet.absoluteFill, { borderRadius: 17 }]} />
                <View style={{ zIndex: 1 }}>
                  <Icon name="scan" size={24} color={colors.ink} strokeWidth={1.7} />
                </View>
              </Press>
            );
          }
          return (
            <Press key={route.key} haptic={false} onPress={() => navigation.navigate(route.name)} style={[styles.item, on && styles.itemOn]} accessibilityLabel={tab.label}>
              <Icon name={tab.icon} size={21} color={on ? colors.ink : '#9A9588'} strokeWidth={on ? 1.8 : 1.5} />
            </Press>
          );
        })}
      </View>
      </View>
    </View>
  );
}

function glowSoft() {
  return Platform.select({
    ios: { shadowColor: '#3C2D0A', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 14 } },
    android: { elevation: 10 },
    default: { boxShadow: '0 18px 40px -12px rgba(60,45,10,0.28)' },
  }) as object;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }} tabBar={(props) => <TabBar {...(props as unknown as BarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wiki" />
      <Tabs.Screen name="scanner" />
      <Tabs.Screen name="analogs" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: {
    height: 66,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.92)',
  },
  // Shadow lives on a parent: iOS clips shadows of views with overflow hidden.
  shadowBox: { borderRadius: 24, backgroundColor: 'transparent', ...glowSoft() },
  item: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  itemOn: { backgroundColor: colors.honeySoft },
  fab: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
