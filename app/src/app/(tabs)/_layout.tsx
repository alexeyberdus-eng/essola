import { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../../components/Icon';
import { Press, tap } from '../../components/ui';
import { colors, fonts } from '../../theme';

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Лента' },
  shop: { icon: 'bag', label: 'Магазин' },
  scanner: { icon: 'barcode', label: 'Скан' },
  builder: { icon: 'flask', label: 'Конструктор' },
  profile: { icon: 'user', label: 'Кабинет' },
};
const ORDER = ['index', 'shop', 'scanner', 'builder', 'profile'];
const native = Platform.OS !== 'web';

// Floating liquid-glass bar: a glass capsule flows between tabs, the scanner is a raised olive button.
function TabBar({ state, navigation }: BarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const [width, setWidth] = useState(0);
  const slot = width / ORDER.length;
  const idx = Math.max(0, ORDER.indexOf(current));
  const x = useRef(new Animated.Value(0)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (!slot || current === 'scanner') return;
    const to = idx * slot + (slot - 58) / 2;
    if (first.current) {
      x.setValue(to);
      first.current = false;
      return;
    }
    // The capsule stretches like a drop while it travels, then settles.
    Animated.parallel([
      Animated.spring(x, { toValue: to, speed: 14, bounciness: 9, useNativeDriver: native }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1.45, duration: 120, useNativeDriver: native }),
        Animated.spring(stretch, { toValue: 1, speed: 10, bounciness: 14, useNativeDriver: native }),
      ]),
    ]).start();
  }, [idx, slot, current, x, stretch]);

  if (current === 'scanner') return null; // full-screen camera has its own close button

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom - 4, 12) }]}>
      <View style={styles.shadowBox}>
        <View style={styles.bar}>
          <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {!!slot && (
              <Animated.View style={[styles.capsule, { transform: [{ translateX: x }, { scaleX: stretch }] }]}>
                
              </Animated.View>
            )}
            {ORDER.map((name) => {
              const route = state.routes.find((r) => r.name === name);
              const tab = TABS[name];
              if (!route || !tab) return null;
              const on = current === name;
              if (name === 'scanner') {
                return (
                  <View key={route.key} style={styles.slot}>
                    <Press
                      haptic={false}
                      onPress={() => {
                        tap('medium');
                        navigation.navigate('scanner');
                      }}
                      style={styles.fab}
                      accessibilityLabel={tab.label}
                    >
                      <View style={[StyleSheet.absoluteFill, { borderRadius: 18, backgroundColor: colors.ink }]} />
                      <View style={{ zIndex: 1 }}>
                        <Icon name="barcode" size={24} color="#fff" strokeWidth={1.7} />
                      </View>
                    </Press>
                  </View>
                );
              }
              return (
                <Press key={route.key} haptic={false} onPress={() => { tap(); navigation.navigate(name); }} style={styles.slot} accessibilityLabel={tab.label}>
                  <View style={styles.item}>
                    <Icon name={tab.icon} size={21} color={on ? colors.ink : '#9A9DB0'} strokeWidth={on ? 1.9 : 1.5} />
                    <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                      {tab.label}
                    </Text>
                  </View>
                </Press>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function softShadow() {
  return Platform.select({
    ios: { shadowColor: '#28261A', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 14 } },
    android: { elevation: 10 },
    default: { boxShadow: '0 22px 46px -14px rgba(21,23,43,0.3)' },
  }) as object;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }} tabBar={(props) => <TabBar {...(props as unknown as BarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="shop" />
      <Tabs.Screen name="scanner" />
      <Tabs.Screen name="builder" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14 },
  shadowBox: { borderRadius: 28, ...softShadow() },
  bar: { height: 70, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: 'rgba(21,23,43,0.06)' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  item: { alignItems: 'center', gap: 3 },
  label: { fontFamily: fonts.medium, fontSize: 9.5, color: '#9A9DB0' },
  labelOn: { color: colors.ink, fontFamily: fonts.semibold },
  capsule: {
    position: 'absolute',
    left: 0,
    top: 8,
    width: 58,
    height: 56,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(21,23,43,0.05)',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
