import type { IconName } from '../components/Icon';

/** Colour and icon of each forum category, shared with the topic screen. */
export const CAT_STYLE: Record<string, { icon: IconName; fg: string; bg: string }> = {
  'Общее': { icon: 'comment', fg: '#3F4BC9', bg: '#EEF0FF' },
  'Рецепты': { icon: 'flask', fg: '#B5527A', bg: '#FFEEF5' },
  'Уход за кожей': { icon: 'drop', fg: '#1F8A84', bg: '#E7F7F5' },
  'Волосы': { icon: 'spark', fg: '#9A6A12', bg: '#FFF5E2' },
  'Ингредиенты': { icon: 'leaf', fg: '#4D7A2A', bg: '#EEF7E6' },
  'Покупки': { icon: 'bag', fg: '#7A4BC9', bg: '#F4EEFF' },
};
