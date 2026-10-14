import type { ImageSourcePropType } from 'react-native';

/** Built-in slides are drawn as infographics in the app (no screenshots): which picture to draw. */
export type StoryArt = 'score' | 'link' | 'recipes' | 'explain' | 'steps' | 'formula' | 'tech' | 'match' | 'profile' | 'knowledge';
export type StorySlide = { title: string; text: string; image: ImageSourcePropType | string | null; art?: StoryArt };
export type Story = {
  id: string;
  title: string;
  cover: ImageSourcePropType | null;
  /** built-in stories: an icon in the bubble instead of a picture */
  icon?: 'scan' | 'book' | 'flask' | 'spark' | 'leaf';
  slides: StorySlide[];
  /** a button on the last slide */
  cta?: { label: string; href: string };
  /** id of a story the admin posted (its picture is loaded from the server) */
  server?: string;
};

/** Stories about what the app can do; shown to everyone next to the ones the admin posts. */
export const BUILTIN_STORIES: Story[] = [
  {
    id: 'b:scanner',
    title: 'Сканер',
    cover: null,
    icon: 'scan',
    slides: [
      { title: 'Узнай, что внутри баночки', text: 'Наведите камеру на состав или штрихкод — essola разберёт каждый ингредиент и поставит оценку за пару секунд.', image: null, art: 'score' },
      { title: 'Ссылка тоже работает', text: 'Скопируйте ссылку на товар в Летуаль и вставьте её в сканер — состав подтянется сам.', image: null, art: 'link' },
    ],
    cta: { label: 'Открыть сканер', href: '/scanner' },
  },
  {
    id: 'b:recipes',
    title: 'Рецепты',
    cover: null,
    icon: 'leaf',
    slides: [
      { title: '250 рецептов от @essola', text: 'Кремы, сыворотки, бальзамы, маски и средства для волос, которые можно сварить дома.', image: null, art: 'recipes' },
      { title: 'Каждая формула объяснена', text: 'Что делает каждый ингредиент, какие связки работают и почему такие пропорции.', image: null, art: 'explain' },
      { title: 'Шаги и технология', text: 'Пошаговый процесс, на что обратить внимание, хранение и безопасность.', image: null, art: 'steps' },
    ],
    cta: { label: 'Смотреть рецепты', href: '/' },
  },
  {
    id: 'b:builder',
    title: 'Конструктор',
    cover: null,
    icon: 'flask',
    slides: [
      { title: 'Соберите свою формулу', text: 'Выберите тип средства и задачу, добавьте ингредиенты из базы — граммы посчитаются сами.', image: null, art: 'formula' },
      { title: 'Технолог подскажет', text: 'Оценка технолога: что добавить, что убавить — одной кнопкой прямо в формулу.', image: null, art: 'tech' },
    ],
    cta: { label: 'Открыть конструктор', href: '/builder' },
  },
  {
    id: 'b:match',
    title: 'Подбор',
    cover: null,
    icon: 'spark',
    slides: [
      { title: 'Средства под ваши цели', text: 'Фильтры по задачам, составу и типу средства, сортировка по оценке и рейтингу покупателей.', image: null, art: 'match' },
      { title: 'С учётом вашего профиля', text: 'Заполните анкету в кабинете — подбор учтёт тип кожи, беременность и то, что вы не переносите.', image: null, art: 'profile' },
    ],
    cta: { label: 'Подобрать', href: '/match' },
  },
  {
    id: 'b:knowledge',
    title: 'Знания',
    cover: null,
    icon: 'book',
    slides: [{ title: 'Статьи и база ингредиентов', text: 'Подробные статьи о барьере кожи, консервантах, маслах, кислотах и 650+ ингредиентов простым языком.', image: null, art: 'knowledge' }],
    cta: { label: 'Читать', href: '/knowledge' },
  },
];
