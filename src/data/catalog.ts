import gojoHeroImg from '../assets/images/gojo_hero_statue_1795017701444.jpg';
import gojoCinemaWideImg from '../assets/images/gojo_cinema_wide_1795017702641.jpg';
import gojoHollowMacroImg from '../assets/images/gojo_hollow_macro_1795017702290.jpg';
import sukunaCardImg from '../assets/images/sukuna_statue_card_1795017705049.jpg';
import megumiCardImg from '../assets/images/megumi_statue_card_1795017704628.jpg';
import yutaCardImg from '../assets/images/yuta_statue_card_1795017704798.jpg';
import tojiCardImg from '../assets/images/toji_statue_card_1795018302732.jpg';
import yujiCardImg from '../assets/images/yuji_blackflash_card_1795018303234.jpg';
import leviCardImg from '../assets/images/levi_aot_card_1795018304613.jpg';
import zoroCardImg from '../assets/images/zoro_king_hell_card_1795018305515.jpg';
import jinwooCardImg from '../assets/images/jinwoo_monarch_card_1795018305384.jpg';
import gutsCardImg from '../assets/images/guts_berserker_card_1795018305643.jpg';

export type ProductCategory = 'jjk' | 'icons' | 'gear';
export type CatalogFilter = 'all' | 'jjk' | 'icons' | 'museum' | 'gear';

export interface ProductVariant {
  id: string;
  label: string;
  priceInr: number;
  swatchHex?: string;
}

export interface CatalogProduct {
  id: string;
  title: string;
  series: string;
  category: ProductCategory;
  tier: 'museum' | 'collector';
  scaleOrSpec: string;
  material: string;
  editionNote: string;
  description: string;
  image: string;
  variants: ProductVariant[];
}

export const MERCHANT_UPI_VPA = '9311635332@fam';
export const MERCHANT_NAME = 'Kurogane Collectibles';

export const GOJO_HERO_IMAGE = gojoHeroImg;
export const GOJO_WIDE_IMAGE = gojoCinemaWideImg;
export const GOJO_MACRO_IMAGE = gojoHollowMacroImg;

export const SHOWCASE_STAGES = [
  {
    src: gojoCinemaWideImg,
    alt: '1/6 scale Satoru Gojo Domain Expansion statue on dark slate gallery pedestal with cobalt-violet rim light',
    title: 'Domain Expansion: Infinite Void',
    sub: '1/6 scale cold-cast polystone resin with translucent cursed-energy arcs',
  },
  {
    src: gojoHollowMacroImg,
    alt: 'Macro view of Satoru Gojo collector statue raising two fingers beside a luminous Hollow Purple crystal sphere',
    title: 'Hollow Purple Sculpt',
    sub: 'Faceted translucent violet resin sphere and individually sculpted fabric folds',
  },
  {
    src: gutsCardImg,
    alt: '1/4 scale Guts Berserker Armor museum polystone statue holding the Dragonslayer greatsword',
    title: '1/4 Museum Polystone Tier',
    sub: 'Hand-weathered gunmetal armor plates, tattered cape, and cliffside stonework',
  },
  {
    src: jinwooCardImg,
    alt: '1/6 scale Sung Jinwoo Shadow Monarch collector statue with rising armored shadow knights',
    title: 'High-End Anime Archive',
    sub: 'Numbered collector releases across Jujutsu Kaisen, Berserk, One Piece & Solo Leveling',
  },
];

export const GOJO_EDITIONS = [
  {
    id: 'blindfold-blue',
    name: 'Blindfold · Blue Aura',
    dot: '#3B82F6',
    priceInr: 14999,
    glowClass: 'aura-blue',
    summary: 'Signature half-raised blindfold revealing luminous Six Eyes',
  },
  {
    id: 'six-eyes-unmasked',
    name: 'Six Eyes · Unmasked',
    dot: '#60A5FA',
    priceInr: 18499,
    glowClass: 'aura-sapphire',
    summary: 'Interchangeable unmasked portrait head + magnetic cursed aura ring',
  },
  {
    id: 'hollow-purple-dx',
    name: 'Hollow Purple · UV Base',
    dot: '#8B5CF6',
    priceInr: 22999,
    glowClass: 'aura-violet',
    summary: 'Includes UV-reactive Hollow Purple crystal orb & dual portrait sculpts',
  },
] as const;

