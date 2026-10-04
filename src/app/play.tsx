import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Backdrop, Sparkle } from '../components/Backdrop';
import { GhostButton, IconButton, PrimaryButton } from '../components/Buttons';
import { CardBack, CardFace, cardHeight, cardRadius } from '../components/Card';
import {
  CHOOSING,
  FAN_MAX,
  FanHand,
  fanCardPose,
  fanGeometry,
  LOCKED,
  REVEALED,
} from '../components/FanHand';
import { BackIcon, HeartIcon, InfoIcon, NextIcon, RedrawIcon, ShuffleIcon, SoundIcon } from '../components/Icons';
import { Divider } from '../components/Ornament';
import { Sheet } from '../components/Sheet';
import { ShuffleLayer } from '../components/ShuffleLayer';
import { SCENES, STAGES } from '../data/catalog';
import { CLOSING, crowdOf, FOLLOW_UPS, followUpTip, OPENING } from '../data/guide';
import {
  buildDeck,
  moveCard,
  playerLabels,
  reshuffleRange,
  settingsFromParams,
  stageSpans,
  type DeckCard,
} from '../lib/deck';
import { haptic, playSound, setMuted, useMuted, warmUpSounds } from '../lib/feedback';
import { noise } from '../lib/noise';
import { toggleFavorite, useFavorites } from '../lib/storage';
import { CARD_RATIO, colors, fonts, shadow } from '../theme';

/**
 * 一局的流程：opening 開場白 → shuffling 洗牌 → ready 挑牌 → drawing 抽出 → revealed 回答
 * → discarding 收走 →（同一層）ready ／（換層）stage 下一層介紹 → … → done 收尾分享
 */
type Phase = 'opening' | 'shuffling' | 'ready' | 'drawing' | 'revealed' | 'discarding' | 'stage' | 'done';
type SheetName = 'rules' | 'opening' | 'leave' | 'stages' | 'pass' | 'tips' | 'recap';
/** 聊過的牌；skipped 表示被「換一張」換掉 */
type LogEntry = { card: DeckCard; skipped: boolean };

const RULES_KEY = 'buhui.rules.seen.v2';

const RULES: [string, string, string][] = [
  ['I', '開場', '一個人念出開場白，大家放下手機、安靜下來。'],
  ['II', '抽牌', '牌分成暖身、淺談、走心、深談幾層，由淺入深，一層聊完再往下。'],
  ['III', '回答', '輪到的人回答。不想答可以「換一張」，也可以「請別人答」。'],
  ['IV', '接話', '其他人可以追問、回饋、鼓勵。一句「然後呢？」常常比給建議更好。'],
  ['V', '收尾', '最後每個人說說今天的感受。喜歡的題目按 ♡ 收藏。'],
];

/* ---------- 翻牌瞬間的金色星芒 ---------- */

