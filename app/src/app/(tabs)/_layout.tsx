import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../../components/Icon';
import { Glass } from '../../components/lab';
import { Press, tap } from '../../components/ui';
import { colors, fonts } from '../../theme';

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Лента' },
  wiki: { icon: 'book', label: 'Знания' },
  scanner: { icon: 'barcode', label: 'Скан' },
  builder: { icon: 'flask', label: 'Конструктор' },
  profile: { icon: 'user', label: 'Кабинет' },
};
const ORDER = ['index', 'wiki', 'scanner', 'builder', 'profile'];
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
        <Glass style={styles.bar} intensity={55} tint="rgba(250,247,240,0.5)" interactive>
          <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {!!slot && (
              <Animated.View style={[styles.capsule, { transform: [{ translateX: x }, { scaleX: stretch }] }]}>
                <LinearGradient colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.45)']} style={StyleSheet.absoluteFill} />
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
                      <LinearGradient colors={[colors.olive2, colors.olive]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 19 }]} />
                      <View style={{ zIndex: 1 }}>
                        <Icon name="barcode" size={24} color={colors.brassLight} strokeWidth={1.7} />
                      </View>
                    </Press>
                  </View>
                );
              }
              return (
                <Press key={route.key} haptic={false} onPress={() => { tap(); navigation.navigate(name); }} style={styles.slot} accessibilityLabel={tab.label}>
                  <View style={styles.item}>
                    <Icon name={tab.icon} size={21} color={on ? colors.sageDeep : '#958F80'} strokeWidth={on ? 1.8 : 1.5} />
                    <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                      {tab.label}
                    </Text>
                  </View>
                </Press>
              );
            })}
          </View>
        </Glass>
      </View>
    </View>
  );
}

function softShadow() {
  return Platform.select({
    ios: { shadowColor: '#28261A', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 14 } },
    android: { elevation: 10 },
    default: { boxShadow: '0 22px 46px -14px rgba(40,38,25,0.38)' },
  }) as object;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }} tabBar={(props) => <TabBar {...(props as unknown as BarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wiki" />
      <Tabs.Screen name="scanner" />
      <Tabs.Screen name="builder" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14 },
  shadowBox: { borderRadius: 28, ...softShadow() },
  bar: { height: 72, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  item: { alignItems: 'center', gap: 3 },
  label: { fontFamily: fonts.medium, fontSize: 9.5, color: '#958F80' },
  labelOn: { color: colors.ink, fontFamily: fonts.semibold },
  capsule: {
    position: 'absolute',
    left: 0,
    top: 8,
    width: 58,
    height: 56,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    ...Platform.select({
      ios: { shadowColor: '#28261A', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      default: {},
    }),
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(216,188,134,0.5)',
  },
});
