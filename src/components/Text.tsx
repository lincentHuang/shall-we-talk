import { Text as RNText, type TextProps } from 'react-native';

import { MAX_FONT_SCALE } from '../theme';

/**
 * 全 app 共用的 Text：系統字體放大最多到 MAX_FONT_SCALE，避免固定版型被撐破。
 * 一律從這裡 import Text，不要直接用 react-native 的。
 */
export function Text({ maxFontSizeMultiplier = MAX_FONT_SCALE, ...props }: TextProps) {
  return <RNText maxFontSizeMultiplier={maxFontSizeMultiplier} {...props} />;
}
