import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { LikeButton, VialTile } from '../../components/RecipeRow';
import { Button, IconButton, Press, T, tap } from '../../components/ui';
import { getRecipe } from '../../data/recipes';
import { stepMinutes } from '../../lib/formula';
import { colors, fonts, radius, space } from '../../theme';

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function Timer({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          setRunning(false);
          tap('success');
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);

  return (
    <View style={styles.timer}>
      <View>
        <Text style={styles.timerValue}>{mmss(left)}</Text>
        <Press haptic={false} onPress={() => (setRunning(false), setLeft(minutes * 60))}>
          <T v="small">{left === 0 ? 'Готово · сбросить' : 'Сбросить'}</T>
        </Press>
      </View>
      <Press onPress={() => setRunning((r) => !r)} style={styles.play} accessibilityLabel={running ? 'Пауза' : 'Запустить таймер'}>
        <Icon name={running ? 'pause' : 'play'} size={20} color={colors.ink} strokeWidth={2} />
      </Press>
    </View>
  );
}

export default function CookScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = getRecipe(id);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0); // 0 — preparation checklist, 1..n — steps, n+1 — done
  const [have, setHave] = useState<Set<number>>(new Set());

  if (!recipe) return null;
  const total = recipe.steps.length;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const go = (d: number) => {
    tap();
    setStep((s) => Math.max(0, Math.min(total + 1, s + d)));
  };

  const title = step === 0 ? 'Подготовка' : step > total ? 'Готово' : `Шаг ${step} из ${total}`;
  const minutes = step >= 1 && step <= total ? stepMinutes(recipe.steps[step - 1]) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 6 }}>
      <View style={styles.nav}>
        <IconButton icon="close" label="Закрыть" onPress={close} />
        <Text style={styles.navTitle} numberOfLines={1}>
          {recipe.title} · {title}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.progress}>
        {Array.from({ length: total + 1 }).map((_, i) => (
          <View key={i} style={[styles.seg, i <= step ? styles.segOn : null]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: 140 }}>
        {step === 0 && (
          <>
            <T v="label">Соберите всё заранее</T>
            <Text style={styles.big}>Отметьте, что уже на столе</Text>
            {recipe.ingredients.map((ing, i) => {
              const on = have.has(i);
              return (
                <Press
                  key={ing.name}
                  haptic={false}
                  onPress={() => {
                    tap();
                    setHave((p) => {
                      const n = new Set(p);
                      n.has(i) ? n.delete(i) : n.add(i);
                      return n;
                    });
                  }}
                  style={styles.check}
                >
                  <View style={[styles.box, on && styles.boxOn]}>{on && <Icon name="check" size={14} color={colors.ink} strokeWidth={2.2} />}</View>
                  <Text style={[styles.checkName, on && styles.struck]}>{ing.name}</Text>
                  <Text style={styles.checkAmount}>{ing.amount}</Text>
                </Press>
              );
            })}
            <T v="small" style={{ marginTop: 14 }}>
              Продезинфицируйте посуду и инструменты спиртом и дайте высохнуть.
            </T>
          </>
        )}

        {step >= 1 && step <= total && (
          <>
            <T v="label">Шаг {step}</T>
            <Text style={styles.big}>{recipe.steps[step - 1]}</Text>
            {minutes && <Timer key={step} minutes={minutes} />}
            {step === total && (
              <View style={styles.tip}>
                <Icon name="spark" size={16} color={colors.honeyText} />
                <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{recipe.tip}</T>
              </View>
            )}
          </>
        )}

        {step > total && (
          <View style={{ alignItems: 'center', gap: 14, paddingTop: 30 }}>
            <VialTile recipe={recipe} size={88} />
            <Text style={[styles.big, { textAlign: 'center' }]}>{recipe.title} готов</Text>
            <T style={{ textAlign: 'center' }}>Подпишите баночку датой. Срок годности: {recipe.shelfLife}.</T>
            <LikeButton id={recipe.id} withCount />
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
        {step > 0 && step <= total && <Button label="Назад" icon="arrowLeft" variant="outline" onPress={() => go(-1)} style={{ paddingHorizontal: 18 }} />}
        {step > total ? (
          <Button label="Завершить" onPress={close} style={{ flex: 1 }} />
        ) : (
          <Button label={step === 0 ? 'Начать' : step === total ? 'Завершить' : 'Следующий шаг'} iconRight="arrowRight" onPress={() => go(1)} style={{ flex: 1 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, gap: 10 },
  navTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: space.gutter, marginTop: 14 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surf },
  segOn: { backgroundColor: colors.honey },
  big: { fontFamily: fonts.semibold, fontSize: 25, lineHeight: 31, letterSpacing: -0.8, color: colors.ink, marginTop: 10, marginBottom: 20 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderColor: colors.line },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  boxOn: { backgroundColor: colors.honey, borderColor: colors.honey },
  checkName: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  struck: { color: colors.faint, textDecorationLine: 'line-through' },
  checkAmount: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.ink2 },
  timer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.honeySoft, borderRadius: radius.xl, padding: 18 },
  timerValue: { fontFamily: fonts.monoMedium, fontSize: 40, letterSpacing: -1, color: colors.ink },
  play: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.honey, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', gap: 10, marginTop: 18, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.honeyLine },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: space.gutter, paddingTop: 12, backgroundColor: colors.bg, borderTopWidth: 1, borderColor: colors.line },
});
