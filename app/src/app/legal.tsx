import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glow } from '../components/silk';
import { IconButton, Press, tap } from '../components/ui';
import { colors, fonts, space } from '../theme';

type Doc = { title: string; updated: string; sections: { h: string; p: string }[] };

const RULES: Doc = {
  title: 'Правила сообщества',
  updated: '3 октября 2026',
  sections: [
    { h: 'Уважение', p: 'Общайтесь вежливо. Запрещены оскорбления, травля, угрозы, дискриминация, мат и переход на личности.' },
    { h: 'Без спама и рекламы', p: 'Не публикуйте рекламу, реферальные ссылки, одинаковые сообщения и ссылки на сторонние магазины ради продвижения.' },
    { h: 'Безопасные советы', p: 'Делитесь опытом, а не медицинскими обещаниями. Не советуйте лечить заболевания косметикой, не предлагайте опасные концентрации кислот, щелочей и эфирных масел. При проблемах с кожей рекомендуйте обратиться к врачу.' },
    { h: 'Чужие данные и контент', p: 'Не публикуйте чужие фото, телефоны, адреса и переписку, а также тексты и фото, на которые у вас нет прав.' },
    { h: 'Что мы делаем с нарушениями', p: 'Любое сообщение можно скрыть или пожаловаться на него через «…» рядом. Жалобы проверяются в течение 24 часов: нарушающий контент удаляется, а автор может быть заблокирован. Сообщения с нецензурными словами не публикуются автоматически.' },
  ],
};

const PRIVACY: Doc = {
  title: 'Политика конфиденциальности',
  updated: '3 октября 2026',
  sections: [
    { h: 'Какие данные мы собираем', p: 'Email или Apple ID — для входа. Ник, имя и описание профиля, которые вы указали. Анкета кожи и волос — хранится на вашем телефоне. Фото и тексты составов, которые вы отправляете на разбор. Сообщения на форуме, комментарии, оценки и сохранённые рецепты. Обезличенный идентификатор устройства для лайков и уведомлений.' },
    { h: 'Зачем', p: 'Чтобы распознать и оценить состав, показать персональную оценку, вести форум и уведомления, сохранять ваши рецепты. Мы не продаём данные, не показываем рекламу и не используем трекинг сторонних рекламных сетей.' },
    { h: 'Где хранятся', p: 'Аккаунты — в сервисе аутентификации Supabase. Составы, форум, комментарии и оценки — в Yandex Cloud (Россия). Фото состава передаётся на распознавание и не публикуется. Анкета, история сканов и избранное хранятся на телефоне.' },
    { h: 'Кто видит', p: 'Ваш ник, сообщения на форуме, комментарии, отзывы и оценки видят другие пользователи. Email и анкета никому не показываются.' },
    { h: 'Удаление', p: 'В кабинете есть кнопка «Удалить аккаунт». Она удаляет профиль, опубликованные рецепты, подписки, уведомления и данные на телефоне; сообщения на форуме обезличиваются. Повторно войти можно, создав новый аккаунт.' },
    { h: 'Связь', p: 'Вопросы о данных и запросы на удаление — через сайт essola.ru.' },
  ],
};

const TERMS: Doc = {
  title: 'Условия использования',
  updated: '3 октября 2026',
  sections: [
    { h: 'О приложении', p: 'Essola помогает разобраться в составах косметики и готовить домашнюю косметику. Оценки и советы носят информационный характер и не заменяют консультацию дерматолога или врача.' },
    { h: 'Домашняя косметика', p: 'Вы готовите средства на свой риск: соблюдайте гигиену, точные пропорции и делайте тест на аллергию перед применением. Не используйте рецепты при повреждённой коже, беременности и заболеваниях без консультации врача.' },
    { h: 'Ваш контент', p: 'Публикуя сообщения и рецепты, вы подтверждаете, что у вас есть на них права и они соответствуют правилам сообщества. Мы можем удалить контент, нарушающий правила.' },
    { h: 'Данные о товарах', p: 'Информация о товарах и составах собрана из открытых источников и магазинов-партнёров и может содержать неточности. Перед покупкой сверяйтесь с упаковкой.' },
  ],
};

const DOCS = { rules: RULES, privacy: PRIVACY, terms: TERMS } as const;
type Key = keyof typeof DOCS;

/** Community rules, privacy policy and terms of use. */
export default function Legal() {
  const insets = useSafeAreaInsets();
  const [k, setK] = useState<Key>('rules');
  const d = DOCS[k];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <View style={{ height: 52, justifyContent: 'center' }}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>
        <View style={styles.seg}>
          {(
            [
              ['rules', 'Правила'],
              ['privacy', 'Данные'],
              ['terms', 'Условия'],
            ] as const
          ).map(([key, l]) => (
            <Press key={key} haptic={false} onPress={() => { tap(); setK(key); }} style={[styles.segItem, k === key && styles.segOn]}>
              <Text style={[styles.segText, k === key && { color: '#fff' }]}>{l}</Text>
            </Press>
          ))}
        </View>
        <Text style={styles.h1}>{d.title}</Text>
        <Text style={styles.updated}>Редакция от {d.updated}</Text>
        {d.sections.map((x) => (
          <View key={x.h} style={styles.block}>
            <Text style={styles.h2}>{x.h}</Text>
            <Text style={styles.p}>{x.p}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E1F1', gap: 4 },
  segItem: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.accent },
  segText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  h1: { fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.8, color: colors.ink, marginTop: 20 },
  updated: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 4 },
  block: { marginTop: 18, gap: 6 },
  h2: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  p: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink2 },
});