export const GOJO_SCALES = [
  { id: '1-6-std', label: '1/6 Standard (34 cm)', addonInr: 0, scale: 0.96 },
  { id: '1-6-dx', label: '1/6 Plinth DX (40 cm)', addonInr: 2500, scale: 1.03 },
] as const;

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: 'gojo-domain-dx',
    title: 'Satoru Gojo — Domain Expansion',
    series: 'Jujutsu Kaisen · 1/6 Scale',
    category: 'jjk',
    tier: 'museum',
    scaleOrSpec: '34–40 cm Height',
    material: 'Polystone & Translucent Resin',
    editionNote: 'Limited Run · 500 Pieces',
    description:
      'Museum-grade 1/6 scale Satoru Gojo statue featuring hand-shaded sorcerer tailoring, crystalline Six Eyes iris paintwork, and swirling translucent cursed-energy arcs.',
    image: gojoHeroImg,
    variants: [
      { id: 'blindfold-blue', label: 'Blindfold · Blue Aura', priceInr: 14999, swatchHex: '#3B82F6' },
      { id: 'six-eyes-unmasked', label: 'Six Eyes · Unmasked', priceInr: 18499, swatchHex: '#60A5FA' },
      { id: 'hollow-purple-dx', label: 'Hollow Purple · UV Base', priceInr: 22999, swatchHex: '#8B5CF6' },
    ],
  },
  {
    id: 'guts-berserker-1-4',
    title: 'Guts — Berserker Armor Unleashed',
    series: 'Berserk · 1/4 Museum Scale',
    category: 'icons',
    tier: 'museum',
    scaleOrSpec: '62 cm Height · 14.5 kg',
    material: 'Heavy Polystone & Die-Cast Steel',
    editionNote: 'Museum Flagship · Ed. of 250',
    description:
      'Monumental 1/4 scale Guts statue clad in jagged hand-weathered gunmetal Berserker Armor with tattered cloth-textured cape and steel Dragonslayer greatsword.',
    image: gutsCardImg,
    variants: [
      { id: 'helmet-rage', label: 'Beast Helmet · 1/4 Scale', priceInr: 36999, swatchHex: '#374151' },
      { id: 'cliff-dx', label: 'Dual Head Museum DX', priceInr: 44999, swatchHex: '#991B1B' },
    ],
  },
  {
    id: 'toji-fushiguro-1-4',
    title: 'Toji Fushiguro — Heavenly Restriction',
    series: 'Jujutsu Kaisen · 1/4 Scale',
    category: 'jjk',
    tier: 'museum',
    scaleOrSpec: '54 cm Height · 11.2 kg',
    material: 'Polystone & Metal Weaponry',
    editionNote: 'Museum Tier · Ed. of 300',
    description:
      'High-end 1/4 scale Toji Fushiguro standing atop shattered temple stonework with sculpted Inventory Curse spirit and die-cast Inverted Spear of Heaven.',
    image: tojiCardImg,
    variants: [
      { id: 'spear-std', label: 'Inverted Spear · 1/4', priceInr: 28999, swatchHex: '#475569' },
      { id: 'temple-dx', label: 'Arsenal Diorama DX', priceInr: 34999, swatchHex: '#6D28D9' },
    ],
  },
  {
    id: 'zoro-king-of-hell',
    title: 'Roronoa Zoro — King of Hell Asura',
    series: 'One Piece · 1/6 Masterwork',
    category: 'icons',
    tier: 'museum',
    scaleOrSpec: '42 cm Height',
    material: 'Polystone & Translucent Haki Resin',
    editionNote: 'Limited Edition · LED Base',
    description:
      'Three-sword Santoryu stance featuring billowing green haori, metal-finish Wado Ichimonji, Enma & Sandai Kitetsu engulfed in emerald and violet haki flames.',
    image: zoroCardImg,
    variants: [
      { id: 'santoryu-std', label: 'King of Hell · Standard', priceInr: 24499, swatchHex: '#10B981' },
      { id: 'enma-led', label: 'Asura Aura · LED Plinth', priceInr: 29999, swatchHex: '#7C3AED' },
    ],
  },
  {
    id: 'jinwoo-shadow-monarch',
    title: 'Sung Jinwoo — Shadow Monarch Arise',
    series: 'Solo Leveling · 1/6 Diorama',
    category: 'icons',
    tier: 'museum',
    scaleOrSpec: '44 cm Height',
    material: 'Polystone & UV-Reactive Resin',
    editionNote: 'Deluxe Diorama · Shadow Knights',
    description:
      'Shadow Monarch wielding twin Kasaka and Demon King daggers surrounded by rising armored shadow soldiers emerging from translucent violet obsidian mist.',
    image: jinwooCardImg,
    variants: [
      { id: 'monarch-std', label: 'Twin Daggers · 1/6', priceInr: 22499, swatchHex: '#6366F1' },
      { id: 'arise-diorama', label: 'Shadow Army Diorama DX', priceInr: 27999, swatchHex: '#7E22CE' },
    ],
  },
  {
    id: 'levi-ackerman-aot',
    title: 'Levi Ackerman — Survey Corps ODM',
    series: 'Attack on Titan · 1/6 Scale',
    category: 'icons',
    tier: 'collector',
    scaleOrSpec: '39 cm Height',
    material: 'Polystone, Steel Cables & Acrylic',
    editionNote: 'In Stock · Numbered Run',
    description:
      'Dynamic mid-air suspension above shattered Gothic stonework with precision metallic ODM gear cables, ultrahard steel blades, and flowing Survey Corps cloak.',
    image: leviCardImg,
    variants: [
      { id: 'odm-blades', label: 'Dual Steel Blades', priceInr: 21999, swatchHex: '#15803D' },
      { id: 'rooftop-dx', label: 'Gothic Rooftop DX', priceInr: 26499, swatchHex: '#334155' },
    ],
  },
  {
    id: 'sukuna-shrine-throne',
    title: 'Ryomen Sukuna — Malevolent Shrine',
    series: 'Jujutsu Kaisen · 1/6 Scale',
    category: 'jjk',
    tier: 'museum',
    scaleOrSpec: '36 cm Height',
    material: 'Polystone & Crimson Resin',
    editionNote: 'In Stock · Numbered Base',
    description:
      'King of Curses seated atop a chiseled bone-and-obsidian throne flanked by translucent crimson cursed-flame tongues and engraved kanji nameplate.',
    image: sukunaCardImg,
    variants: [
      { id: 'crimson-throne', label: 'Crimson Throne Ed.', priceInr: 19499, swatchHex: '#DC2626' },
      { id: 'shrine-dx', label: 'Shrine Diorama DX', priceInr: 23999, swatchHex: '#991B1B' },
    ],
  },
  {
    id: 'yuji-black-flash',
    title: 'Yuji Itadori — Black Flash Awakened',
    series: 'Jujutsu Kaisen · 1/6 Scale',
    category: 'jjk',
    tier: 'collector',
    scaleOrSpec: '33 cm Height',
    material: 'Polystone & Translucent Spark Resin',
    editionNote: 'In Stock · Ready to Ship',
    description:
      'Explosive mid-stride strike capturing distorted spatial lightning in deep crimson and obsidian translucent resin erupting over shattered basalt.',
    image: yujiCardImg,
    variants: [
      { id: 'black-flash', label: 'Black Flash Strike', priceInr: 15999, swatchHex: '#EF4444' },
      { id: 'sukuna-vessel-dx', label: 'Awakened Vessel DX', priceInr: 19499, swatchHex: '#7F1D1D' },
    ],
  },
  {
    id: 'megumi-ten-shadows',
    title: 'Megumi Fushiguro — Ten Shadows',
    series: 'Jujutsu Kaisen · 1/6 Scale',
    category: 'jjk',
    tier: 'collector',
    scaleOrSpec: '31 cm Height',
    material: 'Matte Polystone Resin',
    editionNote: 'In Stock · Ready to Ship',
    description:
      'Dynamic crouched shadow-summoning stance paired with sculpted Divine Dog Totality emerging from fractured dark basalt stone.',
    image: megumiCardImg,
    variants: [
      { id: 'divine-dog', label: 'Divine Dog Totality', priceInr: 13499, swatchHex: '#334155' },
      { id: 'chimera-base', label: 'Chimera Shadow Base', priceInr: 16499, swatchHex: '#1E293B' },
    ],
  },
  {
    id: 'yuta-cursed-katana',
    title: 'Yuta Okkotsu — Cursed Katana',
    series: 'Jujutsu Kaisen 0 · 1/6 Scale',
    category: 'jjk',
    tier: 'collector',
    scaleOrSpec: '33 cm Height',
    material: 'Polystone & Die-Cast Blade',
    editionNote: 'In Stock · Die-Cast Steel',
    description:
      'Special Grade sorcerer in crisp white coat wielding an unsheathed steel-finish katana enveloped by translucent dark-indigo cursed energy.',
    image: yutaCardImg,
    variants: [
      { id: 'special-grade', label: 'Special Grade Katana', priceInr: 14299, swatchHex: '#4F46E5' },
      { id: 'rika-aura', label: 'Rika Manifest Aura', priceInr: 17999, swatchHex: '#312E81' },
    ],
  },
  {
    id: 'material-flask-jjk',
    title: 'Material Flask — Collector Archive',
    series: 'Studio Carry · 18/8 Steel',
    category: 'gear',
    tier: 'collector',
    scaleOrSpec: '950 ml / 1.2 L',
    material: 'Double-Wall 18/8 Steel',
    editionNote: '24h Cold · 12h Hot',
    description:
      'Powder-coated double-wall vacuum insulated flask engineered for studio desks and field expeditions, with leakproof machined chug collar.',
    image: 'https://www.gstatic.com/aistudio/starter-apps/flask-applet/flask-order-cutout.webp',
    variants: [
      { id: 'basalt-950', label: 'Basalt Black · 950 ml', priceInr: 3999, swatchHex: '#222624' },
      { id: 'sage-950', label: 'Alpine Sage · 950 ml', priceInr: 3999, swatchHex: '#48634B' },
      { id: 'glacier-1200', label: 'Glacier Silver · 1.2 L', priceInr: 4499, swatchHex: '#B4BDB8' },
    ],
  },
];

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
