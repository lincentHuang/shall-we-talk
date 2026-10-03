import { Platform } from 'react-native';

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
};

export const fonts = {
  // 中文襯線（Noto Serif TC，已依題庫字元子集化）
  serif: 'NotoSerifTC_500',
  serifBold: 'NotoSerifTC_700',
  // 西文裝飾字（Cormorant Garamond）
  display: 'Cormorant_600Italic',
  displayRegular: 'Cormorant_500',
};

/** RN 0.76+（新架構）與 react-native-web 都支援 boxShadow */
export const shadow = (elevation = 8, opacity = 0.22) => ({
  boxShadow: `0px ${Math.round(elevation * 0.8)}px ${Math.round(elevation * 2.2)}px rgba(58,42,85,${opacity})`,
});

export const isWeb = Platform.OS === 'web';

/** 卡牌比例（寬:高 = 2:3），與生成的卡面美術一致 */
export const CARD_RATIO = 1341 / 900;
