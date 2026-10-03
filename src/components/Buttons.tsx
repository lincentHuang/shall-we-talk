import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '../lib/feedback';
import { colors, fonts, shadow } from '../theme';

const APressable = Animated.createAnimatedComponent(Pressable);

function usePressScale(to = 0.96) {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return {
    style,
    onPressIn: () => {
      s.set(withSpring(to, { damping: 18, stiffness: 400 }));
    },
    onPressOut: () => {
      s.set(withSpring(1, { damping: 12, stiffness: 300 }));
    },
  };
}

type Props = {
  label: string;
  onPress: () => void;
  sub?: string;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

/** 主要按鈕：紫色漸層＋金邊 */
export function PrimaryButton({ label, sub, onPress, icon, style, disabled }: Props) {
  const press = usePressScale();
  return (
    <APressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.primaryOuter, shadow(10, 0.28), press.style, disabled && { opacity: 0.5 }, style]}
    >
      <LinearGradient
        colors={['#E8CF94', '#C9A25A', '#E8CF94']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryBorder}
      >
        <LinearGradient colors={['#8F7BBE', '#6B5899']} style={styles.primaryInner}>
          {icon}
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.primaryLabel}>{label}</Text>
            {sub ? <Text style={styles.primarySub}>{sub}</Text> : null}
          </View>
        </LinearGradient>
      </LinearGradient>
    </APressable>
  );
}

/** 次要按鈕：羊皮紙底＋金色細框 */
export function GhostButton({ label, onPress, icon, style, disabled }: Props) {
  const press = usePressScale();
  return (
    <APressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        haptic.tick();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.ghost, press.style, disabled && { opacity: 0.45 }, style]}
    >
      {icon}
      <Text style={styles.ghostLabel}>{label}</Text>
    </APressable>
  );
}

/** 圓形圖示按鈕 */
export function IconButton({
  children,
  onPress,
  label,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const press = usePressScale(0.9);
  return (
    <APressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        haptic.tick();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.icon, press.style, style]}
    >
      {children}
    </APressable>
  );
}

const styles = StyleSheet.create({
  primaryOuter: { borderRadius: 999 },
  primaryBorder: { borderRadius: 999, padding: 1.6 },
  primaryInner: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryLabel: { fontFamily: fonts.serifBold, color: '#FFF8EA', fontSize: 17, letterSpacing: 4 },
  primarySub: { fontFamily: fonts.display, color: '#F1E2BC', fontSize: 13, letterSpacing: 1.5, marginTop: -1 },
  ghost: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(251,241,223,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ghostLabel: { fontFamily: fonts.serif, color: colors.plum, fontSize: 14.5, letterSpacing: 2 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(201,162,90,0.7)',
    backgroundColor: 'rgba(251,241,223,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
