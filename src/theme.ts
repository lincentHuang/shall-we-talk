import { Platform, useWindowDimensions, type TextStyle } from 'react-native';

export const colors = {
  // 背景：薰衣草紫 → 奶油羊皮紙
  bgTop: '#E9E0F5',
  bgBottom: '#FBF3E6',
  parchment: '#FBF1DF',
  parchmentDeep: '#F3E4C8',
  lavender: '#B9A6DA',
  lavenderDeep: '#8E79B8',
  plum: '#4E3F6B',
  ink: '#3B3150',
  inkSoft: '#6E6384',
  gold: '#C9A25A',
  goldLight: '#E8CF94',
  goldDeep: '#9C7633',
  turquoise: '#A9E3DC',
  rose: '#D99AAB',
  white: '#FFFFFF',
  shadow: '#3A2A55',

  // 語意色：各畫面共用，不要再寫死色碼
  /** 選取中的紫底 */
  primary: '#7D69AD',
  /** 紫底上的字 */
  onPrimary: '#FFF8EA',
  onPrimarySoft: '#EDE2FA',
  /** 羊皮紙卡片底色 */
  surface: 'rgba(251,241,223,0.9)',
  /** 金色細框 */
  line: 'rgba(201,162,90,0.45)',
  lineStrong: 'rgba(201,162,90,0.6)',
  /** 收藏愛心 */
  heart: '#B5536F',
};

export const gradients = {
  primary: ['#8F7BBE', '#6B5899'] as const,
  gold: ['#E8CF94', '#C9A25A', '#E8CF94'] as const,
};

export const radius = { sm: 10, md: 14, lg: 26, pill: 999 };

export const fonts = {
  // 中文襯線（Noto Serif TC，已依題庫字元子集化）
  serif: 'NotoSerifTC_500',
  serifBold: 'NotoSerifTC_700',
  // 西文裝飾字（Cormorant Garamond）
  display: 'Cormorant_600Italic',
  displayRegular: 'Cormorant_500',
};

/* ---------- 字級 ---------- */

/**
 * 字級表：所有文字都從這裡取用，每一級都帶 lineHeight。
 *
 * 思源宋體在 Android 上的預設行距約 1.45 倍、還會再加字型上下留白，
 * 沒有指定 lineHeight 的字放進固定高度的卡片就會被切掉或撐破版面，
 * 所以中文行高一律 ≥ 1.5 倍、西文裝飾字 ≥ 1.25 倍。
 * 顏色、字距依用途在各自的樣式裡補上；要改粗細只換 fontFamily，不要單獨改 fontSize。
 */
export const type = {
  // 中文襯線
  hero: { fontFamily: fonts.serifBold, fontSize: 46, lineHeight: 62 },
  display: { fontFamily: fonts.serifBold, fontSize: 22, lineHeight: 32 },
  title: { fontFamily: fonts.serifBold, fontSize: 20, lineHeight: 30 },
  heading: { fontFamily: fonts.serifBold, fontSize: 17, lineHeight: 26 },
  subtitle: { fontFamily: fonts.serifBold, fontSize: 15, lineHeight: 22 },
  bodyLarge: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 30 },
  body: { fontFamily: fonts.serif, fontSize: 15, lineHeight: 24 },
  bodySmall: { fontFamily: fonts.serif, fontSize: 14, lineHeight: 22 },
  callout: { fontFamily: fonts.serif, fontSize: 13, lineHeight: 20 },
  caption: { fontFamily: fonts.serif, fontSize: 12, lineHeight: 18 },
  footnote: { fontFamily: fonts.serif, fontSize: 11.5, lineHeight: 17 },
  micro: { fontFamily: fonts.serif, fontSize: 10, lineHeight: 15 },
  // 西文裝飾：羅馬數字、英文小標
  numeralXL: { fontFamily: fonts.display, fontSize: 46, lineHeight: 54 },
  numeralL: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38 },
  numeral: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
  numeralS: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22 },
  script: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20 },
  scriptS: { fontFamily: fonts.display, fontSize: 13, lineHeight: 17 },
  /** ✦ ♡ ☾ 這類符號（會落到系統備用字型，行高要固定） */
  glyph: { fontFamily: fonts.displayRegular, fontSize: 15, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

/**
 * 系統字體大小最多跟到 1.3 倍（Android「大」、iOS 一般設定的上限）。
 * 再大的話，卡片、按鈕這些照美術比例排的版面會被撐破；共用的 Text 元件會自動套用。
 */
export const MAX_FONT_SCALE = 1.3;

/** 目前實際生效的字體倍率（已套用上限） */
export function useFontScale() {
  const { fontScale } = useWindowDimensions();
  return Math.min(fontScale || 1, MAX_FONT_SCALE);
}

/**
 * 固定高度、裡面有字的區塊（卡片文字區、狀態列）用這個算高度：
 * textH 是字級 1 倍時的字高（各行 lineHeight 相加），pad 是不隨字級變的內距與框線。
 */
export function useTextHeight() {
  const fs = useFontScale();
  return (textH: number, pad = 0) => Math.ceil(pad + textH * fs);
}

/* ---------- 其他 ---------- */

/** RN 0.76+（新架構）與 react-native-web 都支援 boxShadow */
export const shadow = (elevation = 8, opacity = 0.22) => ({
  boxShadow: `0px ${Math.round(elevation * 0.8)}px ${Math.round(elevation * 2.2)}px rgba(58,42,85,${opacity})`,
});

export const isWeb = Platform.OS === 'web';

/** 卡牌比例（寬:高 = 2:3），與生成的卡面美術一致 */
export const CARD_RATIO = 1341 / 900;
