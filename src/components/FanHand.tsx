import { memo, useEffect, useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, shadow, type } from '../theme';
import { CardBack, cardHeight, cardRadius } from './Card';
import { Text } from './Text';

/** 牌桌的手勢模式（在 UI 執行緒讀取）：0 鎖定、1 手牌攤開可挑牌、2 已翻開一張（手牌收在下方） */
export const LOCKED = 0;
export const CHOOSING = 1;
export const REVEALED = 2;

/** 手牌最多同時攤開幾張；其餘留在後面，抽走一張就補一張，讓題目深度維持由淺入深 */
export const FAN_MAX = 9;
const MAX_SPAN = 48; // 整把扇形最大張開角度（度）
const MAX_STEP = 10; // 相鄰兩張最多差幾度，牌少時不要散太開
const PULL_START = 24; // 手指往上移超過這個距離，就從「挑牌」變成「把牌拉出來」

export type FanGeo = {
  /** 容器尺寸 */
  w: number;
  h: number;
  /** 手牌每張的寬高 */
  fw: number;
  fh: number;
  /** 扇形圓心（在容器座標）與半徑（圓心到牌中心） */
  pivotX: number;
  pivotY: number;
  R: number;
  /** 被挑中的牌浮起多少 */
  lift: number;
  /** 正中間那張（未浮起時）的上緣 */
  cardTop: number;
};

export function fanGeometry(tableW: number, tableH: number): FanGeo {
  // 寬度要留給最兩側那張浮起來時不被螢幕切掉
  const fw = Math.round(Math.min(tableW * 0.27, 150, tableH * 0.2));
  const fh = cardHeight(fw);
  const R = Math.round(fw * 2.15);
  const lift = Math.round(fh * 0.2);
  const half = ((MAX_SPAN / 2) * Math.PI) / 180;
  // 兩側的牌轉開後會比中間低一些
  const drop = R * (1 - Math.cos(half)) + (fw / 2) * Math.sin(half);
  const cardTop = 6 + lift;
  return {
    w: tableW,
    h: Math.round(cardTop + fh + drop + 6),
    fw,
    fh,
    pivotX: tableW / 2,
    pivotY: cardTop + fh / 2 + R,
    R,
    lift,
    cardTop,
  };
}

export function fanStep(n: number) {
  'worklet';
  return n <= 1 ? 0 : Math.min(MAX_STEP, MAX_SPAN / (n - 1));
}

/** 第 j 張的角度（度），0 為正上方、往右為正 */
export function fanAngle(j: number, n: number) {
  'worklet';
  return (j - (n - 1) / 2) * fanStep(n);
}

/** 第 j 張沿自身方向往外推 radial 後的中心點與角度（容器座標） */
export function fanCardPose(geo: FanGeo, j: number, n: number, radial: number) {
  const rot = fanAngle(j, n);
  const rad = (rot * Math.PI) / 180;
  const r = geo.R + radial;
  return { x: geo.pivotX + r * Math.sin(rad), y: geo.pivotY - r * Math.cos(rad), rot };
}

/* ---------- 單張手牌 ---------- */

type CardProps = {
  j: number;
  n: number;
  geo: FanGeo;
  sel: SharedValue<number>;
  pull: SharedValue<number>;
  spread: SharedValue<number>;
};

