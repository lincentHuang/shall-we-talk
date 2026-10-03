import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { noise } from '../lib/noise';
import { colors } from '../theme';

/** 四角星（卡背上那種閃光） */
export function Sparkle({ size = 12, color = colors.gold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill={color} />
    </Svg>
  );
}

function Twinkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const v = useSharedValue(0.25);
  useEffect(() => {
    v.set(withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true),
    ));
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({
    opacity: v.value * 0.75,
    transform: [{ scale: 0.6 + v.value * 0.5 }, { rotate: `${v.value * 20}deg` }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, style]}>
      <Sparkle size={size} color={colors.gold} />
    </Animated.View>
  );
}

/** 新藝術風的角落藤蔓 */
function Corner({ flipX, flipY }: { flipX?: boolean; flipY?: boolean }) {
  return (
    <View
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        [flipY ? 'bottom' : 'top']: 0,
        [flipX ? 'right' : 'left']: 0,
        transform: [{ scaleX: flipX ? -1 : 1 }, { scaleY: flipY ? -1 : 1 }],
        opacity: 0.55,
      }}
    >
      <Svg width={120} height={120} viewBox="0 0 120 120">
        <Path d="M6 116 V30 Q6 6 30 6 H116" stroke={colors.gold} strokeWidth={1.4} fill="none" />
        <Path d="M14 116 V36 Q14 14 36 14 H116" stroke={colors.gold} strokeWidth={0.7} fill="none" />
        <Path
          d="M22 70 Q22 22 70 22 M30 52 Q40 40 52 30 M28 40 C34 34 30 26 22 28 C24 34 22 38 28 40 Z M40 28 C46 22 42 14 34 16 C36 22 34 26 40 28 Z"
          stroke={colors.gold}
          strokeWidth={1}
          fill="none"
        />
        <Path d="M30 30 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0" fill={colors.gold} />
      </Svg>
    </View>
  );
}

export function Backdrop({ corners = true }: { corners?: boolean }) {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => {
    // 固定的偽亂數，避免每次 render 星星位置跳動
    return Array.from({ length: 14 }, (_, i) => ({
      x: noise(i, 11) * (width - 20),
      y: noise(i, 12) * (height - 20),
      size: 6 + noise(i, 13) * 10,
      delay: i * 260,
    }));
  }, [width, height]);

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <LinearGradient
        colors={[colors.bgTop, '#F4ECF6', colors.bgBottom]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(169,227,220,0.35)', 'rgba(169,227,220,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {stars.map((s, i) => (
        <Twinkle key={i} {...s} />
      ))}
      {corners && (
        <>
          <Corner />
          <Corner flipX />
          <Corner flipY />
          <Corner flipX flipY />
        </>
      )}
    </View>
  );
}
