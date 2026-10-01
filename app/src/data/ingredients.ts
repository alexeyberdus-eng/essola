import { ABOUT } from './ingredients-about';
import { EXTRA } from './ingredients-more';
import { EXTRA2 } from './ingredients-more2';
import { EXTRA3 } from './ingredients-more3';
export type Origin = 'natural' | 'mineral' | 'identical' | 'synthetic';

export type Fn =
  | 'base'
  | 'emollient'
  | 'humectant'
  | 'emulsifier'
  | 'surfactant'
  | 'thickener'
  | 'preservative'
  | 'antioxidant'
  | 'active'
  | 'extract'
  | 'soothing'
  | 'exfoliant'
  | 'film'
  | 'uv'
  | 'fragrance'
  | 'ph'
  | 'chelator'
  | 'colorant';

export type Flag =
  | 'allergen'
  | 'sulfate'
  | 'paraben'
  | 'silicone'
  | 'drying-alcohol'
  | 'formaldehyde'
  | 'peg'
  | 'chemical-uv'
  | 'irritant'
  | 'pregnancy';

export type Ingredient = {
  inci: string;
  ru: string;
  fn: Fn[];
  origin: Origin;
  /** 0 — безопасно, 1 — низкий риск, 2 — умеренный, 3 — высокий */
  risk: 0 | 1 | 2 | 3;
  /** Вклад в эффективность: 0 — нейтрально, 3 — доказанный сильный актив */
  act: number;
  /** Комедогенность 0–5 */
  com: number;
  flags: Flag[];
  note: string;
  /** Longer plain-language explanation shown when an ingredient is expanded. */
  about?: string;
  aliases: string[];
};

export const FN_LABEL: Record<Fn, string> = {
  base: 'Основа',
  emollient: 'Смягчающее',
  humectant: 'Увлажнитель',
  emulsifier: 'Эмульгатор',
  surfactant: 'Очищение',
  thickener: 'Текстура',
  preservative: 'Консервант',
  antioxidant: 'Антиоксидант',
  active: 'Актив',
  extract: 'Экстракт',
  soothing: 'Успокаивает',
  exfoliant: 'Отшелушивает',
  film: 'Плёнка',
  uv: 'УФ-фильтр',
  fragrance: 'Аромат',
  ph: 'pH',
  chelator: 'Стабилизатор',
  colorant: 'Цвет',
};

export const ORIGIN_LABEL: Record<Origin, string> = {
  natural: 'Натуральное',
  mineral: 'Минеральное',
  identical: 'Природоидентичное',
  synthetic: 'Синтетическое',
};

export const FLAG_LABEL: Record<Flag, string> = {
  allergen: 'Аллерген',
  sulfate: 'Сульфат',
  paraben: 'Парабен',
  silicone: 'Силикон',
  'drying-alcohol': 'Сушащий спирт',
  formaldehyde: 'Выделяет формальдегид',
  peg: 'ПЭГ',
  'chemical-uv': 'Химический фильтр',
  irritant: 'Может раздражать',
  pregnancy: 'Осторожно при беременности',
};

type Extra = { act?: number; com?: number; flags?: Flag[]; aliases?: string[] };

function d(inci: string, ru: string, fn: Fn[], origin: Origin, risk: Ingredient['risk'], note: string, extra: Extra = {}): Ingredient {
  return { inci, ru, fn, origin, risk, note, act: extra.act ?? 0, com: extra.com ?? 0, flags: extra.flags ?? [], aliases: extra.aliases ?? [] };
}

