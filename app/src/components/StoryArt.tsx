import { StyleSheet, Text, View } from 'react-native';
import type { StoryArt as Kind } from '../data/stories';
import { fonts } from '../theme';
import { Icon, IconName } from './Icon';

// Infographics for the built-in stories, drawn in the app: white and translucent on the violet story background.
// They explain one idea each with a big number, a chart or a short flow, not a screenshot.

const W = '#FFFFFF';
const DIM = 'rgba(255,255,255,0.72)';
const GLASS = 'rgba(255,255,255,0.14)';

function Chip({ label, dot }: { label: string; dot?: string }) {
  return (
    <View style={s.chip}>
      {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
      <Text style={s.chipText}>{label}</Text>
    </View>
  );
}

function Big({ value, caption }: { value: string; caption: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.big}>{value}</Text>
      <Text style={s.caption}>{caption}</Text>
    </View>
  );
}

function Row({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={s.row}>
      <View style={s.rowIcon}>
        <Icon name={icon} size={18} color={W} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowText}>{text}</Text>
      </View>
    </View>
  );
}

/** A horizontal bar split into labelled shares (a formula, a composition). */
function Shares({ parts }: { parts: [string, number, string][] }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={s.bar}>
        {parts.map(([label, pct, c]) => (
          <View key={label} style={{ flex: pct, backgroundColor: c }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {parts.map(([label, pct, c]) => (
          <Chip key={label} label={`${label} ${pct}%`} dot={c} />
        ))}
      </View>
    </View>
  );
}

export function StoryArt({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'score':
      return (
        <View style={s.wrap}>
          <View style={s.ring}>
            <Text style={s.ringValue}>87</Text>
            <Text style={s.ringLabel}>из 100</Text>
          </View>
          <View style={s.chips}>
            <Chip label="Ниацинамид" dot="#7EE2B8" />
            <Chip label="Пантенол" dot="#7EE2B8" />
            <Chip label="Отдушка" dot="#FFC27A" />
            <Chip label="Глицерин" dot="#7EE2B8" />
          </View>
          <Text style={s.note}>Каждый ингредиент с оценкой и объяснением</Text>
        </View>
      );
    case 'link':
      return (
        <View style={s.wrap}>
          <View style={s.flow}>
            <View style={s.flowBox}>
              <Icon name="external" size={22} color={W} />
              <Text style={s.flowText}>Ссылка на товар</Text>
            </View>
            <Icon name="arrowRight" size={22} color={DIM} />
            <View style={s.flowBox}>
              <Icon name="text" size={22} color={W} />
              <Text style={s.flowText}>Состав</Text>
            </View>
            <Icon name="arrowRight" size={22} color={DIM} />
            <View style={s.flowBox}>
              <Icon name="check" size={22} color={W} />
              <Text style={s.flowText}>Оценка</Text>
            </View>
          </View>
          <Text style={s.note}>Летуаль, Wildberries, Ozon, Золотое Яблоко</Text>
        </View>
      );
    case 'recipes':
      return (
        <View style={s.wrap}>
          <Big value="250" caption="рецептов для дома" />
          <View style={s.chips}>
            {['Кремы', 'Сыворотки', 'Бальзамы', 'Маски', 'Для волос', 'Для тела'].map((c) => (
              <Chip key={c} label={c} />
            ))}
          </View>
        </View>
      );
    case 'explain':
      return (
        <View style={[s.wrap, { gap: 10 }]}>
          <Row icon="drop" title="Гиалуронат натрия 0,5%" text="удерживает влагу в коже" />
          <Row icon="leaf" title="Масло жожоба 5%" text="смягчает, не забивает поры" />
          <Row icon="shield" title="Пантенол 2%" text="успокаивает и восстанавливает" />
        </View>
      );
    case 'steps':
      return (
        <View style={[s.wrap, { gap: 10 }]}>
          {[
            ['1', 'Нагреть водную и масляную фазы до 70 °C'],
            ['2', 'Соединить и перемешать до эмульсии'],
            ['3', 'Остудить до 40 °C и добавить активы'],
          ].map(([n, t]) => (
            <View key={n} style={s.row}>
              <View style={s.step}>
                <Text style={s.stepText}>{n}</Text>
              </View>
              <Text style={[s.rowTitle, { flex: 1 }]}>{t}</Text>
            </View>
          ))}
        </View>
      );
    case 'formula':
      return (
        <View style={[s.wrap, { gap: 18 }]}>
          <Big value="100%" caption="граммы считаются сами" />
          <Shares
            parts={[
              ['Вода', 72, '#B9C8FF'],
              ['Масла', 13, '#FFD38A'],
              ['Эмульгатор', 5, '#F6B6D8'],
              ['Активы', 9, '#7EE2B8'],
              ['Консервант', 1, '#FFFFFF'],
            ]}
          />
        </View>
      );
    case 'tech':
      return (
        <View style={[s.wrap, { gap: 10 }]}>
          <Row icon="plus" title="Добавить сквалан 3%" text="мягче текстура, лучше барьер" />
          <Row icon="minus" title="Глицерин 5% → 3%" text="без липкости" />
          <Row icon="check" title="Формула готова" text="сумма 100%, можно варить" />
        </View>
      );
    case 'match':
      return (
        <View style={[s.wrap, { gap: 16 }]}>
          <View style={s.chips}>
            <Chip label="Увлажнение" />
            <Chip label="Без отдушки" />
            <Chip label="Крем" />
          </View>
          <Icon name="chevronDown" size={24} color={DIM} />
          {[
            ['Крем с церамидами', '92'],
            ['Гель с гиалуронатом', '88'],
          ].map(([t, v]) => (
            <View key={t} style={s.product}>
              <Text style={[s.rowTitle, { flex: 1 }]}>{t}</Text>
              <Text style={s.score}>{v}</Text>
            </View>
          ))}
        </View>
      );
    case 'profile':
      return (
        <View style={[s.wrap, { gap: 10 }]}>
          <Row icon="drop" title="Тип кожи" text="сухая, чувствительная" />
          <Row icon="shield" title="Не переношу" text="эфирные масла, спирт" />
          <Row icon="heart" title="Беременность" text="уберём неподходящие активы" />
        </View>
      );
    case 'knowledge':
      return (
        <View style={[s.wrap, { gap: 18 }]}>
          <Big value="650+" caption="ингредиентов простым языком" />
          <View style={s.chips}>
            {['Барьер кожи', 'Консерванты', 'Масла', 'Кислоты', 'Активы'].map((c) => (
              <Chip key={c} label={c} />
            ))}
          </View>
        </View>
      );
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 22, paddingHorizontal: 4 },
  ring: { width: 170, height: 170, borderRadius: 85, borderWidth: 10, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', backgroundColor: GLASS },
  ringValue: { fontFamily: fonts.display, fontSize: 60, lineHeight: 64, letterSpacing: -2, color: W },
  ringLabel: { fontFamily: fonts.medium, fontSize: 13, color: DIM },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingHorizontal: 14, borderRadius: 99, backgroundColor: GLASS, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: W },
  note: { fontFamily: fonts.medium, fontSize: 13.5, color: DIM, textAlign: 'center' },
  big: { fontFamily: fonts.display, fontSize: 76, lineHeight: 80, letterSpacing: -3, color: W },
  caption: { fontFamily: fonts.medium, fontSize: 15, color: DIM },
  row: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: GLASS, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  rowIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: W },
  rowText: { fontFamily: fonts.regular, fontSize: 13, color: DIM, marginTop: 2 },
  step: { width: 34, height: 34, borderRadius: 17, backgroundColor: W, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.display, fontSize: 16, color: '#5B47C9' },
  bar: { alignSelf: 'stretch', height: 22, borderRadius: 11, overflow: 'hidden', flexDirection: 'row', gap: 2 },
  flow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  flowBox: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 18, backgroundColor: GLASS, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  flowText: { fontFamily: fonts.semibold, fontSize: 12.5, color: W, textAlign: 'center' },
  product: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: GLASS, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  score: { fontFamily: fonts.display, fontSize: 22, color: W },
});
