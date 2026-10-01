/**
 * Tells cosmetics apart from household chemicals and food by markers that are typical of their labels.
 * Returns what the product looks like when it is clearly not cosmetics, otherwise null.
 */
type Marker = [RegExp, number];

const HOUSEHOLD: Marker[] = [
  // EU detergent labelling: "5-15% анионные ПАВ", "<5% неионогенные ПАВ"
  [/(\d+\s*[-–]\s*\d+\s*%|(менее|less than|<)\s*5\s*%|30\s*%\s*(и более|or over))[^,;.]{0,40}(пав|surfactant|отбелив|bleach|фосфат|phosph|мыл|soap|поликарбоксилат|polycarboxylat|цеолит|zeolite)/i, 4],
  [/(анионн|неионоген|катионн|амфотерн)\w*\s+пав/i, 3],
  [/\b(anionic|non-?ionic|cationic|amphoteric)\s+surfactants?/i, 3],
  [/оптическ\w*\s+отбеливател|optical\s+brightener|disodium distyrylbiphenyl|distyrylbiphenyl/i, 4],
  [/\b(энзим|фермент)\w*|\benzymes?\b|subtilisin|protease|amylase|lipase|cellulase|mannanase|pectate lyase/i, 3],
  [/фосфонат|phosphonate|поликарбоксилат|polycarboxylate|цеолит|zeolite|триполифосфат|tripolyphosphate/i, 3],
  [/перкарбонат|percarbonate|перборат|perborate|кислородн\w*\s+отбеливател|oxygen[- ]based bleach/i, 3],
  [/гипохлорит|hypochlorite|хлорсодерж/i, 4],
  [/dodecylbenzene|alkylbenzene|алкилбензол|додецилбензол|\blas\b/i, 3],
  [/для\s+стирки|стирк|laundry|для\s+(мытья\s+)?посуды|dishwash|кондиционер\s+для\s+белья|ополаскиватель\s+для\s+белья|fabric\s+softener|чистящ|моющ\w*\s+средств|для\s+(мытья\s+)?(пол|стекол|сантехник|унитаз|плит)|средство\s+для\s+(чистки|мытья)/i, 4],
  [/эстеркват|esterquat|di(?:hydrogenated)?\s*tallow|диметилдистеариламмоний/i, 3],
  [/sodium carbonate|карбонат натрия|кальцинированн/i, 1],
  [/sodium silicate|силикат натрия/i, 2],
];

const FOOD: Marker[] = [
  [/пищев\w*\s+ценност|энергетическ\w*\s+ценност|nutrition(al)?\s+(facts|value|information)|\bккал\b|\bkcal\b|\bкдж\b|\bkj\b/i, 4],
  [/белк\w*[^,;]{0,15}\d|жир\w*[^,;]{0,15}\d[^,;]{0,15}углевод|углевод\w*[^,;]{0,15}\d|carbohydrate|protein\s*\d/i, 3],
  [/мука|flour|разрыхлител|baking powder|молоко\s+(сухое|цельное|нормализованное)|milk powder|сливочное масло|яичн|какао-порошок|крупа|солод|malt/i, 3],
  [/(?:^|[^а-яёa-z])[еe]\s?-?\d{3}[a-z]?(?![\d])/gi, 1], // E-numbers: counted below, several in a row point to food
  [/годен\s+до|употребить\s+до|best before|хранить\s+при\s+температуре\s+от/i, 2],
  [/подсластител|sweetener|глутамат натрия|monosodium glutamate|усилитель вкуса|flavou?r enhancer|консервант\s+[еe]\d|эмульгатор\s+[еe]\d|стабилизатор\s+[еe]\d|краситель\s+[еe]\d/i, 3],
  [/ароматизатор\s+идентичн|natural flavou?rings?/i, 1],
];

function score(text: string, markers: Marker[]) {
  let total = 0;
  for (const [re, w] of markers) {
    if (re.global) {
      const n = text.match(re)?.length ?? 0;
      total += n >= 3 ? 3 : n === 2 ? 2 : 0;
      re.lastIndex = 0;
    } else if (re.test(text)) total += w;
  }
  return total;
}

export type NotCosmetic = { kind: 'household' | 'food'; label: string };

export function detectNotCosmetic(text: string): NotCosmetic | null {
  const t = text.replace(/\s+/g, ' ');
  const household = score(t, HOUSEHOLD);
  const food = score(t, FOOD);
  if (household >= 4 && household >= food) return { kind: 'household', label: 'бытовая химия' };
  if (food >= 4) return { kind: 'food', label: 'продукт питания' };
  return null;
}

export const NOT_COSMETIC_TEXT: Record<NotCosmetic['kind'], string> = {
  household:
    'Похоже, это бытовая химия — средство для стирки, посуды или уборки. Мы оцениваем только косметику и уход для кожи и волос, поэтому баллы здесь не показываем.',
  food: 'Похоже, это продукт питания, а не косметика. Мы оцениваем только составы средств для кожи и волос.',
};