const FanCard = memo(function FanCard({ j, n, geo, sel, pull, spread }: CardProps) {
  const target = fanAngle(j, n);
  const angle = useSharedValue(target);
  const lift = useSharedValue(0);
  const enter = useSharedValue(0);

  // 前面的牌被抽走時，其餘的牌滑過去補位
  useEffect(() => {
    angle.set(withSpring(target, { damping: 18, stiffness: 190 }));
  }, [angle, target]);

  // 新補進手牌的牌從下方滑上來
  useEffect(() => {
    enter.set(withDelay(160, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })));
  }, [enter]);

  // 被挑中的牌浮起，左右鄰居也跟著微微抬一點
  useAnimatedReaction(
    () => (sel.value < 0 ? 99 : Math.abs(sel.value - j)),
    (d) => {
      lift.set(withSpring(d === 0 ? 1 : d === 1 ? 0.16 : 0, { damping: 15, stiffness: 340 }));
    },
  );

  const style = useAnimatedStyle(() => {
    const l = lift.value;
    const picked = sel.value === j;
    const radial = l * geo.lift + (picked ? pull.value : 0) - (1 - enter.value) * geo.fh * 0.5;
    return {
      opacity: enter.value,
      zIndex: picked ? 50 : j,
      transform: [
        { translateY: geo.R },
        { rotate: `${angle.value * spread.value}deg` },
        { translateY: -geo.R - radial },
        { scale: 1 + 0.06 * l },
      ],
    };
  });
  const glow = useAnimatedStyle(() => ({ opacity: lift.value > 0.5 ? (lift.value - 0.5) * 2 : 0 }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: geo.pivotX - geo.fw / 2,
          top: geo.cardTop,
          width: geo.fw,
          height: geo.fh,
          pointerEvents: 'none',
        },
        style,
      ]}
    >
      <CardBack width={geo.fw} style={shadow(5, 0.22)} />
      <Animated.View style={[styles.glow, { borderRadius: cardRadius(geo.fw) }, glow]} />
    </Animated.View>
  );
});

/* ---------- 整把手牌 ---------- */

type Props = {
  /** 攤開的牌（由左到右），只用來當 key */
  ids: string[];
  geo: FanGeo;
  mode: SharedValue<number>;
  /** 目前挑中的位置，-1 表示沒有 */
  sel: SharedValue<number>;
  /** 挑中的牌被手指往外拉了多少 */
  pull: SharedValue<number>;
  /** 0 疊成一疊 → 1 完全攤開 */
  spread: SharedValue<number>;
  /** 牌堆剩幾張（含還沒攤開的） */
  remaining: number;
  /** 給螢幕閱讀器：目前挑中的位置 */
  selected: number;
  onSelect: (j: number) => void;
  onDraw: (j: number, pulled: number) => void;
  /** 手牌收在下方時被點了一下 */
  onTapResting: () => void;
  onStep: (delta: number) => void;
};