const CORE: Ingredient[] = [
  // Основы и растворители
  d('Aqua', 'Вода', ['base'], 'natural', 0, 'Основа большинства кремов и тоников, растворяет водорастворимые компоненты.', { aliases: ['water', 'eau', 'вода', 'aqua/water', 'purified water'] }),
  d('Aloe Barbadensis Leaf Juice', 'Сок алоэ вера', ['base', 'soothing', 'humectant'], 'natural', 0, 'Успокаивает, увлажняет и охлаждает кожу.', { act: 1, aliases: ['aloe vera', 'aloe barbadensis leaf extract', 'aloe barbadensis gel', 'алоэ'] }),
  d('Rosa Damascena Flower Water', 'Гидролат розы', ['base', 'fragrance'], 'natural', 0, 'Ароматная водная основа с лёгким тонизирующим эффектом.', { aliases: ['rose water', 'rosa damascena distillate'] }),
  d('Hamamelis Virginiana Water', 'Гидролат гамамелиса', ['base', 'soothing'], 'natural', 1, 'Лёгкий вяжущий эффект, сужает вид пор.', { aliases: ['witch hazel', 'hamamelis virginiana leaf water'] }),
  d('Alcohol Denat.', 'Спирт денатурированный', ['base'], 'synthetic', 2, 'Даёт лёгкость и быстрое высыхание, но в начале состава может сушить и нарушать барьер.', { flags: ['drying-alcohol', 'irritant'], aliases: ['alcohol denat', 'sd alcohol', 'alcohol', 'ethanol', 'спирт'] }),
  d('Isopropyl Alcohol', 'Изопропиловый спирт', ['base'], 'synthetic', 2, 'Растворитель, заметно сушит кожу.', { flags: ['drying-alcohol', 'irritant'] }),

  // Увлажнители
  d('Glycerin', 'Глицерин', ['humectant'], 'identical', 0, 'Классический увлажнитель: притягивает воду в роговой слой.', { act: 1, aliases: ['glycerine', 'glycerol', 'глицерин'] }),
  d('Sodium Hyaluronate', 'Гиалуронат натрия', ['humectant', 'active'], 'identical', 0, 'Удерживает влагу, разглаживает мелкие морщинки обезвоженности.', { act: 2, aliases: ['hyaluronic acid', 'hydrolyzed hyaluronic acid', 'sodium acetylated hyaluronate', 'гиалуроновая кислота'] }),
  d('Propylene Glycol', 'Пропиленгликоль', ['humectant', 'base'], 'synthetic', 1, 'Увлажнитель и проводник, у чувствительной кожи иногда вызывает раздражение.', { flags: ['irritant'] }),
  d('Butylene Glycol', 'Бутиленгликоль', ['humectant', 'base'], 'synthetic', 0, 'Лёгкий увлажнитель и растворитель экстрактов.', { com: 1 }),
  d('Pentylene Glycol', 'Пентиленгликоль', ['humectant', 'preservative'], 'identical', 0, 'Увлажняет и усиливает действие консервантов.'),
  d('Propanediol', 'Пропандиол', ['humectant', 'base'], 'identical', 0, 'Растительная альтернатива гликолям, мягкий увлажнитель.'),
  d('1,2-Hexanediol', 'Гександиол', ['humectant', 'preservative'], 'synthetic', 0, 'Увлажнитель с антимикробным эффектом.', { aliases: ['hexanediol', '12-hexanediol'] }),
  d('Caprylyl Glycol', 'Каприлилгликоль', ['humectant', 'preservative'], 'synthetic', 0, 'Смягчает и усиливает консервацию.'),
  d('Sorbitol', 'Сорбитол', ['humectant'], 'identical', 0, 'Сахарный спирт, мягко увлажняет.'),
  d('Urea', 'Мочевина', ['humectant', 'active'], 'identical', 0, 'Увлажняет и в высоких концентрациях размягчает огрубевшую кожу.', { act: 2, aliases: ['мочевина'] }),
  d('Sodium PCA', 'PCA натрия', ['humectant'], 'identical', 0, 'Компонент натурального увлажняющего фактора кожи.', { act: 1 }),
  d('Betaine', 'Бетаин', ['humectant', 'soothing'], 'natural', 0, 'Увлажнитель из сахарной свёклы, снижает раздражение.', { act: 1 }),
  d('Trehalose', 'Трегалоза', ['humectant'], 'natural', 0, 'Сахар-протектор, защищает клетки от обезвоживания.', { act: 1 }),
  d('Honey', 'Мёд', ['humectant', 'soothing'], 'natural', 0, 'Увлажняет и смягчает, обладает мягким антибактериальным действием.', { act: 1, aliases: ['mel', 'мёд', 'мед'] }),
  d('Panthenol', 'Пантенол', ['humectant', 'soothing', 'active'], 'identical', 0, 'Провитамин B5: восстанавливает и успокаивает кожу.', { act: 2, aliases: ['d-panthenol', 'dexpanthenol', 'пантенол'] }),
  d('Allantoin', 'Аллантоин', ['soothing', 'active'], 'identical', 0, 'Успокаивает и ускоряет обновление кожи.', { act: 1, aliases: ['аллантоин'] }),

  // Масла и эмоленты
  d('Butyrospermum Parkii Butter', 'Масло ши', ['emollient'], 'natural', 0, 'Питательное масло, восстанавливает липидный барьер.', { com: 0, act: 1, aliases: ['shea butter', 'butyrospermum parkii (shea) butter', 'масло ши'] }),
  d('Theobroma Cacao Seed Butter', 'Масло какао', ['emollient'], 'natural', 0, 'Плотное питательное масло, может забивать поры на лице.', { com: 4, aliases: ['cocoa butter', 'theobroma cacao (cocoa) seed butter'] }),
  d('Cocos Nucifera Oil', 'Масло кокоса', ['emollient'], 'natural', 0, 'Отлично для тела и волос, для лица высокая комедогенность.', { com: 4, aliases: ['coconut oil', 'cocos nucifera (coconut) oil'] }),
  d('Simmondsia Chinensis Seed Oil', 'Масло жожоба', ['emollient'], 'natural', 0, 'Жидкий воск, близкий к кожному себуму. Подходит почти всем.', { com: 2, act: 1, aliases: ['jojoba oil', 'simmondsia chinensis (jojoba) seed oil'] }),
  d('Argania Spinosa Kernel Oil', 'Масло арганы', ['emollient', 'antioxidant'], 'natural', 0, 'Богато витамином E и олеиновой кислотой, питает кожу и волосы.', { com: 0, act: 1, aliases: ['argan oil', 'argania spinosa oil'] }),
  d('Rosa Canina Fruit Oil', 'Масло шиповника', ['emollient', 'active'], 'natural', 0, 'Содержит транс-ретиноевую кислоту и жирные кислоты, выравнивает тон.', { com: 1, act: 2, aliases: ['rosehip oil', 'rosa canina seed oil', 'rosa rubiginosa seed oil'] }),
  d('Prunus Amygdalus Dulcis Oil', 'Масло сладкого миндаля', ['emollient'], 'natural', 0, 'Мягкое универсальное масло.', { com: 2, flags: ['allergen'], aliases: ['sweet almond oil', 'prunus amygdalus dulcis (sweet almond) oil'] }),
  d('Olea Europaea Fruit Oil', 'Масло оливы', ['emollient'], 'natural', 0, 'Питательное масло, у жирной кожи может провоцировать высыпания.', { com: 2, aliases: ['olive oil', 'olea europaea (olive) fruit oil'] }),
  d('Helianthus Annuus Seed Oil', 'Масло подсолнечника', ['emollient'], 'natural', 0, 'Богато линолевой кислотой, укрепляет барьер.', { com: 0, aliases: ['sunflower seed oil', 'helianthus annuus (sunflower) seed oil'] }),
  d('Vitis Vinifera Seed Oil', 'Масло виноградной косточки', ['emollient'], 'natural', 0, 'Лёгкое, быстро впитывается.', { com: 1, aliases: ['grape seed oil'] }),
  d('Camellia Japonica Seed Oil', 'Масло камелии', ['emollient'], 'natural', 0, 'Невесомое масло, классика японского ухода.', { com: 1, aliases: ['camellia oil', 'camellia oleifera seed oil'] }),
  d('Ricinus Communis Seed Oil', 'Касторовое масло', ['emollient'], 'natural', 0, 'Вязкое масло, придаёт блеск и плотность.', { com: 1, aliases: ['castor oil', 'ricinus communis (castor) seed oil'] }),
  d('Persea Gratissima Oil', 'Масло авокадо', ['emollient'], 'natural', 0, 'Плотное питательное масло.', { com: 2, aliases: ['avocado oil'] }),
  d('Macadamia Ternifolia Seed Oil', 'Масло макадамии', ['emollient'], 'natural', 0, 'Богато пальмитолеиновой кислотой, для зрелой кожи.', { com: 2, aliases: ['macadamia oil', 'macadamia integrifolia seed oil'] }),
  d('Oryza Sativa Bran Oil', 'Масло рисовых отрубей', ['emollient', 'antioxidant'], 'natural', 0, 'Содержит гамма-оризанол, антиоксидант.', { com: 1, aliases: ['rice bran oil'] }),
  d('Prunus Armeniaca Kernel Oil', 'Масло абрикосовой косточки', ['emollient'], 'natural', 0, 'Лёгкое смягчающее масло.', { com: 2, aliases: ['apricot kernel oil'] }),
  d('Calophyllum Inophyllum Seed Oil', 'Масло таману', ['emollient', 'soothing'], 'natural', 0, 'Заживляющее масло для проблемной кожи.', { com: 2, act: 1, aliases: ['tamanu oil'] }),
  d('Mangifera Indica Seed Butter', 'Масло манго', ['emollient'], 'natural', 0, 'Мягкий баттер, менее жирный, чем ши.', { com: 2, aliases: ['mango butter'] }),
  d('Squalane', 'Сквалан', ['emollient'], 'identical', 0, 'Стабильный аналог липида кожи, лёгкий и некомедогенный.', { com: 0, act: 1, aliases: ['сквалан'] }),
  d('Caprylic/Capric Triglyceride', 'Триглицериды каприловой кислоты', ['emollient'], 'identical', 0, 'Лёгкий эмолент из кокоса, делает текстуру шелковистой.', { com: 1, aliases: ['caprylic capric triglyceride', 'capric triglyceride'] }),
  d('Coco-Caprylate/Caprate', 'Кококаприлат', ['emollient'], 'identical', 0, 'Растительная альтернатива силиконам.', { aliases: ['coco caprylate', 'coco-caprylate'] }),
  d('Isopropyl Myristate', 'Изопропилмиристат', ['emollient'], 'synthetic', 1, 'Даёт скольжение, но сильно комедогенен.', { com: 5 }),
  d('Isopropyl Palmitate', 'Изопропилпальмитат', ['emollient'], 'synthetic', 1, 'Смягчает, может забивать поры.', { com: 4 }),
  d('Ethylhexyl Palmitate', 'Этилгексилпальмитат', ['emollient'], 'synthetic', 0, 'Сухой на ощупь эмолент.', { com: 3 }),
  d('C12-15 Alkyl Benzoate', 'Алкилбензоат', ['emollient'], 'synthetic', 0, 'Лёгкий эмолент, часто в солнцезащитных средствах.'),
  d('Paraffinum Liquidum', 'Минеральное масло', ['emollient', 'film'], 'mineral', 1, 'Окклюзив из нефти: удерживает влагу, но не питает.', { com: 2, aliases: ['mineral oil', 'paraffin oil', 'liquid paraffin'] }),
  d('Petrolatum', 'Вазелин', ['emollient', 'film'], 'mineral', 1, 'Мощный окклюзив, отлично защищает, но «не дышит».', { com: 1, aliases: ['petroleum jelly', 'vaseline', 'вазелин'] }),
  d('Lanolin', 'Ланолин', ['emollient'], 'natural', 1, 'Животный воск из овечьей шерсти, возможна аллергия.', { com: 2, flags: ['allergen'], aliases: ['lanolin anhydrous', 'ланолин'] }),
  d('Cera Alba', 'Пчелиный воск', ['emollient', 'thickener'], 'natural', 0, 'Уплотняет текстуру и создаёт защитную плёнку.', { com: 2, aliases: ['beeswax', 'пчелиный воск'] }),
  d('Euphorbia Cerifera Wax', 'Канделильский воск', ['thickener'], 'natural', 0, 'Растительный воск, веганская альтернатива пчелиному.', { com: 1, aliases: ['candelilla wax', 'candelilla cera'] }),
  d('Copernicia Cerifera Wax', 'Карнаубский воск', ['thickener'], 'natural', 0, 'Твёрдый растительный воск.', { com: 1, aliases: ['carnauba wax', 'copernicia cerifera cera'] }),

  // Силиконы
  d('Dimethicone', 'Диметикон', ['film', 'emollient'], 'synthetic', 1, 'Силикон: шёлковая текстура и защитная плёнка. Безопасен, но не «натурален».', { com: 1, flags: ['silicone'], aliases: ['polydimethylsiloxane'] }),
  d('Cyclopentasiloxane', 'Циклопентасилоксан', ['film'], 'synthetic', 2, 'Летучий силикон, ограничен в ЕС из-за накопления в окружающей среде.', { flags: ['silicone'], aliases: ['cyclomethicone', 'd5'] }),
  d('Cyclohexasiloxane', 'Циклогексасилоксан', ['film'], 'synthetic', 2, 'Летучий силикон, ограничен в ЕС в смываемых средствах.', { flags: ['silicone'] }),
  d('Dimethiconol', 'Диметиконол', ['film'], 'synthetic', 1, 'Силикон, смягчает и выравнивает.', { flags: ['silicone'] }),
  d('Amodimethicone', 'Амодиметикон', ['film'], 'synthetic', 1, 'Силикон для волос, облегчает расчёсывание.', { flags: ['silicone'] }),

  // Эмульгаторы и загустители
  d('Cetearyl Alcohol', 'Цетеариловый спирт', ['emulsifier', 'thickener', 'emollient'], 'identical', 0, 'Жирный спирт — не сушит, а смягчает и стабилизирует крем.', { com: 2, aliases: ['cetostearyl alcohol'] }),
  d('Cetyl Alcohol', 'Цетиловый спирт', ['thickener', 'emollient'], 'identical', 0, 'Жирный спирт, делает текстуру кремовой.', { com: 2 }),
  d('Stearyl Alcohol', 'Стеариловый спирт', ['thickener', 'emollient'], 'identical', 0, 'Жирный спирт-загуститель.', { com: 2 }),
  d('Behenyl Alcohol', 'Бегениловый спирт', ['thickener', 'emollient'], 'identical', 0, 'Жирный спирт, мягкий загуститель.'),
  d('Glyceryl Stearate', 'Глицерилстеарат', ['emulsifier'], 'identical', 0, 'Мягкий эмульгатор.', { com: 1, aliases: ['glyceryl stearate se'] }),
  d('Cetearyl Olivate', 'Цетеарилолеат', ['emulsifier'], 'identical', 0, 'Эмульгатор из оливы (Olivem 1000), формирует ламеллярные структуры.', { aliases: ['olivem 1000'] }),
  d('Sorbitan Olivate', 'Сорбитанолеат', ['emulsifier'], 'identical', 0, 'Оливковый эмульгатор, пара к цетеарилолеату.'),
  d('Cetearyl Glucoside', 'Цетеарилглюкозид', ['emulsifier'], 'identical', 0, 'Мягкий эмульгатор из сахара.'),
  d('Polyglyceryl-3 Diisostearate', 'Полиглицерил-3', ['emulsifier'], 'identical', 0, 'Растительный эмульгатор.', { aliases: ['polyglyceryl-4 oleate', 'polyglyceryl-10 laurate'] }),
  d('Stearic Acid', 'Стеариновая кислота', ['emulsifier', 'thickener'], 'identical', 0, 'Жирная кислота, уплотняет текстуру.', { com: 2 }),
  d('Lecithin', 'Лецитин', ['emulsifier', 'emollient'], 'natural', 0, 'Природный эмульгатор, укрепляет барьер.', { aliases: ['hydrogenated lecithin'] }),
  d('Polysorbate 20', 'Полисорбат 20', ['emulsifier'], 'synthetic', 1, 'Солюбилизатор масел в воде.', { flags: ['peg'] }),
  d('Polysorbate 80', 'Полисорбат 80', ['emulsifier'], 'synthetic', 1, 'Солюбилизатор, делает гидрофильные масла.', { flags: ['peg'] }),
  d('PEG-100 Stearate', 'ПЭГ-100 стеарат', ['emulsifier'], 'synthetic', 1, 'Эмульгатор ПЭГ: может содержать следы примесей, для повреждённой кожи — осторожно.', { flags: ['peg'], aliases: ['peg 100 stearate'] }),
  d('PEG-40 Hydrogenated Castor Oil', 'ПЭГ-40 касторовое масло', ['emulsifier'], 'synthetic', 1, 'Солюбилизатор ароматов.', { flags: ['peg'], aliases: ['peg 40 hydrogenated castor oil'] }),
  d('Ceteareth-20', 'Цетеарет-20', ['emulsifier'], 'synthetic', 1, 'Этоксилированный эмульгатор.', { flags: ['peg'] }),
  d('Xanthan Gum', 'Ксантановая камедь', ['thickener'], 'natural', 0, 'Природный загуститель, делает гели.', { aliases: ['xanthan', 'ксантан'] }),
  d('Carbomer', 'Карбомер', ['thickener'], 'synthetic', 0, 'Синтетический гелеобразователь, безопасен.'),
  d('Acrylates/C10-30 Alkyl Acrylate Crosspolymer', 'Акрилатный полимер', ['thickener'], 'synthetic', 0, 'Загуститель и стабилизатор эмульсий.', { aliases: ['acrylates c10-30 alkyl acrylate crosspolymer'] }),
  d('Sodium Polyacrylate', 'Полиакрилат натрия', ['thickener'], 'synthetic', 0, 'Синтетический загуститель.'),
  d('Hydroxyethylcellulose', 'Гидроксиэтилцеллюлоза', ['thickener'], 'identical', 0, 'Загуститель из целлюлозы.'),
  d('Cellulose Gum', 'Целлюлозная камедь', ['thickener'], 'identical', 0, 'Загуститель из целлюлозы.'),
  d('Sclerotium Gum', 'Склероциевая камедь', ['thickener'], 'natural', 0, 'Природный загуститель с ощущением бархата.'),
  d('Silica', 'Кремнезём', ['thickener'], 'mineral', 0, 'Матирует и делает текстуру бархатистой.', { aliases: ['hydrated silica'] }),
  d('Kaolin', 'Белая глина', ['thickener', 'exfoliant'], 'mineral', 0, 'Мягкая глина, впитывает излишки себума.', { aliases: ['каолин'] }),
  d('Bentonite', 'Бентонит', ['thickener'], 'mineral', 0, 'Активная глина, сильно абсорбирует жир.'),
  d('Tapioca Starch', 'Крахмал тапиоки', ['thickener'], 'natural', 0, 'Матирует и убирает липкость.', { aliases: ['zea mays starch', 'corn starch', 'maranta arundinacea root powder', 'oryza sativa starch'] }),

  // ПАВ
  d('Sodium Lauryl Sulfate', 'Лаурилсульфат натрия (SLS)', ['surfactant'], 'synthetic', 3, 'Агрессивный ПАВ: сильно обезжиривает, раздражает чувствительную кожу.', { flags: ['sulfate', 'irritant'], aliases: ['sls'] }),
  d('Sodium Laureth Sulfate', 'Лауретсульфат натрия (SLES)', ['surfactant'], 'synthetic', 2, 'Более мягкий, чем SLS, но всё ещё сушит.', { flags: ['sulfate', 'peg'], aliases: ['sles'] }),
  d('Ammonium Lauryl Sulfate', 'Лаурилсульфат аммония', ['surfactant'], 'synthetic', 2, 'Сульфатный ПАВ.', { flags: ['sulfate', 'irritant'] }),
  d('Cocamidopropyl Betaine', 'Кокамидопропилбетаин', ['surfactant'], 'identical', 1, 'Мягкий ПАВ, смягчает сульфаты, редко вызывает аллергию.'),
  d('Sodium Cocoyl Isethionate', 'Кокоил изетионат натрия', ['surfactant'], 'identical', 0, 'Очень мягкий ПАВ из кокоса, основа твёрдых шампуней.', { aliases: ['sci'] }),
  d('Coco-Glucoside', 'Кокоглюкозид', ['surfactant'], 'identical', 0, 'Мягкий ПАВ из сахара и кокоса.', { aliases: ['decyl glucoside', 'lauryl glucoside'] }),
  d('Sodium Cocoyl Glutamate', 'Кокоил глутамат натрия', ['surfactant'], 'identical', 0, 'Аминокислотный ПАВ, очень бережный.'),
  d('Disodium Laureth Sulfosuccinate', 'Лаурет сульфосукцинат', ['surfactant'], 'synthetic', 1, 'Мягкий ПАВ, не сульфат.'),
  d('Cocamide DEA', 'Кокамид ДЭА', ['surfactant', 'thickener'], 'synthetic', 2, 'Пенообразователь, ограничен из-за возможных нитрозаминов.', { flags: ['irritant'] }),
  d('Sodium Chloride', 'Хлорид натрия', ['thickener'], 'mineral', 0, 'Соль — загущает шампуни.', { aliases: ['salt', 'sea salt', 'maris sal'] }),

  // Консерванты
  d('Phenoxyethanol', 'Феноксиэтанол', ['preservative'], 'synthetic', 1, 'Распространённый консервант, безопасен до 1%.'),
  d('Ethylhexylglycerin', 'Этилгексилглицерин', ['preservative', 'humectant'], 'synthetic', 0, 'Усиливает действие консервантов.'),
  d('Methylparaben', 'Метилпарабен', ['preservative'], 'synthetic', 1, 'Короткий парабен, хорошо изучен и считается безопасным в допустимых дозах.', { flags: ['paraben'] }),
  d('Ethylparaben', 'Этилпарабен', ['preservative'], 'synthetic', 1, 'Короткий парабен.', { flags: ['paraben'] }),
  d('Propylparaben', 'Пропилпарабен', ['preservative'], 'synthetic', 2, 'Длинный парабен — концентрации в ЕС ограничены.', { flags: ['paraben', 'pregnancy'] }),
  d('Butylparaben', 'Бутилпарабен', ['preservative'], 'synthetic', 2, 'Длинный парабен с возможной слабой гормональной активностью.', { flags: ['paraben', 'pregnancy'] }),
  d('DMDM Hydantoin', 'ДМДМ гидантоин', ['preservative'], 'synthetic', 3, 'Донор формальдегида — может вызывать аллергию.', { flags: ['formaldehyde', 'allergen'] }),
  d('Imidazolidinyl Urea', 'Имидазолидинилмочевина', ['preservative'], 'synthetic', 3, 'Донор формальдегида.', { flags: ['formaldehyde', 'allergen'] }),
  d('Diazolidinyl Urea', 'Диазолидинилмочевина', ['preservative'], 'synthetic', 3, 'Донор формальдегида.', { flags: ['formaldehyde', 'allergen'] }),
  d('Methylisothiazolinone', 'Метилизотиазолинон', ['preservative'], 'synthetic', 3, 'Сильный аллерген, запрещён в несмываемых средствах ЕС.', { flags: ['allergen', 'irritant'], aliases: ['mit'] }),
  d('Methylchloroisothiazolinone', 'Метилхлоризотиазолинон', ['preservative'], 'synthetic', 3, 'Сильный аллерген (Kathon CG).', { flags: ['allergen', 'irritant'] }),
  d('Sodium Benzoate', 'Бензоат натрия', ['preservative'], 'identical', 0, 'Мягкий консервант, работает в кислой среде.'),
  d('Potassium Sorbate', 'Сорбат калия', ['preservative'], 'identical', 0, 'Мягкий консервант, пищевой.'),
  d('Benzyl Alcohol', 'Бензиловый спирт', ['preservative', 'fragrance'], 'identical', 1, 'Консервант и компонент ароматов.', { flags: ['allergen'] }),
  d('Dehydroacetic Acid', 'Дегидроацетовая кислота', ['preservative'], 'synthetic', 0, 'Консервант, разрешён в натуральной косметике.', { aliases: ['sodium dehydroacetate'] }),
  d('Chlorphenesin', 'Хлорфенезин', ['preservative'], 'synthetic', 1, 'Консервант, иногда раздражает.'),
  d('Levulinic Acid', 'Левулиновая кислота', ['preservative'], 'natural', 0, 'Натуральный консервант из растений.', { aliases: ['sodium levulinate'] }),
  d('Sodium Anisate', 'Анисат натрия', ['preservative'], 'natural', 0, 'Консервант с растительным происхождением.'),

  // Антиоксиданты
  d('Tocopherol', 'Витамин E', ['antioxidant'], 'identical', 0, 'Защищает масла и кожу от окисления.', { act: 1, com: 2, aliases: ['vitamin e', 'tocopheryl acetate', 'витамин e', 'токоферол'] }),
  d('Ascorbic Acid', 'Витамин C', ['antioxidant', 'active'], 'identical', 1, 'Чистый витамин C: осветляет, стимулирует коллаген. Может пощипывать.', { act: 3, flags: ['irritant'], aliases: ['l-ascorbic acid', 'витамин c'] }),
  d('Ascorbyl Glucoside', 'Аскорбил глюкозид', ['antioxidant', 'active'], 'synthetic', 0, 'Стабильная форма витамина C.', { act: 2, aliases: ['sodium ascorbyl phosphate', 'magnesium ascorbyl phosphate', 'ethyl ascorbic acid', '3-o-ethyl ascorbic acid', 'ascorbyl tetraisopalmitate'] }),
  d('Ferulic Acid', 'Феруловая кислота', ['antioxidant', 'active'], 'natural', 0, 'Антиоксидант, усиливает витамины C и E.', { act: 2 }),
  d('Resveratrol', 'Ресвератрол', ['antioxidant', 'active'], 'natural', 0, 'Антиоксидант из винограда.', { act: 2 }),
  d('Ubiquinone', 'Коэнзим Q10', ['antioxidant', 'active'], 'identical', 0, 'Антиоксидант, поддерживает энергию клеток.', { act: 1, aliases: ['coenzyme q10'] }),
  d('BHT', 'Бутилгидрокситолуол', ['antioxidant'], 'synthetic', 1, 'Синтетический антиоксидант-стабилизатор.', { aliases: ['butylated hydroxytoluene'] }),

  // Активы
  d('Niacinamide', 'Ниацинамид', ['active'], 'identical', 0, 'Витамин B3: сужает поры, выравнивает тон, укрепляет барьер.', { act: 3, aliases: ['nicotinamide', 'vitamin b3', 'ниацинамид'] }),
  d('Retinol', 'Ретинол', ['active'], 'identical', 2, 'Золотой стандарт антиэйдж. Вводить постепенно, обязателен SPF.', { act: 3, flags: ['irritant', 'pregnancy'], aliases: ['retinyl palmitate', 'retinal', 'retinaldehyde', 'hydroxypinacolone retinoate', 'ретинол'] }),
  d('Bakuchiol', 'Бакучиол', ['active', 'antioxidant'], 'natural', 0, 'Растительная мягкая альтернатива ретинолу.', { act: 2 }),
  d('Ceramide NP', 'Церамиды', ['active', 'emollient'], 'identical', 0, 'Липиды барьера кожи, удерживают влагу.', { act: 2, aliases: ['ceramide ap', 'ceramide eop', 'ceramide ns', 'ceramide 3', 'ceramides'] }),
  d('Cholesterol', 'Холестерин', ['emollient'], 'identical', 0, 'Липид барьера, работает в паре с церамидами.', { act: 1 }),
  d('Phytosphingosine', 'Фитосфингозин', ['active'], 'identical', 0, 'Предшественник церамидов, противовоспалительный.', { act: 1 }),
  d('Palmitoyl Tripeptide-1', 'Пептид', ['active'], 'synthetic', 0, 'Сигнальный пептид, стимулирует синтез коллагена.', { act: 2, aliases: ['palmitoyl tetrapeptide-7', 'palmitoyl pentapeptide-4', 'acetyl hexapeptide-8', 'copper tripeptide-1', 'palmitoyl tripeptide-5', 'matrixyl', 'argireline'] }),
  d('Adenosine', 'Аденозин', ['active'], 'identical', 0, 'Разглаживает морщины, признан в Корее антиэйдж-активом.', { act: 2 }),
  d('Centella Asiatica Extract', 'Экстракт центеллы', ['extract', 'soothing', 'active'], 'natural', 0, 'Успокаивает и восстанавливает кожу.', { act: 2, aliases: ['centella asiatica leaf extract', 'madecassoside', 'asiaticoside', 'cica'] }),
  d('Salicylic Acid', 'Салициловая кислота (BHA)', ['exfoliant', 'active'], 'identical', 1, 'Очищает поры изнутри, помогает при акне.', { act: 3, flags: ['pregnancy'], aliases: ['bha', 'betaine salicylate'] }),
  d('Glycolic Acid', 'Гликолевая кислота (AHA)', ['exfoliant', 'active'], 'identical', 2, 'Сильная AHA: обновляет кожу, повышает фоточувствительность.', { act: 3, flags: ['irritant'] }),
  d('Lactic Acid', 'Молочная кислота', ['exfoliant', 'active', 'ph'], 'natural', 1, 'Мягкая AHA с увлажняющим действием.', { act: 2 }),
  d('Mandelic Acid', 'Миндальная кислота', ['exfoliant', 'active'], 'identical', 1, 'Мягкая AHA для чувствительной кожи.', { act: 2 }),
  d('Gluconolactone', 'Глюконолактон (PHA)', ['exfoliant', 'humectant'], 'identical', 0, 'Самый мягкий пилинг-агент.', { act: 1, aliases: ['lactobionic acid'] }),
  d('Azelaic Acid', 'Азелаиновая кислота', ['active'], 'identical', 1, 'Против акне и покраснений, выравнивает тон.', { act: 3, aliases: ['potassium azeloyl diglycinate'] }),
  d('Tranexamic Acid', 'Транексамовая кислота', ['active'], 'synthetic', 0, 'Осветляет пигментацию.', { act: 2 }),
  d('Alpha-Arbutin', 'Альфа-арбутин', ['active'], 'identical', 0, 'Мягко осветляет пигментные пятна.', { act: 2, aliases: ['arbutin'] }),
  d('Caffeine', 'Кофеин', ['active'], 'identical', 0, 'Снимает отёки, тонизирует.', { act: 1, aliases: ['кофеин'] }),
  d('Zinc PCA', 'Цинк PCA', ['active'], 'identical', 0, 'Регулирует себум.', { act: 1, aliases: ['zinc gluconate'] }),
  d('Bisabolol', 'Бисаболол', ['soothing'], 'identical', 0, 'Успокаивающий компонент ромашки.', { act: 1, aliases: ['alpha-bisabolol'] }),
  d('Dipotassium Glycyrrhizate', 'Глицирризинат калия', ['soothing'], 'natural', 0, 'Экстракт солодки, снимает раздражение.', { act: 1 }),
  d('Colloidal Oatmeal', 'Коллоидная овсянка', ['soothing'], 'natural', 0, 'Успокаивает зуд и сухость.', { act: 1, aliases: ['avena sativa kernel flour', 'avena sativa kernel extract', 'avena sativa'] }),
  d('Collagen', 'Коллаген', ['humectant'], 'natural', 0, 'Плёнкообразующий увлажнитель; в кожу не проникает.', { aliases: ['hydrolyzed collagen', 'soluble collagen'] }),
  d('Squalene', 'Сквален', ['emollient'], 'natural', 0, 'Природный липид, но окисляется.', { com: 1 }),

  // Экстракты
  d('Camellia Sinensis Leaf Extract', 'Экстракт зелёного чая', ['extract', 'antioxidant'], 'natural', 0, 'Антиоксидант, успокаивает.', { act: 1, aliases: ['green tea extract', 'camellia sinensis leaf powder', 'matcha'] }),
  d('Chamomilla Recutita Flower Extract', 'Экстракт ромашки', ['extract', 'soothing'], 'natural', 0, 'Успокаивает, возможна аллергия у чувствительных к сложноцветным.', { act: 1, aliases: ['matricaria chamomilla flower extract', 'chamomile extract'] }),
  d('Calendula Officinalis Flower Extract', 'Экстракт календулы', ['extract', 'soothing'], 'natural', 0, 'Заживляет и успокаивает.', { act: 1 }),
  d('Glycyrrhiza Glabra Root Extract', 'Экстракт солодки', ['extract', 'soothing'], 'natural', 0, 'Осветляет и успокаивает.', { act: 1 }),
  d('Rosmarinus Officinalis Leaf Extract', 'Экстракт розмарина', ['extract', 'antioxidant'], 'natural', 0, 'Антиоксидант, защищает масла.', { act: 1 }),
  d('Vitis Vinifera Fruit Extract', 'Экстракт винограда', ['extract', 'antioxidant'], 'natural', 0, 'Полифенолы-антиоксиданты.'),
  d('Hamamelis Virginiana Extract', 'Экстракт гамамелиса', ['extract'], 'natural', 1, 'Вяжущий экстракт, может сушить.', { aliases: ['hamamelis virginiana leaf extract'] }),

  // Эфирные масла и отдушки
  d('Parfum', 'Отдушка', ['fragrance'], 'synthetic', 2, 'Смесь ароматических веществ без раскрытия состава — частая причина аллергии.', { flags: ['allergen'], aliases: ['fragrance', 'aroma', 'perfume', 'отдушка', 'парфюмерная композиция'] }),
  d('Lavandula Angustifolia Oil', 'Эфирное масло лаванды', ['fragrance'], 'natural', 1, 'Аромат, успокаивает, но содержит аллергены линалоол и лимонен.', { flags: ['allergen'], aliases: ['lavender oil'] }),
  d('Citrus Aurantium Dulcis Peel Oil', 'Эфирное масло апельсина', ['fragrance'], 'natural', 1, 'Фототоксично в несмываемых средствах.', { flags: ['allergen', 'irritant'], aliases: ['orange peel oil', 'citrus sinensis peel oil'] }),
  d('Citrus Limon Peel Oil', 'Эфирное масло лимона', ['fragrance'], 'natural', 1, 'Фототоксичное эфирное масло.', { flags: ['allergen', 'irritant'], aliases: ['lemon peel oil'] }),
  d('Melaleuca Alternifolia Leaf Oil', 'Масло чайного дерева', ['fragrance', 'active'], 'natural', 1, 'Антибактериальное, в высоких дозах раздражает.', { act: 1, flags: ['allergen'], aliases: ['tea tree oil'] }),
  d('Mentha Piperita Oil', 'Эфирное масло мяты', ['fragrance'], 'natural', 1, 'Охлаждает, может раздражать.', { flags: ['irritant'], aliases: ['peppermint oil', 'menthol'] }),
  d('Linalool', 'Линалоол', ['fragrance'], 'natural', 1, 'Компонент аромата, аллерген при окислении.', { flags: ['allergen'] }),
  d('Limonene', 'Лимонен', ['fragrance'], 'natural', 1, 'Компонент цитрусовых ароматов, аллерген.', { flags: ['allergen'] }),
  d('Citral', 'Цитраль', ['fragrance'], 'natural', 1, 'Аромат лимона, аллерген.', { flags: ['allergen'] }),
  d('Geraniol', 'Гераниол', ['fragrance'], 'natural', 1, 'Аромат розы, аллерген.', { flags: ['allergen'] }),
  d('Citronellol', 'Цитронеллол', ['fragrance'], 'natural', 1, 'Аромат, аллерген.', { flags: ['allergen'] }),
  d('Eugenol', 'Эвгенол', ['fragrance'], 'natural', 1, 'Аромат гвоздики, аллерген.', { flags: ['allergen'] }),
  d('Coumarin', 'Кумарин', ['fragrance'], 'natural', 1, 'Аромат сена, аллерген.', { flags: ['allergen'] }),
  d('Hexyl Cinnamal', 'Гексилциннамаль', ['fragrance'], 'synthetic', 1, 'Синтетический аромат, аллерген.', { flags: ['allergen'] }),
  d('Butylphenyl Methylpropional', 'Лилиаль', ['fragrance'], 'synthetic', 3, 'Запрещён в ЕС с 2022 года как репротоксичный.', { flags: ['allergen', 'pregnancy'], aliases: ['lilial'] }),
  d('Benzyl Salicylate', 'Бензилсалицилат', ['fragrance'], 'synthetic', 1, 'Аромат, аллерген.', { flags: ['allergen'] }),

  // УФ-фильтры
  d('Zinc Oxide', 'Оксид цинка', ['uv', 'soothing'], 'mineral', 0, 'Минеральный фильтр широкого спектра, успокаивает.', { act: 2 }),
  d('Titanium Dioxide', 'Диоксид титана', ['uv', 'colorant'], 'mineral', 0, 'Минеральный фильтр и белый пигмент.', { act: 2, aliases: ['ci 77891'] }),
  d('Octocrylene', 'Октокрилен', ['uv'], 'synthetic', 2, 'Химический фильтр UVB, может раздражать.', { act: 2, flags: ['chemical-uv', 'allergen'] }),
  d('Benzophenone-3', 'Оксибензон', ['uv'], 'synthetic', 3, 'Химический фильтр с возможной гормональной активностью.', { act: 2, flags: ['chemical-uv', 'pregnancy', 'allergen'], aliases: ['oxybenzone'] }),
  d('Ethylhexyl Methoxycinnamate', 'Октиноксат', ['uv'], 'synthetic', 2, 'Химический UVB-фильтр.', { act: 2, flags: ['chemical-uv'], aliases: ['octinoxate'] }),
  d('Butyl Methoxydibenzoylmethane', 'Авобензон', ['uv'], 'synthetic', 1, 'Химический UVA-фильтр, нестабилен на солнце без стабилизаторов.', { act: 2, flags: ['chemical-uv'], aliases: ['avobenzone'] }),
  d('Homosalate', 'Гомосалат', ['uv'], 'synthetic', 2, 'Химический фильтр, концентрации в ЕС снижены.', { act: 1, flags: ['chemical-uv'] }),
  d('Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine', 'Тинософ S', ['uv'], 'synthetic', 0, 'Современный фотостабильный фильтр широкого спектра.', { act: 2, aliases: ['bemotrizinol', 'tinosorb s'] }),

  // pH, хелаторы, цвет
  d('Citric Acid', 'Лимонная кислота', ['ph'], 'natural', 0, 'Регулирует pH.'),
  d('Sodium Hydroxide', 'Гидроксид натрия', ['ph'], 'mineral', 0, 'Регулятор pH, в готовом продукте нейтрализован.'),
  d('Triethanolamine', 'Триэтаноламин', ['ph'], 'synthetic', 1, 'Регулятор pH, может раздражать.', { flags: ['irritant'] }),
  d('Arginine', 'Аргинин', ['ph', 'humectant'], 'identical', 0, 'Аминокислота-нейтрализатор.'),
  d('Disodium EDTA', 'ЭДТА', ['chelator'], 'synthetic', 1, 'Связывает металлы, продлевает жизнь продукта.', { aliases: ['tetrasodium edta', 'edta'] }),
  d('Sodium Phytate', 'Фитат натрия', ['chelator'], 'natural', 0, 'Натуральная альтернатива ЭДТА.', { aliases: ['phytic acid'] }),
  d('Tetrasodium Glutamate Diacetate', 'Глутамат диацетат', ['chelator'], 'identical', 0, 'Биоразлагаемый хелатор.'),
  d('Mica', 'Слюда', ['colorant'], 'mineral', 0, 'Минерал для сияния.', { aliases: ['ci 77019'] }),
  d('Iron Oxides', 'Оксиды железа', ['colorant'], 'mineral', 0, 'Минеральные пигменты.', { aliases: ['ci 77491', 'ci 77492', 'ci 77499'] }),
];

const coreInci = new Set(CORE.map((i) => i.inci.toLowerCase()));
/** One shared base for the scanner, builder, glossary and ingredient pages. */
export const INGREDIENTS: Ingredient[] = [
  ...CORE.map((i) => ({ ...i, about: i.about ?? ABOUT[i.inci] })),
  ...[...EXTRA, ...EXTRA2, ...EXTRA3].filter((i) => !coreInci.has(i.inci.toLowerCase())),
];

