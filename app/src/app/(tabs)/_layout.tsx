import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Press, tap } from '../../components/ui';
import { colors, fonts } from '../../theme';

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

// Two text tabs with the scanner as a raised honey button in the middle — the app's main action.
function TabBar({ state, navigation }: BarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  if (current === 'scanner') return null; // the camera is full-screen and has its own close button

  const item = (name: string, label: string, icon: 'flask' | 'user') => {
    const on = current === name;
    return (
      <Press haptic={false} onPress={() => navigation.navigate(name)} style={styles.item} accessibilityLabel={label}>
        <Icon name={icon} size={21} color={on ? colors.ink : colors.muted} />
        <Text style={[styles.label, on && { color: colors.ink }]}>{label}</Text>
      </Press>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {item('index', 'Формулы', 'flask')}
      <Press
        onPress={() => {
          tap('medium');
          navigation.navigate('scanner');
        }}
        haptic={false}
        style={styles.fab}
        accessibilityLabel="Сканер составов"
      >
        <Icon name="scan" size={26} color={colors.ink} strokeWidth={1.7} />
      </Press>
      {item('profile', 'Кабинет', 'user')}
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
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 10,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  item: { width: 90, alignItems: 'center', gap: 4 },
  label: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.honey,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: colors.honey,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