export function FanHand({
  ids,
  geo,
  mode,
  sel,
  pull,
  spread,
  remaining,
  selected,
  onSelect,
  onDraw,
  onTapResting,
  onStep,
}: Props) {
  const n = ids.length;
  const tracking = useSharedValue(0); // 0 沒在追蹤、1 挑牌中、2 手牌收著時的點擊
  const prev = useSharedValue(-1);
  const pulling = useSharedValue(0);
  const anchorY = useSharedValue(0);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const moved = useSharedValue(0);
  const vy = useSharedValue(0);

  const gesture = useMemo(() => {
    /** 依手指相對扇形圓心的角度找出指到哪一張；帶一點遲滯，避免在兩張交界抖動 */
    const pickAt = (x: number, y: number, cur: number) => {
      'worklet';
      if (n === 0) return -1;
      const st = fanStep(n);
      if (st === 0) return 0;
      const a = (Math.atan2(x - geo.pivotX, geo.pivotY - y) * 180) / Math.PI;
      const f = a / st + (n - 1) / 2;
      if (cur >= 0 && cur < n && Math.abs(f - cur) < 0.62) return cur;
      return Math.max(0, Math.min(n - 1, Math.round(f)));
    };
    const choose = (j: number) => {
      'worklet';
      if (j === sel.value) return;
      sel.set(j);
      scheduleOnRN(onSelect, j);
    };

    const pan = Gesture.Pan()
      .minDistance(0)
      .onBegin((e) => {
        moved.set(0);
        ox.set(e.x);
        oy.set(e.y);
        vy.set(0);
        pulling.set(0);
        if (mode.value === CHOOSING) {
          tracking.set(1);
          prev.set(sel.value);
          anchorY.set(e.y);
          choose(pickAt(e.x, e.y, sel.value));
        } else {
          tracking.set(mode.value === REVEALED ? 2 : 0);
        }
      })
      .onUpdate((e) => {
        moved.set(Math.max(moved.value, Math.hypot(e.x - ox.value, e.y - oy.value)));
        vy.set(e.velocityY);
        if (tracking.value !== 1 || mode.value !== CHOOSING) return;
        if (pulling.value) {
          pull.set(Math.max(0, anchorY.value - e.y - PULL_START / 2));
          return;
        }
        const j = pickAt(e.x, e.y, sel.value);
        if (j !== sel.value) {
          // 換了一張：重新計算往上拉的起點
          anchorY.set(e.y);
          pull.set(0);
          choose(j);
          return;
        }
        if (e.y > anchorY.value) anchorY.set(e.y);
        const up = anchorY.value - e.y;
        if (up > PULL_START) {
          pulling.set(1);
          pull.set(up - PULL_START / 2);
        } else {
          pull.set(up / 2);
        }
      })
      .onFinalize(() => {
        const t = tracking.value;
        tracking.set(0);
        if (t === 2) {
          if (moved.value < 10 && mode.value === REVEALED) scheduleOnRN(onTapResting);
          return;
        }
        if (t !== 1 || mode.value !== CHOOSING) return;
        const j = sel.value;
        if (pulling.value && j >= 0 && (pull.value > geo.fh * 0.28 || vy.value < -500)) {
          scheduleOnRN(onDraw, j, pull.value);
          return;
        }
        pulling.set(0);
        pull.set(withSpring(0, { damping: 14, stiffness: 260 }));
        // 點一下：第一次是挑起來，再點同一張才抽
        if (moved.value < 10 && j >= 0 && prev.value === j) scheduleOnRN(onDraw, j, 0);
      });

    // 滑鼠／觸控筆懸停時就先把牌挑起來，點一下即抽
    const hoverAt = (x: number, y: number) => {
      'worklet';
      if (mode.value !== CHOOSING || tracking.value) return;
      choose(pickAt(x, y, sel.value));
    };
    const hover = Gesture.Hover()
      .onBegin((e) => hoverAt(e.x, e.y))
      .onUpdate((e) => hoverAt(e.x, e.y));

    return Gesture.Simultaneous(pan, hover);
  }, [anchorY, geo, mode, moved, n, onDraw, onSelect, onTapResting, ox, oy, prev, pull, pulling, sel, tracking, vy]);

  // 剩餘張數標在最右邊那張的右上角
  const badge = useMemo(() => {
    if (!n) return null;
    const c = fanCardPose(geo, n - 1, n, 0);
    const a = (c.rot * Math.PI) / 180;
    const dx = geo.fw / 2;
    const dy = -geo.fh / 2;
    const x = c.x + dx * Math.cos(a) - dy * Math.sin(a);
    return { x: Math.min(x, geo.w - 18), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
  }, [geo, n]);
  const badgeStyle = useAnimatedStyle(() => ({ opacity: spread.value }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`手牌，攤開 ${n} 張`}
        accessibilityHint="上下滑動挑牌，點兩下抽出"
        accessibilityValue={{ text: selected >= 0 ? `第 ${selected + 1} 張` : '還沒挑' }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onStep(1);
          else if (e.nativeEvent.actionName === 'decrement') onStep(-1);
          else if (selected >= 0) onDraw(selected, 0);
        }}
        style={[{ width: geo.w, height: geo.h }, Platform.OS === 'web' && { cursor: 'pointer' }]}
      >
        {ids.map((id, j) => (
          <FanCard key={id} j={j} n={n} geo={geo} sel={sel} pull={pull} spread={spread} />
        ))}
        {badge && remaining > 0 && (
          <Animated.View style={[styles.badge, { left: badge.x - 15, top: badge.y - 15 }, badgeStyle]}>
            <Text style={styles.badgeText}>{remaining}</Text>
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: colors.goldLight,
    boxShadow: `0px 0px 14px rgba(232,207,148,0.9)`,
  },
  badge: {
    position: 'absolute',
    minWidth: 30,
    height: 30,
    paddingHorizontal: 7,
    borderRadius: 15,
    backgroundColor: colors.parchment,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    pointerEvents: 'none',
    ...shadow(3, 0.2),
  },
  badgeText: { ...type.script, color: colors.plum, marginTop: -2 },
});