function BurstStar({ v, a, d, s, r }: { v: SharedValue<number>; a: number; d: number; s: number; r: number }) {
  const style = useAnimatedStyle(() => {
    const p = v.value;
    const rad = r * (0.5 + 0.65 * d * p);
    return {
      opacity: p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p),
      transform: [
        { translateX: Math.cos(a) * rad },
        { translateY: Math.sin(a) * rad * 1.35 },
        { scale: 0.3 + p * 0.9 },
        { rotate: `${p * 120}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: -s / 2, top: -s / 2, pointerEvents: 'none' }, style]}>
      <Sparkle size={s} color={colors.goldLight} />
    </Animated.View>
  );
}

function Burst({ v, x, y, r }: { v: SharedValue<number>; x: number; y: number; r: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        a: (i / 14) * Math.PI * 2 + noise(i, 1) * 0.3,
        d: 0.6 + noise(i, 2) * 0.6,
        s: 8 + noise(i, 3) * 12,
      })),
    [],
  );
  return (
    <View style={{ position: 'absolute', left: x, top: y, zIndex: 30, pointerEvents: 'none' }}>
      {stars.map((st, i) => (
        <BurstStar key={i} v={v} r={r} {...st} />
      ))}
    </View>
  );
}

/* ---------- 畫面 ---------- */

export default function Play() {
  const params = useLocalSearchParams();
  // 只在進入時讀一次設定
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const settings = useMemo(() => settingsFromParams(params), []);
  const scene = SCENES.find((x) => x.id === settings.scene) ?? SCENES[0];
  const players = useMemo(() => playerLabels(settings), [settings]);
  const crowd = crowdOf(players.length);
  const solo = crowd === 'self';

  const { width: winW, height: winH } = useWindowDimensions();
  const colW = Math.min(winW, 560);

  const [deck, setDeck] = useState(() => buildDeck(settings));
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('opening');
  const [shuffleId, setShuffleId] = useState(0);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [table, setTable] = useState<{ w: number; h: number } | null>(null);
  /** 手牌目前挑中第幾張（-1 沒挑），UI 執行緒上的版本是 sel */
  const [selIdx, setSelIdx] = useState(-1);
  /** 第幾輪抽牌（一直往上加，取餘數就是輪到哪一位） */
  const [turn, setTurn] = useState(0);
  /** 這張牌改請誰代答（玩家編號），null 表示由抽牌的人回答 */
  const [proxy, setProxy] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const favorites = useFavorites();
  const muted = useMuted();

  useEffect(warmUpSounds, []);

  // 第一次玩先看玩法，之後每一局都從開場白開始
  useEffect(() => {
    AsyncStorage.getItem(RULES_KEY)
      .then((v) => {
        if (!v) AsyncStorage.setItem(RULES_KEY, '1').catch(() => {});
        setSheet(v ? 'opening' : 'rules');
      })
      .catch(() => setSheet('opening'));
  }, []);

  /* ---------- 版面：上方翻牌區、下方扇形手牌 ---------- */

  const geo = useMemo(() => {
    if (!table) return null;
    const bottomPad = 12;
    const gap = 22;
    const fan = fanGeometry(table.w, table.h);
    // 挑牌時手牌貼齊桌面底部；翻開一張後縮小往下收，把空間讓給大牌
    const fanTop = table.h - bottomPad - fan.h;
    const restScale = 0.8;
    const restDY = (fan.h * (1 - restScale)) / 2;
    const restCardTop = fanTop + fan.h / 2 + (fan.cardTop - fan.h / 2) * restScale + restDY;
    const fit = (restCardTop - gap - 4) / CARD_RATIO;
    const cardW = Math.floor(Math.min(table.w * 0.8, 400, fit));
    const cardH = cardHeight(cardW);
    const slotTop = Math.max(4, (restCardTop - gap - cardH) * 0.4);
    return {
      cardW,
      cardH,
      fan,
      fanTop,
      restScale,
      restDY,
      slot: { x: table.w / 2, y: slotTop + cardH / 2 },
      slotTop,
    };
  }, [table]);

  /* ---------- 目前在哪一層 ---------- */

  const spans = useMemo(() => stageSpans(deck), [deck]);
  const spanIdx = Math.max(0, spans.findIndex((sp) => pos >= sp.start && pos < sp.end));
  const span = spans[spanIdx] ?? { stage: 0 as const, start: 0, end: deck.length };
  const nextSpan = spans[spanIdx + 1];
  const stage = STAGES[span.stage];
  const stageSize = span.end - span.start;

  const done = phase === 'done';
  const onDeck = phase === 'opening' || phase === 'shuffling' || phase === 'ready' || phase === 'stage';
  const drawnInStage = pos - span.start + (onDeck ? 0 : 1);
  const remaining = done ? 0 : span.end - pos - (onDeck ? 0 : 1);
  const card = deck[Math.min(pos, deck.length - 1)];

  // 攤開在手上的只有這一層的牌：挑牌時從 pos 開始，抽出一張後從下一張開始
  const fanStart = pos + (onDeck ? 0 : 1);
  const fanIds = useMemo(
    () => (done ? [] : deck.slice(fanStart, Math.min(fanStart + FAN_MAX, span.end)).map((q) => q.id)),
    [deck, done, fanStart, span.end],
  );

  /* ---------- 輪到誰 ---------- */

  const drawer = players.length ? turn % players.length : 0;
  const answerer = proxy ?? drawer;

  /* ---------- 動畫狀態 ---------- */

  const mode = useSharedValue(LOCKED);
  const progress = useSharedValue(0); // 0 在手牌裡 → 1 在翻牌區
  const fromX = useSharedValue(0); // 被抽出那張在手牌裡的位置（相對翻牌區）
  const fromY = useSharedValue(0);
  const fromRot = useSharedValue(0);
  const fromScale = useSharedValue(0.36);
  const flip = useSharedValue(0); // 0 背面 → 1 正面
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const outX = useSharedValue(0);
  const outY = useSharedValue(0);
  const outRot = useSharedValue(0);
  const away = useSharedValue(0); // 換一張：牌縮小淡出收回去
  const hold = useSharedValue(0);
  const burst = useSharedValue(0);
  const shine = useSharedValue(0);
  const sel = useSharedValue(-1);
  const pull = useSharedValue(0);
  const spread = useSharedValue(0); // 0 疊成一疊 → 1 攤開
  const fanUp = useSharedValue(1); // 1 挑牌姿勢 → 0 收在下方

  const onRevealed = useCallback(() => {
    setPhase('revealed');
    mode.set(REVEALED);
    haptic.medium();
    burst.set(0);
    burst.set(withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }));
    shine.set(0);
    shine.set(withDelay(60, withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) })));
  }, [burst, mode, shine]);

  /** 把手牌第 j 張抽出來：從它在扇形裡的位置飛到翻牌區並翻面 */
  const pickCard = useCallback(
    (j: number, pulled: number) => {
      if (!geo || j < 0 || j >= fanIds.length) return;
      mode.set(LOCKED);
      const pose = fanCardPose(geo.fan, j, fanIds.length, geo.fan.lift + pulled);
      fromX.set(pose.x - geo.slot.x);
      fromY.set(geo.fanTop + pose.y - geo.slot.y);
      fromRot.set(pose.rot);
      fromScale.set((geo.fan.fw * 1.06) / geo.cardW);
      progress.set(0);
      flip.set(0);
      sel.set(-1);
      pull.set(0);
      setSelIdx(-1);
      setDeck((d) => moveCard(d, pos + j, pos));
      setPhase('drawing');
      playSound('flip', 0.9);
      haptic.light();
      fanUp.set(withTiming(0, { duration: 560, easing: Easing.inOut(Easing.cubic) }));
      progress.set(withTiming(1, { duration: 700, easing: Easing.bezier(0.2, 0.9, 0.25, 1) }));
      flip.set(withDelay(
        110,
        withTiming(1, { duration: 580, easing: Easing.inOut(Easing.cubic) }, (fin) => {
          if (fin) scheduleOnRN(onRevealed);
        }),
      ));
    },
    [fanIds.length, fanUp, flip, fromRot, fromScale, fromX, fromY, geo, mode, onRevealed, pos, progress, pull, sel],
  );

  const drawAt = useCallback(
    (j: number, pulled: number) => {
      if (mode.get() === CHOOSING) pickCard(j, pulled);
    },
    [mode, pickCard],
  );

  const onSelect = useCallback((j: number) => {
    setSelIdx(j);
    haptic.tick();
  }, []);

  /** 鍵盤／螢幕閱讀器：左右移動挑中的牌 */
  const stepSel = useCallback(
    (delta: number) => {
      const n = fanIds.length;
      if (mode.get() !== CHOOSING || !n) return;
      const s = sel.get();
      const j = s < 0 ? Math.floor((n - 1) / 2) : Math.max(0, Math.min(n - 1, s + delta));
      if (j === s) return;
      sel.set(j);
      onSelect(j);
    },
    [fanIds.length, mode, onSelect, sel],
  );

  /** 按鈕／鍵盤：抽挑中的那張；還沒挑就隨機挑一張，先讓它浮起來再抽 */
  const drawSelected = useCallback(() => {
    const n = fanIds.length;
    if (mode.get() !== CHOOSING || !n) return;
    const s = sel.get();
    if (s >= 0) return pickCard(s, 0);
    const j = Math.floor(Math.random() * n);
    mode.set(LOCKED);
    sel.set(j);
    onSelect(j);
    setTimeout(() => pickCard(j, 0), 420);
  }, [fanIds.length, mode, onSelect, pickCard, sel]);

  const onDiscarded = useCallback(
    (next: number, skipped: boolean, newStage: boolean) => {
      // 換一張不算回答過，還是同一個人
      if (!skipped) setTurn((t) => t + 1);
      setProxy(null);
      if (next >= deck.length) {
        setPhase('done');
        haptic.medium();
        return;
      }
      // 牌飛出畫面後藏起來，等下一次從手牌抽出時再用
      progress.set(0);
      flip.set(0);
      dragX.set(0);
      dragY.set(0);
      outX.set(0);
      outY.set(0);
      outRot.set(0);
      away.set(0);
      setPos(next);
      if (newStage) {
        // 這一層抽完了：先介紹下一層，按下「進入」才攤開
        setPhase('stage');
        haptic.light();
        return;
      }
      setPhase('ready');
      mode.set(CHOOSING);
    },
    [away, deck.length, dragX, dragY, flip, mode, outRot, outX, outY, progress],
  );

  /** 收走翻開的牌：skipped 為「換一張」（牌收回去），否則往左右滑走 */
  const discard = useCallback(
    (dir: number, skipped = false) => {
      if (mode.get() !== REVEALED || !geo || !card) return;
      mode.set(LOCKED);
      setPhase('discarding');
      setLog((l) => [...l, { card, skipped }]);
      playSound('swish', 0.7);
      haptic.soft();
      const next = pos + 1;
      const newStage = next < deck.length && deck[next].stage !== card.stage;
      const cfg = { duration: 360, easing: Easing.in(Easing.quad) };
      if (skipped) {
        away.set(withTiming(1, cfg, (fin) => {
          if (fin) scheduleOnRN(onDiscarded, next, skipped, newStage);
        }));
      } else {
        outX.set(withTiming(dir * (winW * 0.7 + geo.cardW), cfg, (fin) => {
          if (fin) scheduleOnRN(onDiscarded, next, skipped, newStage);
        }));
        outY.set(withTiming(-40, cfg));
        outRot.set(withTiming(dir * 24, cfg));
      }
      // 下一層的牌先疊成一疊收在下方，等介紹完再抬起來攤開
      if (newStage) spread.set(0);
      // 同一層：手牌同時抬回挑牌的位置
      else if (next < deck.length) {
        fanUp.set(withDelay(120, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })));
      }
    },
    [away, card, deck, fanUp, geo, mode, onDiscarded, outRot, outX, outY, pos, spread, winW],
  );

  /** 下一層：把疊好的牌攤開 */
  const enterStage = useCallback(() => {
    if (phase !== 'stage') return;
    setPhase('ready');
    playSound('swish', 0.35);
    haptic.light();
    fanUp.set(withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
    spread.set(withDelay(160, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }, (fin) => {
      if (fin) mode.set(CHOOSING);
    })));
  }, [fanUp, mode, phase, spread]);

  const next = useCallback(() => {
    if (phase === 'ready') drawSelected();
    else if (phase === 'revealed') discard(-1);
    else if (phase === 'stage') enterStage();
  }, [discard, drawSelected, enterStage, phase]);

  /** 挑牌時把手牌收攏成一疊，收好後執行 then */
  const gatherFan = useCallback(
    (then: () => void) => {
      mode.set(LOCKED);
      sel.set(-1);
      pull.set(0);
      setSelIdx(-1);
      spread.set(withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }, (fin) => {
        if (fin) scheduleOnRN(then);
      }));
    },
    [mode, pull, sel, spread],
  );

  /** 提早進入後面某一層（這一層剩下的牌就跳過） */
  const arriveAt = useCallback(
    (start: number) => {
      setPos(start);
      setPhase('stage');
      fanUp.set(withTiming(0, { duration: 420, easing: Easing.inOut(Easing.cubic) }));
    },
    [fanUp],
  );

  const jumpTo = useCallback(
    (start: number) => {
      setSheet(null);
      if (phase === 'stage') arriveAt(start);
      else if (phase === 'ready' && mode.get() === CHOOSING) gatherFan(() => arriveAt(start));
    },
    [arriveAt, gatherFan, mode, phase],
  );

  const toDone = useCallback(() => {
    setPhase('done');
    haptic.medium();
  }, []);

  /** 提早收尾 */
  const finishEarly = useCallback(() => {
    setSheet(null);
    if (phase === 'stage') toDone();
    else if (phase === 'ready' && mode.get() === CHOOSING) gatherFan(toDone);
  }, [gatherFan, mode, phase, toDone]);

  /** 請別人代答：兩個人直接交換，三人以上跳出名單 */
  const passAnswer = useCallback(() => {
    if (players.length === 2) {
      const other = (answerer + 1) % 2;
      setProxy(other === drawer ? null : other);
      haptic.tick();
    } else {
      setSheet('pass');
    }
  }, [answerer, drawer, players.length]);

  /* ---------- 開場與洗牌 ---------- */

  const beginGame = useCallback(() => {
    setSheet(null);
    setPhase((p) => (p === 'opening' ? 'shuffling' : p));
  }, []);

  const closeRules = useCallback(() => {
    setSheet(phase === 'opening' ? 'opening' : null);
  }, [phase]);

  const onShuffled = useCallback(() => {
    setPhase('ready');
    // 洗好的牌在手上攤開成扇形
    playSound('swish', 0.35);
    haptic.light();
    spread.set(withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }, (fin) => {
      if (fin) mode.set(CHOOSING);
    }));
  }, [mode, spread]);

  const startShuffle = useCallback(() => {
    setDeck((d) => reshuffleRange(d, pos, span.end));
    setShuffleId((k) => k + 1);
    setPhase('shuffling');
  }, [pos, span.end]);

  const reshuffle = useCallback(() => {
    if (phase !== 'ready' || mode.get() !== CHOOSING) return;
    // 先把手牌收攏成一疊，再開始洗
    gatherFan(startShuffle);
  }, [gatherFan, mode, phase, startShuffle]);

  const playAgain = useCallback(() => {
    progress.set(0);
    flip.set(0);
    outX.set(0);
    outY.set(0);
    outRot.set(0);
    away.set(0);
    dragX.set(0);
    dragY.set(0);
    sel.set(-1);
    pull.set(0);
    spread.set(0);
    fanUp.set(1);
    setSelIdx(-1);
    setSheet(null);
    setDeck(buildDeck(settings));
    setPos(0);
    setTurn(0);
    setProxy(null);
    setLog([]);
    setShuffleId((k) => k + 1);
    setPhase('shuffling');
  }, [away, dragX, dragY, fanUp, flip, outRot, outX, outY, progress, pull, sel, settings, spread]);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  /* ---------- 網頁鍵盤：←→ 挑牌，空白鍵／Enter／↑ 抽牌，翻開後空白鍵／Enter／→ 下一張，S 洗牌 ---------- */

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (sheet) return;
      if (phase === 'ready' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        stepSel(e.key === 'ArrowLeft' ? -1 : 1);
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        next();
      } else if (e.key === 's' || e.key === 'S') reshuffle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, phase, reshuffle, sheet, stepSel]);

  /* ---------- 手勢：翻開的牌左右滑走（挑牌的手勢在 FanHand 裡） ---------- */

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          if (mode.value === REVEALED) hold.set(withSpring(1, { damping: 15, stiffness: 260 }));
        })
        .onUpdate((e) => {
          if (mode.value !== REVEALED) return;
          dragX.set(e.translationX);
          dragY.set(e.translationY * 0.25);
        })
        .onEnd((e) => {
          if (mode.value !== REVEALED) return;
          if (Math.abs(e.translationX) > 90 || Math.abs(e.velocityX) > 650) {
            scheduleOnRN(discard, e.translationX > 0 ? 1 : -1);
          } else {
            dragX.set(withSpring(0, { damping: 14 }));
            dragY.set(withSpring(0, { damping: 14 }));
          }
        })
        .onFinalize(() => {
          hold.set(withSpring(0, { damping: 15, stiffness: 200 }));
        }),
    [discard, dragX, dragY, hold, mode],
  );

  /* ---------- 牌的姿態 ---------- */

  const fanStyle = useAnimatedStyle(() => {
    const u = fanUp.value;
    const s = geo?.restScale ?? 1;
    return {
      transform: [{ translateY: (1 - u) * (geo?.restDY ?? 0) }, { scale: s + (1 - s) * u }],
    };
  });

  const cardStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
    const s0 = fromScale.value;
    const w = away.value;
    const scale = (s0 + (1 - s0) * p) * (1 + 0.07 * hold.value + 0.06 * arc) * (1 - 0.45 * w);
    return {
      transform: [
        { perspective: 1400 },
        { translateX: fromX.value * (1 - p) + dragX.value + outX.value },
        { translateY: fromY.value * (1 - p) + dragY.value + outY.value - 34 * arc + w * (geo?.cardH ?? 400) * 0.7 },
        { rotateZ: `${fromRot.value * (1 - p) + dragX.value * 0.045 + outRot.value - 4 * arc - 6 * w}deg` },
        { rotateY: `${(1 - flip.value) * 180}deg` },
        { scale },
      ],
    };
  });
  // 外層的 opacity 用來在挑牌時藏起這張牌，換一張的淡出放在正反面上
  const frontStyle = useAnimatedStyle(() => ({ opacity: flip.value >= 0.5 ? 1 - away.value : 0 }));
  const backStyle = useAnimatedStyle(() => ({ opacity: flip.value >= 0.5 ? 0 : 1 - away.value }));
  const shineStyle = useAnimatedStyle(() => {
    const w = geo?.cardW ?? 300;
    return {
      opacity: shine.value > 0 && shine.value < 1 ? 1 : 0,
      transform: [{ translateX: -w * 0.9 + shine.value * w * 2.1 }, { rotate: '18deg' }],
    };
  });

  /* ---------- 文案 ---------- */

  const isWild = card?.kind === 'wild';
  const turnText = (() => {
    switch (phase) {
      case 'opening':
        return '開場';
      case 'shuffling':
        return '洗牌中⋯';
      case 'stage':
        return '準備往下一層';
      case 'done':
        return '收尾分享';
      case 'ready':
        return solo ? '挑一張想聊的牌' : `輪到「${players[drawer]}」抽牌`;
      default:
        if (isWild && phase !== 'drawing') return '野卡！大家一起完成它';
        if (solo) return '慢慢想，誠實地回答自己';
        return proxy == null ? `輪到「${players[answerer]}」回答` : `改由「${players[answerer]}」回答`;
    }
  })();

  const hint: { text: string; onPress?: () => void } = (() => {
    switch (phase) {
      case 'opening':
        return { text: '先念開場白，讓大家安靜下來' };
      case 'ready':
        return { text: selIdx < 0 ? '手指滑過手牌，挑一張想聊的' : '往上拉出這張，或再點一下' };
      case 'revealed':
      case 'discarding':
        if (isWild) return { text: '完成之後，再抽下一張' };
        if (solo) return { text: '想不到，就先寫下第一個念頭' };
        return { text: followUpTip(pos, span.stage), onPress: () => setSheet('tips') };
      case 'stage':
        return { text: '慢慢來，準備好了再繼續' };
      case 'done':
        return { text: solo ? '今天辛苦了' : '每個人都說一點，這一局就圓滿了' };
      default:
        return { text: '' };
    }
  })();

  const canPass = !solo && phase === 'revealed' && !isWild;
  const isFav = !!card && favorites.includes(card.id);
  const answered = log.filter((e) => !e.skipped);
  const skippedCount = log.length - answered.length;
  const slotRect = geo && {
    left: geo.slot.x - geo.cardW / 2,
    top: geo.slotTop,
    width: geo.cardW,
    height: geo.cardH,
    borderRadius: cardRadius(geo.cardW),
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop corners={false} />
      <SafeAreaView style={{ flex: 1, alignItems: 'center' }}>
        {/* 頂部：情境名稱＋目前在第幾層 */}
        <View style={[styles.header, { width: colW }]}>
          <IconButton label="離開牌局" onPress={() => (log.length > 0 && !done ? setSheet('leave') : leave())}>
            <BackIcon />
          </IconButton>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`牌局進度：${done ? '收尾分享' : `${stage.name}，第 ${drawnInStage} 張，共 ${stageSize} 張`}`}
            onPress={() => setSheet('stages')}
            style={{ alignItems: 'center', flex: 1 }}
          >
            <Text style={styles.headerTitle}>{scene.name}</Text>
            <View style={styles.progressRow}>
              <View style={styles.dots}>
                {spans.map((sp, i) => (
                  <View
                    key={sp.stage}
                    style={[styles.dot, (done || i < spanIdx) && styles.dotDone, !done && i === spanIdx && styles.dotNow]}
                  />
                ))}
              </View>
              <Text style={styles.headerSub}>{done ? '收尾分享' : stage.name}</Text>
              {!done && (
                <Text style={styles.headerCount}>
                  {drawnInStage} / {stageSize}
                </Text>
              )}
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton label={muted ? '開啟音效' : '關閉音效'} onPress={() => setMuted(!muted)}>
              <SoundIcon off={muted} size={18} />
            </IconButton>
            <IconButton label="玩法說明" onPress={() => setSheet('rules')}>
              <InfoIcon size={19} />
            </IconButton>
          </View>
        </View>

        {/* 輪到誰＋一行提示（固定高度，避免牌桌尺寸跳動） */}
        <View style={[styles.status, { width: colW }]}>
          <View style={styles.turnRow}>
            <Animated.Text key={turnText} entering={FadeInDown.duration(260)} style={styles.turn}>
              {turnText}
            </Animated.Text>
            {canPass && (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={passAnswer} style={styles.passChip}>
                <Text style={styles.passText}>{proxy == null ? '請別人答' : '換人答'}</Text>
              </Pressable>
            )}
          </View>
          {hint.text ? (
            <Animated.View key={hint.text} entering={FadeIn.duration(320)}>
              {hint.onPress ? (
                <Pressable accessibilityRole="button" accessibilityHint="打開接話小抄" hitSlop={6} onPress={hint.onPress}>
                  <Text style={[styles.hint, styles.hintLink]}>{hint.text}　›</Text>
                </Pressable>
              ) : (
                <Text style={styles.hint}>{hint.text}</Text>
              )}
            </Animated.View>
          ) : null}
        </View>

        {/* 牌桌 */}
        <View
          style={{ flex: 1, width: colW }}
          onLayout={(e) => setTable({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {geo && slotRect && (
            <>
              {/* 還沒抽牌時的空牌位：標出現在是哪一層 */}
              {phase === 'ready' && (
                <Animated.View entering={FadeIn.duration(400)} style={[styles.slotHint, slotRect]}>
                  <Text style={styles.slotMark}>{stage.mark}</Text>
                  <Text style={styles.slotHintText}>{stage.name}</Text>
                  <Text style={styles.slotHintEn}>pick a card</Text>
                  {nextSpan && (
                    <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSheet('stages')} style={styles.slotLink}>
                      <Text style={styles.slotLinkText}>聊夠了？往下一層　›</Text>
                    </Pressable>
                  )}
                </Animated.View>
              )}

              {/* 換層：介紹接下來這一層 */}
              {phase === 'stage' && (
                <Animated.View
                  key={pos}
                  entering={ZoomIn.springify().damping(15)}
                  style={[styles.stagePanel, slotRect, shadow(12, 0.24)]}
                >
                  <Text style={styles.stageEyebrow}>往下一層</Text>
                  <Text style={styles.stageMark}>{stage.mark}</Text>
                  <Text style={styles.stageName}>{stage.name}</Text>
                  <Divider width={Math.min(140, geo.cardW * 0.5)} />
                  <Text style={styles.stageIntro}>{stage.intro}</Text>
                  <Text style={styles.stageCount}>這一層共 {stageSize} 張</Text>
                </Animated.View>
              )}

              {/* 扇形手牌 */}
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    top: geo.fanTop,
                    zIndex: 5,
                    opacity: phase === 'shuffling' || phase === 'opening' ? 0 : 1,
                  },
                  fanStyle,
                ]}
              >
                <FanHand
                  ids={fanIds}
                  geo={geo.fan}
                  mode={mode}
                  sel={sel}
                  pull={pull}
                  spread={spread}
                  remaining={phase === 'shuffling' || phase === 'opening' ? 0 : remaining}
                  selected={selIdx}
                  onSelect={onSelect}
                  onDraw={drawAt}
                  onTapResting={next}
                  onStep={stepSel}
                />
              </Animated.View>

              {/* 洗牌：從手牌疊起的位置升起，洗完放回去再攤開 */}
              {phase === 'shuffling' && (
                <ShuffleLayer
                  key={shuffleId}
                  count={span.end - pos}
                  center={{ x: geo.slot.x, y: geo.slot.y + geo.cardH * 0.1 }}
                  geo={{
                    w: Math.round(geo.cardW * 0.52),
                    deckDX: geo.fan.pivotX - geo.slot.x,
                    deckDY: geo.fanTop + geo.fan.cardTop + geo.fan.fh / 2 - (geo.slot.y + geo.cardH * 0.1),
                    deckScale: geo.fan.fw / Math.round(geo.cardW * 0.52),
                  }}
                  onDone={onShuffled}
                />
              )}

              {/* 抽出的那張牌（挑牌時藏起來） */}
              {!done && card && (
                <GestureDetector gesture={gesture}>
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        left: slotRect.left,
                        top: slotRect.top,
                        width: geo.cardW,
                        height: geo.cardH,
                        opacity: onDeck ? 0 : 1,
                        pointerEvents: onDeck ? 'none' : 'auto',
                        zIndex: 10,
                      },
                      cardStyle,
                    ]}
                  >
                    <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
                      <CardBack width={geo.cardW} style={[{ transform: [{ rotateY: '180deg' }] }, shadow(10, 0.3)]} />
                    </Animated.View>
                    <Animated.View
                      style={[
                        StyleSheet.absoluteFill,
                        { borderRadius: cardRadius(geo.cardW), overflow: 'hidden' },
                        shadow(16, 0.32),
                        frontStyle,
                      ]}
                    >
                      <CardFace kind={card.kind} level={card.stage} text={card.text} width={geo.cardW} />
                      <Animated.View
                        style={[
                          { position: 'absolute', pointerEvents: 'none', top: -geo.cardH * 0.25, height: geo.cardH * 1.5, width: geo.cardW * 0.42 },
                          shineStyle,
                        ]}
                      >
                        <LinearGradient
                          colors={['rgba(255,252,240,0)', 'rgba(255,252,240,0.55)', 'rgba(255,252,240,0)']}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={{ flex: 1 }}
                        />
                      </Animated.View>
                    </Animated.View>
                  </Animated.View>
                </GestureDetector>
              )}

              <Burst v={burst} x={geo.slot.x} y={geo.slot.y} r={geo.cardW * 0.55} />

              {/* 收尾分享卡 */}
              {done && (
                <Animated.View
                  entering={ZoomIn.springify().damping(14)}
                  style={{ position: 'absolute', left: slotRect.left, top: slotRect.top, ...shadow(16, 0.32) }}
                >
                  <CardFace kind="wild" label="收尾分享" footer="Fin." width={geo.cardW} text={CLOSING[crowd]} />
                </Animated.View>
              )}
            </>
          )}
        </View>

        {/* 底部操作列（固定高度，避免牌桌尺寸跳動） */}
        <View style={[styles.bottom, { width: colW }]}>
          {phase === 'revealed' || phase === 'discarding' ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.bottomRow}>
              <IconButton
                label={isFav ? '取消收藏' : '收藏這題'}
                onPress={() => {
                  if (!card) return;
                  toggleFavorite(card.id);
                  if (!isFav) haptic.medium();
                }}
                style={[styles.roundBig, isFav && { backgroundColor: '#F6DCE3', borderColor: colors.rose }]}
              >
                <HeartIcon filled={isFav} color={isFav ? '#B5536F' : colors.plum} size={22} />
              </IconButton>
              <GhostButton
                label="換一張"
                icon={<RedrawIcon size={16} />}
                onPress={() => discard(1, true)}
                disabled={phase !== 'revealed'}
                style={styles.redraw}
              />
              <PrimaryButton
                label={pos + 1 >= deck.length ? '收尾' : '下一張'}
                onPress={next}
                icon={<NextIcon />}
                style={{ flex: 1 }}
              />
            </Animated.View>
          ) : phase === 'stage' ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.bottomRow}>
              <GhostButton label="到這裡收尾" onPress={finishEarly} style={{ paddingHorizontal: 16 }} />
              <PrimaryButton label={`進入${stage.name}`} onPress={enterStage} icon={<NextIcon />} style={{ flex: 1 }} />
            </Animated.View>
          ) : done ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.bottomRow}>
              <GhostButton label="回顧這一局" onPress={() => setSheet('recap')} style={{ flex: 1 }} />
              <PrimaryButton label="再來一輪" onPress={playAgain} style={{ flex: 1.3 }} />
            </Animated.View>
          ) : phase === 'opening' ? (
            <PrimaryButton label="開場" onPress={() => setSheet('opening')} />
          ) : (
            <View style={styles.bottomRow}>
              <GhostButton
                label="洗牌"
                icon={<ShuffleIcon size={18} />}
                onPress={reshuffle}
                disabled={phase !== 'ready'}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label={selIdx >= 0 ? '抽這張' : '隨機抽一張'}
                onPress={drawSelected}
                disabled={phase !== 'ready'}
                style={{ flex: 1.5 }}
              />
            </View>
          )}
        </View>
      </SafeAreaView>

      {sheet === 'rules' && (
        <Sheet title="怎麼玩" onClose={closeRules}>
          {RULES.map(([m, title, text]) => (
            <View key={m} style={styles.rule}>
              <Text style={styles.ruleMark}>{m}</Text>
              <Text style={styles.ruleText}>
                <Text style={styles.ruleTitle}>{title}　</Text>
                {text}
              </Text>
            </View>
          ))}
          <Text style={styles.ruleHint}>手勢：手指滑過扇形手牌挑一張，往上拉出（或再點一下）就抽到它；聊完的牌左右滑走。</Text>
          <PrimaryButton label={phase === 'opening' ? '下一步：開場' : '知道了'} onPress={closeRules} style={{ marginTop: 16 }} />
        </Sheet>
      )}

      {sheet === 'opening' && (
        <Sheet title="開場" onClose={beginGame}>
          <Text style={styles.openingWho}>{OPENING[crowd].who}</Text>
          <View style={styles.speech}>
            <Text style={styles.speechText}>{OPENING[crowd].text}</Text>
          </View>
          <PrimaryButton label="準備好了" sub="Shuffle the deck" onPress={beginGame} style={{ marginTop: 18 }} />
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSheet('rules')} style={styles.textLink}>
            <Text style={styles.textLinkText}>怎麼玩？</Text>
          </Pressable>
        </Sheet>
      )}

      {sheet === 'stages' && (
        <Sheet title="牌局進度" onClose={() => setSheet(null)}>
          {spans.map((sp, i) => {
            const st = STAGES[sp.stage];
            const now = !done && i === spanIdx;
            const past = done || i < spanIdx;
            const size = sp.end - sp.start;
            return (
              <View key={sp.stage} style={[styles.stageItem, now && styles.stageItemNow]}>
                <Text style={[styles.stageItemMark, past && { opacity: 0.5 }]}>{st.mark}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stageItemName, past && { opacity: 0.6 }]}>{st.name}</Text>
                  <Text style={styles.stageItemIntro}>{st.intro}</Text>
                </View>
                <Text style={styles.stageItemCount}>
                  {past ? '聊完了' : now ? `${drawnInStage} / ${size}` : `${size} 張`}
                </Text>
              </View>
            );
          })}
          {(phase === 'ready' || phase === 'stage') && (
            <View style={{ marginTop: 10, gap: 10 }}>
              {nextSpan && (
                <PrimaryButton
                  label={`直接進入${STAGES[nextSpan.stage].name}`}
                  sub={phase === 'ready' && remaining > 0 ? `這一層剩下的 ${remaining} 張會跳過` : undefined}
                  onPress={() => jumpTo(nextSpan.start)}
                />
              )}
              <GhostButton label="今天先聊到這裡，收尾" onPress={finishEarly} />
            </View>
          )}
        </Sheet>
      )}

      {sheet === 'pass' && (
        <Sheet title="請誰來回答？" onClose={() => setSheet(null)}>
          <View style={styles.passGrid}>
            {players.map((name, i) =>
              i === answerer ? null : (
                <GhostButton
                  key={i}
                  label={name}
                  onPress={() => {
                    setProxy(i === drawer ? null : i);
                    setSheet(null);
                  }}
                  style={styles.passBtn}
                />
              ),
            )}
          </View>
        </Sheet>
      )}

      {sheet === 'tips' && (
        <Sheet title="接話小抄" onClose={() => setSheet(null)}>
          <Text style={styles.tipsLead}>這不只是輪流回答。聽完之後，可以這樣接：</Text>
          <ScrollView style={{ maxHeight: winH * 0.5 }} contentContainerStyle={{ gap: 14 }}>
            {FOLLOW_UPS.map((g) => (
              <View key={g.title}>
                <Text style={styles.tipTitle}>
                  {g.title}
                  <Text style={styles.tipSub}>　{g.sub}</Text>
                </Text>
                <View style={styles.tipChips}>
                  {g.lines.map((l) => (
                    <Text key={l} style={styles.tipChip}>
                      「{l}」
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <PrimaryButton label="知道了" onPress={() => setSheet(null)} style={{ marginTop: 16 }} />
        </Sheet>
      )}

      {sheet === 'recap' && (
        <Sheet title="這一局" onClose={() => setSheet(null)}>
          <Text style={styles.recapStat}>
            {solo ? '' : `${players.length} 個人・`}聊了 {answered.length} 張
            {skippedCount ? `・換掉 ${skippedCount} 張` : ''}
          </Text>
          {answered.length ? (
            <ScrollView style={{ maxHeight: winH * 0.46 }} contentContainerStyle={{ gap: 8 }}>
              {answered.map(({ card: c }) => {
                const fav = favorites.includes(c.id);
                return (
                  <View key={c.id} style={styles.recapRow}>
                    <Text style={styles.recapMark}>{c.kind === 'wild' ? '✦' : STAGES[c.stage].mark}</Text>
                    <Text style={styles.recapText}>{c.text}</Text>
                    <IconButton
                      label={fav ? '取消收藏' : '收藏這題'}
                      onPress={() => toggleFavorite(c.id)}
                      style={styles.recapHeart}
                    >
                      <HeartIcon filled={fav} color={fav ? '#B5536F' : colors.plum} size={16} />
                    </IconButton>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={[styles.ruleText, { textAlign: 'center' }]}>這一局還沒聊到任何一題。</Text>
          )}
          <Text style={[styles.ruleHint, { marginTop: 12 }]}>按 ♡ 把喜歡的題目收進「我的收藏」</Text>
          <PrimaryButton label="好" onPress={() => setSheet(null)} style={{ marginTop: 14 }} />
        </Sheet>
      )}

      {sheet === 'leave' && (
        <Sheet title="要離開牌局嗎？" onClose={() => setSheet(null)}>
          <Text style={[styles.ruleText, { textAlign: 'center', marginBottom: 18 }]}>
            已經聊了 {answered.length} 張牌，離開後這一局不會保留。
          </Text>
          <View style={styles.bottomRow}>
            <GhostButton label="離開" onPress={leave} style={{ flex: 1 }} />
            <PrimaryButton label="繼續聊" onPress={() => setSheet(null)} style={{ flex: 1.4 }} />
          </View>
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 8,
  },
  headerTitle: { fontFamily: fonts.serifBold, fontSize: 17, color: colors.plum, letterSpacing: 5 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: {
    width: 6,
    height: 6,
    borderWidth: 1,
    borderColor: colors.gold,
    transform: [{ rotate: '45deg' }],
  },
  dotDone: { backgroundColor: 'rgba(201,162,90,0.45)' },
  dotNow: { backgroundColor: colors.gold, width: 8, height: 8 },
  headerSub: { fontFamily: fonts.serif, fontSize: 12, color: colors.inkSoft, letterSpacing: 1 },
  headerCount: { fontFamily: fonts.display, fontSize: 14, color: colors.goldDeep },
  status: { height: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 3 },
  turnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  turn: {
    fontFamily: fonts.serifBold,
    fontSize: 14,
    color: 'rgba(78,63,107,0.9)',
    letterSpacing: 2,
  },
  passChip: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: 'rgba(251,241,223,0.85)',
  },
  passText: { fontFamily: fonts.serif, fontSize: 11.5, color: colors.goldDeep, letterSpacing: 1 },
  hint: { fontFamily: fonts.serif, fontSize: 12, color: colors.inkSoft, letterSpacing: 1, textAlign: 'center' },
  hintLink: { color: colors.goldDeep },
  slotHint: {
    position: 'absolute',
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: 'rgba(201,162,90,0.65)',
    backgroundColor: 'rgba(251,241,223,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    pointerEvents: 'box-none',
  },
  slotMark: { fontFamily: fonts.display, fontSize: 30, color: colors.goldDeep, opacity: 0.85 },
  slotHintText: { fontFamily: fonts.serif, fontSize: 15, color: colors.plum, letterSpacing: 4, opacity: 0.8 },
  slotHintEn: { fontFamily: fonts.display, fontSize: 14, color: colors.goldDeep, opacity: 0.8 },
  slotLink: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 4 },
  slotLinkText: { fontFamily: fonts.serif, fontSize: 12, color: colors.goldDeep, letterSpacing: 1 },
  stagePanel: {
    position: 'absolute',
    backgroundColor: colors.parchment,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 6,
  },
  stageEyebrow: { fontFamily: fonts.serif, fontSize: 12, color: colors.inkSoft, letterSpacing: 4 },
  stageMark: { fontFamily: fonts.display, fontSize: 46, color: colors.goldDeep, lineHeight: 54 },
  stageName: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.plum, letterSpacing: 8, marginLeft: 8 },
  stageIntro: {
    fontFamily: fonts.serif,
    fontSize: 14,
    lineHeight: 23,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  stageCount: { fontFamily: fonts.serif, fontSize: 12, color: colors.goldDeep, letterSpacing: 2, marginTop: 6 },
  bottom: { height: 78, paddingHorizontal: 20, justifyContent: 'center' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundBig: { width: 54, height: 54, borderRadius: 27 },
  redraw: { paddingHorizontal: 14, height: 50 },
  rule: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  ruleMark: { fontFamily: fonts.display, fontSize: 17, color: colors.goldDeep, width: 26, textAlign: 'right' },
  ruleTitle: { fontFamily: fonts.serifBold, color: colors.plum },
  ruleText: { flex: 1, fontFamily: fonts.serif, fontSize: 14.5, lineHeight: 23, color: colors.ink, letterSpacing: 0.5 },
  ruleHint: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  openingWho: { fontFamily: fonts.serif, fontSize: 13, color: colors.goldDeep, textAlign: 'center', letterSpacing: 1 },
  speech: {
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,162,90,0.55)',
    backgroundColor: 'rgba(255,252,244,0.7)',
  },
  speechText: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 30, color: colors.ink, letterSpacing: 1 },
  textLink: { alignSelf: 'center', marginTop: 14, paddingHorizontal: 10, paddingVertical: 4 },
  textLinkText: { fontFamily: fonts.serif, fontSize: 13, color: colors.goldDeep, letterSpacing: 2 },
  stageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  stageItemNow: { backgroundColor: 'rgba(201,162,90,0.16)', borderWidth: 1, borderColor: 'rgba(201,162,90,0.6)' },
  stageItemMark: { fontFamily: fonts.display, fontSize: 20, color: colors.goldDeep, width: 30, textAlign: 'center' },
  stageItemName: { fontFamily: fonts.serifBold, fontSize: 15, color: colors.plum, letterSpacing: 2 },
  stageItemIntro: { fontFamily: fonts.serif, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
  stageItemCount: { fontFamily: fonts.serif, fontSize: 12, color: colors.goldDeep },
  passGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 8 },
  passBtn: { minWidth: 96 },
  tipsLead: { fontFamily: fonts.serif, fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginBottom: 14 },
  tipTitle: { fontFamily: fonts.serifBold, fontSize: 15, color: colors.plum, letterSpacing: 2 },
  tipSub: { fontFamily: fonts.serif, fontSize: 11.5, color: colors.inkSoft, letterSpacing: 0.5 },
  tipChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tipChip: {
    fontFamily: fonts.serif,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: 'rgba(255,252,244,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,90,0.45)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  recapStat: { fontFamily: fonts.serif, fontSize: 13, color: colors.goldDeep, textAlign: 'center', marginBottom: 12 },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,252,244,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,90,0.35)',
  },
  recapMark: { fontFamily: fonts.display, fontSize: 15, color: colors.goldDeep, width: 24, textAlign: 'center' },
  recapText: { flex: 1, fontFamily: fonts.serif, fontSize: 13.5, lineHeight: 21, color: colors.ink },
  recapHeart: { width: 34, height: 34, borderRadius: 17 },
});
