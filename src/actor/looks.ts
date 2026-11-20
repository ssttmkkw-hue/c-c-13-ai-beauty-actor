import type { BlushSpec, TextureRecipe } from './textureOps';

/**
 * Character "look books": which VRM file, how to tune its materials for a
 * flattering 漫剧 look, and the outfit / hair variants exposed in the UI.
 *
 * Every model here is redistributable — see docs/CREDITS.md.
 */

export interface MaterialOp {
  /** Regex tested against the material name. */
  match: RegExp;
  /** Recolour the base (and shade-multiply) texture. */
  recipe?: TextureRecipe;
  /** Override MToon lit colour factor (hex). */
  color?: string;
  /** Override MToon shade colour factor (hex). */
  shade?: string;
  /** Outline colour (hex). */
  outline?: string;
  /** Matcap (VRoid "sphere add" hair sheen) tint (hex). */
  matcap?: string;
  /** Emissive tint (VRoid bakes coloured hair glints into emission). */
  emissive?: string;
}

export interface Variant {
  id: string;
  label: string;
  note?: string;
  ops: MaterialOp[];
}

export type Role = 'heroine' | 'hero';

export interface CharacterLook {
  id: string;
  name: string;
  nameEn: string;
  role: Role;
  tagline: string;
  model: string;
  /** Uniform scale tweak so leads stand at believable relative heights. */
  scale?: number;
  outfits: Variant[];
  hairs: Variant[];
  blush: BlushSpec;
  /** Warm, rosy skin shadow — the single biggest "anime beauty" lever. */
  skinShade: string;
  /** Hair rim / sheen tint. */
  hairRim: string;
  /** Material name patterns. */
  hairMatch: RegExp;
  /** Eye openness bias (0 = model default). Slightly wider eyes read younger/softer. */
  eyeBias?: number;
  /** Voice pitch/rate hints for Web Speech. */
  voice: { pitch: number; rate: number };
}

const VROID_BLUSH: BlushSpec = { left: [0.285, 0.64], right: [0.715, 0.64], rx: 0.085, ry: 0.048, hatch: true };

