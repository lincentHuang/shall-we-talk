import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, type } from '../theme';
import { Text } from './Text';

/** 金色分隔線：─── ◆ ─── */
export function Divider({ width = 180, color = colors.gold }: { width?: number; color?: string }) {
  const mid = width / 2;
  return (
    <Svg width={width} height={14} viewBox={`0 0 ${width} 14`}>
      <Path d={`M0 7 H${mid - 16}`} stroke={color} strokeWidth={0.9} />
      <Path d={`M${mid + 16} 7 H${width}`} stroke={color} strokeWidth={0.9} />
      <Path d={`M${mid} 1 L${mid + 6} 7 L${mid} 13 L${mid - 6} 7 Z`} fill={color} />
      <Circle cx={mid - 11} cy={7} r={1.6} fill={color} />
      <Circle cx={mid + 11} cy={7} r={1.6} fill={color} />
    </Svg>
  );
}

/** 帶羅馬數字的段落標題，例如「I · 談話對象」 */
export function SectionTitle({ mark, title, sub }: { mark: string; title: string; sub?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.mark}>{mark}</Text>
      <Text style={styles.title}>{title}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      <Divider width={140} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { alignItems: 'center', gap: 2, marginBottom: 14 },
  mark: { ...type.numeral, color: colors.goldDeep, letterSpacing: 2 },
  title: { ...type.title, color: colors.plum, letterSpacing: 4 },
  sub: { ...type.callout, color: colors.inkSoft, marginBottom: 6, letterSpacing: 1, textAlign: 'center' },
});
