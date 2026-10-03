import type { ImageSourcePropType } from 'react-native';

export type StorySlide = { title: string; text: string; image: ImageSourcePropType | string | null };
export type Story = {
  id: string;
  title: string;
  cover: ImageSourcePropType | null;
  slides: StorySlide[];
  /** a button on the last slide */
  cta?: { label: string; href: string };
  /** id of a story the admin posted (its picture is loaded from the server) */
  server?: string;
};

const img = {
  scanner: require('../../assets/stories/scanner.jpg'),
  feed: require('../../assets/stories/feed.jpg'),
  recipe: require('../../assets/stories/recipe.jpg'),
  recipe2: require('../../assets/stories/recipe2.jpg'),
  builder: require('../../assets/stories/builder.jpg'),
  match: require('../../assets/stories/match.jpg'),
  knowledge: require('../../assets/stories/knowledge.jpg'),
};

/** Stories about what the app can do; shown to everyone next to the ones the admin posts. */
export const BUILTIN_STORIES: Story[] = [
  {
    id: 'b:scanner',
    title: 'Сканер',
    cover: img.scanner,
    slides: [
      { title: 'Узнай, что внутри баночки', text: 'Наведите камеру на состав или штрихкод — essola разберёт каждый ингредиент и поставит оценку за пару секунд.', image: img.scanner },
      { title: 'Ссылка тоже работает', text: 'Скопируйте ссылку на товар в Летуаль или Золотом Яблоке и вставьте её в сканер — состав подтянется сам.', image: img.scanner },
    ],
    cta: { label: 'Открыть сканер', href: '/scanner' },
  },
  {
    id: 'b:recipes',
    title: 'Рецепты',
    cover: img.feed,
    slides: [
      { title: '250 рецептов от @essola', text: 'Кремы, сыворотки, бальзамы, маски и средства для волос, которые можно сварить дома.', image: img.feed },
      { title: 'Каждая формула объяснена', text: 'Что делает каждый ингредиент, какие связки работают и почему такие пропорции.', image: img.recipe },
      { title: 'Шаги и технология', text: 'Пошаговый процесс, на что обратить внимание, хранение и безопасность.', image: img.recipe2 },
    ],
    cta: { label: 'Смотреть рецепты', href: '/' },
  },
  {
    id: 'b:builder',
    title: 'Конструктор',
    cover: img.builder,
    slides: [
      { title: 'Соберите свою формулу', text: 'Выберите тип средства и задачу, добавьте ингредиенты из базы — граммы посчитаются сами.', image: img.builder },
      { title: 'Технолог подскажет', text: 'Оценка технолога: что добавить, что убавить — одной кнопкой прямо в формулу.', image: img.builder },
    ],
    cta: { label: 'Открыть конструктор', href: '/builder' },
  },
  {
    id: 'b:match',
    title: 'Подбор',
    cover: img.match,
    slides: [
      { title: 'Средства под ваши цели', text: 'Фильтры по задачам, составу и типу средства, сортировка по оценке и рейтингу покупателей.', image: img.match },
      { title: 'С учётом вашего профиля', text: 'Заполните анкету в кабинете — подбор учтёт тип кожи, беременность и то, что вы не переносите.', image: img.match },
    ],
    cta: { label: 'Подобрать', href: '/match' },
  },
  {
    id: 'b:knowledge',
    title: 'Знания',
    cover: img.knowledge,
    slides: [{ title: 'Статьи и база ингредиентов', text: 'Подробные статьи о барьере кожи, консервантах, маслах, кислотах и 650+ ингредиентов простым языком.', image: img.knowledge }],
    cta: { label: 'Читать', href: '/knowledge' },
  },
];