export const LOOKS: CharacterLook[] = [
  {
    id: 'linwan',
    name: '林晚',
    nameEn: 'Lin Wan',
    role: 'heroine',
    tagline: '女主 · 温柔长发，安静里有倔强',
    model: 'models/linwan.vrm',
    scale: 1.05,
    hairMatch: /HAIR/,
    skinShade: '#f1b7b4',
    hairRim: '#ffd9c2',
    blush: { left: [0.3, 0.635], right: [0.7, 0.635], rx: 0.085, ry: 0.045, hatch: true },
    voice: { pitch: 1.25, rate: 0.92 },
    outfits: [
      {
        id: 'blossom',
        label: '樱色碎花',
        note: '浅粉碎花上衣 · 白色短裤',
        ops: [
          {
            match: /Tops/,
            recipe: {
              gradient: [[0, '#9c5868'], [0.55, '#eeb2bf'], [0.85, '#fbd9e0'], [1, '#fff0f3']],
              patterns: [{ kind: 'sakura', color: '#ffffff', color2: '#ffcf73', scale: 64, opacity: 0.9 }],
            },
            shade: '#d99aae',
          },
          { match: /Bottoms/, recipe: { gradient: [[0, '#b9adb6'], [0.22, '#f4eef0'], [1, '#ffffff']] }, shade: '#c9b8cc' },
          { match: /Shoes/, recipe: { gradient: [[0, '#8c7d86'], [0.4, '#f6eef0'], [1, '#ffffff']] } },
        ],
      },
      {
        id: 'daily',
        label: '白T · 日常',
        note: '原版纯白T恤 · 黑色短裤',
        ops: [],
      },
      {
        id: 'starlight',
        label: '星夜',
        note: '深夜蓝上衣缀金色星点',
        ops: [
          {
            match: /Tops/,
            recipe: {
              gradient: [[0, '#06060f'], [0.6, '#1a1838'], [1, '#2f2b5a']],
              patterns: [{ kind: 'dots', color: '#f3d48a', scale: 26, opacity: 0.85 }],
            },
            shade: '#6c6aa8',
          },
          { match: /Bottoms/, recipe: { gradient: [[0, '#05050a'], [0.3, '#22203a'], [1, '#4b4670']] }, shade: '#7a76b0' },
          { match: /Shoes/, recipe: { gradient: [[0, '#0a0a12'], [0.5, '#2a2840'], [1, '#d9c38a']] } },
        ],
      },
    ],
    hairs: [
      { id: 'brown', label: '栗棕', ops: [] },
      {
        id: 'ink',
        label: '墨黑',
        ops: [{ match: /HAIR/, recipe: { gradient: [[0, '#08070c'], [0.45, '#221f2c'], [0.75, '#3d3850'], [1, '#6d6688']] }, shade: '#8a7fb0' }],
      },
      {
        id: 'honey',
        label: '奶茶',
        ops: [{ match: /HAIR/, recipe: { gradient: [[0, '#5a3a28'], [0.45, '#b98a66'], [0.8, '#e2c1a0'], [1, '#f6e2c8']] } }],
      },
    ],
  },
  {
    id: 'guyan',
    name: '顾言',
    nameEn: 'Gu Yan',
    role: 'hero',
    tagline: '男主 · 冷面温柔，碎发下藏着心事',
    model: 'models/guyan.vrm',
    scale: 0.97,
    hairMatch: /HAIR/,
    skinShade: '#e9b3a6',
    hairRim: '#b9c8ff',
    blush: VROID_BLUSH,
    voice: { pitch: 0.75, rate: 0.95 },
    outfits: [
      {
        id: 'suit',
        label: '黑金西装',
        note: '黑色马甲 · 白衬衫 · 酒红领带',
        ops: [
          {
            match: /Tops/,
            recipe: { gradient: [[0, '#030305'], [0.22, '#0f0f15'], [0.42, '#26262f'], [0.58, '#c9cad3'], [0.8, '#f1f1f5'], [1, '#ffffff']] },
            shade: '#9a9ab4',
          },
          { match: /Accessory/, recipe: { gradient: [[0, '#1c0307'], [0.5, '#5e0f1d'], [1, '#a32a3c']] }, shade: '#b06a7a' },
          { match: /Bottoms/, recipe: { gradient: [[0, '#020203'], [0.25, '#121218'], [1, '#3a3a48']] }, shade: '#8a8aa6' },
          { match: /Shoes/, recipe: { gradient: [[0, '#020203'], [0.5, '#16161c'], [1, '#6a6a78']] } },
        ],
      },
      {
        id: 'knit',
        label: '温柔针织',
        note: '燕麦色针织马甲 · 雾蓝衬衫',
        ops: [
          {
            match: /Tops/,
            recipe: { gradient: [[0, '#3b2e25'], [0.2, '#8f7763'], [0.4, '#d9c7b1'], [0.55, '#b9c8de'], [0.8, '#e8eef7'], [1, '#ffffff']] },
            shade: '#c7a9a0',
          },
          { match: /Accessory/, recipe: { gradient: [[0, '#0d1428'], [0.5, '#24365e'], [1, '#4a6496']] } },
          { match: /Bottoms/, recipe: { gradient: [[0, '#26211d'], [0.3, '#5d5249'], [1, '#a89a8c']] }, shade: '#a89aa8' },
        ],
      },
      { id: 'campus', label: '学院制服', note: '原版藏青马甲 · 橙色领带', ops: [] },
    ],
    hairs: [
      { id: 'ink', label: '墨黑', ops: [{ match: /HAIR/, recipe: { saturation: 0.15 }, color: '#2c2e3c', shade: '#4a4a6a', matcap: '#7c86b0', emissive: '#1a1f3a' }] },
      { id: 'umber', label: '深棕', ops: [{ match: /HAIR/, recipe: { saturation: 0.2 }, color: '#5e4136', shade: '#5a3a3a', matcap: '#a08070', emissive: '#3a2418' }] },
      { id: 'rose', label: '原色', ops: [] },
    ],
  },
  {
    id: 'sutang',
    name: '苏棠',
    nameEn: 'Su Tang',
    role: 'heroine',
    tagline: '女配 · 元气短发学妹',
    model: 'models/sutang.vrm',
    hairMatch: /Hair(Back)?_00_HAIR(_01)?$|HairBack/,
    skinShade: '#f3bcb8',
    hairRim: '#c8d4ff',
    blush: VROID_BLUSH,
    voice: { pitch: 1.4, rate: 1.0 },
    outfits: [
      { id: 'campus', label: '学院制服', note: '藏青马甲 · 橙色领结（原版）', ops: [] },
      {
        id: 'rose',
        label: '樱粉制服',
        note: '樱粉马甲 · 酒红领结',
        ops: [
          {
            match: /Tops/,
            recipe: { gradient: [[0, '#5a2a3a'], [0.25, '#c07890'], [0.45, '#e7aabb'], [0.6, '#f6e7ee'], [1, '#ffffff']] },
            shade: '#d7a0b8',
          },
          { match: /Accessory/, recipe: { gradient: [[0, '#2a0510'], [0.6, '#8a1e3a'], [1, '#d65a78']] } },
          { match: /Bottoms/, recipe: { gradient: [[0, '#3a1a28'], [0.4, '#a05a76'], [1, '#e8b4c6']] } },
        ],
      },
    ],
    hairs: [
      { id: 'navy', label: '藏青', ops: [] },
      { id: 'ink', label: '墨黑', ops: [{ match: /HAIR_01|HairBack/, color: '#1c1b24', shade: '#2d2840', matcap: '#7c86b0', emissive: '#1a1f3a' }] },
    ],
  },
  {
    id: 'bailu',
    name: '白露',
    nameEn: 'Bai Lu',
    role: 'heroine',
    tagline: '女配 · 月光一样的千金',
    model: 'models/bailu.vrm',
    hairMatch: /HAIR_0[12]|HairBack/,
    skinShade: '#f3c0bf',
    hairRim: '#fff1c8',
    blush: VROID_BLUSH,
    voice: { pitch: 1.3, rate: 0.9 },
    outfits: [
      { id: 'blossom', label: '白樱礼裙', note: '原版白粉礼裙', ops: [] },
      {
        id: 'moon',
        label: '月夜礼裙',
        note: '午夜蓝礼裙 · 银白蕾丝',
        ops: [
          {
            match: /Onepice/,
            recipe: { gradient: [[0, '#0a0c22'], [0.35, '#1f2a62'], [0.65, '#5a6ab4'], [0.88, '#c9d2ff'], [1, '#ffffff']], saturation: 0.9 },
            shade: '#7c86c8',
          },
          { match: /Shoes/, recipe: { gradient: [[0, '#0a0c22'], [0.5, '#2a3470'], [1, '#e6e9ff']] } },
        ],
      },
    ],
    hairs: [
      { id: 'gold', label: '浅金', ops: [] },
      { id: 'silver', label: '银白', ops: [{ match: /HAIR_0[12]|HairBack/, color: '#e9ecf6', shade: '#a9aed0', emissive: '#2a3050' }] },
      { id: 'ink', label: '墨黑', ops: [{ match: /HAIR_0[12]|HairBack/, color: '#2a2833', shade: '#3a3350', matcap: '#7c86b0', emissive: '#1a1f3a' }] },
    ],
  },
  {
    id: 'shenxing',
    name: '沈星',
    nameEn: 'Shen Xing',
    role: 'hero',
    tagline: '男配 · 背头学长，干净利落',
    model: 'models/shenxing.vrm',
    scale: 0.97,
    hairMatch: /HAIR/,
    skinShade: '#ecb7aa',
    hairRim: '#c8e8ff',
    blush: VROID_BLUSH,
    voice: { pitch: 0.9, rate: 1.0 },
    outfits: [
      { id: 'campus', label: '学院制服', note: '原版藏青马甲 · 橙色领带', ops: [] },
      {
        id: 'suit',
        label: '白色西装马甲',
        note: '象牙白马甲 · 金棕领带',
        ops: [
          {
            match: /Tops/,
            recipe: { gradient: [[0, '#4a4036'], [0.2, '#cbbfae'], [0.4, '#f1ebe1'], [0.6, '#dfe6f0'], [1, '#ffffff']] },
            shade: '#c8b6aa',
          },
          { match: /Tie/, recipe: { gradient: [[0, '#2a1606'], [0.5, '#8a5a24'], [1, '#e2b56a']] } },
          { match: /Bottoms/, recipe: { gradient: [[0, '#3c352e'], [0.3, '#a99c8c'], [1, '#efe8de']] } },
        ],
      },
    ],
    hairs: [
      { id: 'teal', label: '原色青', ops: [] },
      { id: 'ink', label: '墨黑', ops: [{ match: /HAIR/, color: '#3a3d52', shade: '#151622', matcap: '#7c86b0', emissive: '#1a1f3a' }] },
      { id: 'umber', label: '栗棕', ops: [{ match: /HAIR/, color: '#7a5848', shade: '#3e2622', matcap: '#a08070', emissive: '#3a2418' }] },
    ],
  },
];

export function lookById(id: string): CharacterLook {
  const l = LOOKS.find((x) => x.id === id);
  if (!l) throw new Error(`unknown character ${id}`);
  return l;
}
