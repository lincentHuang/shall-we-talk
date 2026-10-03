import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic, playSound } from '../lib/feedback';
import { noise } from '../lib/noise';
import { shadow } from '../theme';
import { CardBack, cardHeight } from './Card';

/**
 * 鴿尾式洗牌（riffle shuffle）動畫，共兩輪：
 * 牌堆從桌面升起 → 切成左右兩半 → 一張張交錯落回 → 敲齊 → 再一次 → 放回桌面
 */
const TL = {
  rise: [0, 0.34],
  split1: [0.34, 0.62],
  riffle1: [0.62, 1.22],
  square1: [1.22, 1.4],
  split2: [1.4, 1.66],
  riffle2: [1.66, 2.26],
  square2: [2.26, 2.44],
  ret: [2.44, 2.82],
} as const;
const TOTAL = TL.ret[1];
const DROP = 0.17; // 每張牌落下所需時間（秒）

function seg(t: number, a: number, b: number) {
  'worklet';
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}
function ease(p: number) {
  'worklet';
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

type Geo = {
  /** 洗牌時每張牌的寬度 */
  w: number;
  /** 牌桌上牌堆中心相對於洗牌中心的位移 */
  deckDX: number;
  deckDY: number;
  /** 牌堆中的牌寬 / 洗牌時的牌寬 */
  deckScale: number;
};

/** 切牌：牌往左右分開，內側邊緣被拇指微微抬起 → [x, y, rotZ, rotY] */
function splitPose(v: number, a: number, b: number, side: number, spread: number, jitter: number) {
  'worklet';
  const p = ease(seg(v, a, b));
  return [side * spread * p, -10 * Math.sin(Math.PI * p), side * 8 * p + jitter * (1 - p), -side * 24 * p];
}

/** 交錯落牌：底下的牌先落，越上面的越晚 → [x, y, rotZ, rotY] */
function rifflePose(v: number, a: number, b: number, i: number, n: number, side: number, spread: number, jitter: number) {
  'worklet';
  const start = a + (i / Math.max(1, n - 1)) * (b - a - DROP);
  const q = ease(seg(v, start, start + DROP));
  return [side * spread * (1 - q), -7 * Math.sin(Math.PI * q), side * 8 * (1 - q) + jitter * q, -side * 24 * (1 - q)];
}

function ShuffleCard({ i, n, t, geo, jitter }: { i: number; n: number; t: SharedValue<number>; geo: Geo; jitter: number }) {
  const style = useAnimatedStyle(() => {
    const v = t.value;
    const side = i % 2 === 0 ? -1 : 1;
    const spread = geo.w * 0.56;

    // 升起 / 放回
    const up = ease(seg(v, TL.rise[0], TL.rise[1])) * (1 - ease(seg(v, TL.ret[0], TL.ret[1])));

    let pose = [0, 0, jitter, 0];
    if (v < TL.split1[1]) pose = splitPose(v, TL.split1[0], TL.split1[1], side, spread, jitter);
    else if (v < TL.riffle1[1]) pose = rifflePose(v, TL.riffle1[0], TL.riffle1[1], i, n, side, spread, jitter);
    else if (v >= TL.split2[0] && v < TL.split2[1]) pose = splitPose(v, TL.split2[0], TL.split2[1], side, spread, jitter);
    else if (v >= TL.split2[1] && v < TL.riffle2[1])
      pose = rifflePose(v, TL.riffle2[0], TL.riffle2[1], i, n, side, spread, jitter);

    // 敲齊時整疊輕輕一震
    const tap =
      Math.sin(Math.PI * seg(v, TL.square1[0], TL.square1[1])) + Math.sin(Math.PI * seg(v, TL.square2[0], TL.square2[1]));

    const scale = (geo.deckScale + (1 - geo.deckScale) * up) * (1 + 0.035 * tap);
    // 疊起來的厚度：桌上時跟牌堆一致，升起時稍微明顯一點
    const thickness = i * (1.4 * (1 - up) + 0.9 * up);
    return {
      transform: [
        { perspective: 900 },
        { translateX: geo.deckDX * (1 - up) + pose[0] },
        { translateY: geo.deckDY * (1 - up) + pose[1] - thickness },
        { rotateZ: `${pose[2]}deg` },
        { rotateY: `${pose[3]}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, style]}>
      <CardBack width={geo.w} style={shadow(4, 0.18)} />
    </Animated.View>
  );
}

export function ShuffleLayer({
  count,
  geo,
  center,
  onDone,
}: {
  count: number;
  geo: Geo;
  center: { x: number; y: number };
  onDone: () => void;
}) {
  const t = useSharedValue(0);
  const n = Math.max(4, Math.min(count, 10));
  const jitters = useMemo(() => Array.from({ length: n }, (_, i) => (noise(i, 7) - 0.5) * 3), [n]);

  useEffect(() => {
    t.set(0);
    t.set(withTiming(TOTAL, { duration: TOTAL * 1000, easing: Easing.linear }, (fin) => {
      if (fin) scheduleOnRN(onDone);
    }));

    // 音效與觸覺節奏跟著兩輪洗牌走
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (sec: number, fn: () => void) => timers.push(setTimeout(fn, sec * 1000));
    at(TL.split1[0], () => playSound('shuffle', 0.9));
    for (const [a, b] of [TL.riffle1, TL.riffle2]) {
      for (let k = 0; k < 6; k++) at(a + ((b - a) * k) / 6, haptic.tick);
    }
    at(TL.square1[0], haptic.light);
    at(TL.square2[0], haptic.medium);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const h = cardHeight(geo.w);
  return (
    <View
      style={{ pointerEvents: 'none', position: 'absolute', left: center.x - geo.w / 2, top: center.y - h / 2, width: geo.w, height: h }}
    >
      {jitters.map((j, i) => (
        <ShuffleCard key={i} i={i} n={n} t={t} geo={geo} jitter={j} />
      ))}
    </View>
  );
}
