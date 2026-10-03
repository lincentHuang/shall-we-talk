import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { DeckPile, PILE_MAX, PILE_STEP } from '../components/DeckPile';
import { BackIcon, HeartIcon, InfoIcon, NextIcon, ShuffleIcon, SoundIcon } from '../components/Icons';
import { Sheet } from '../components/Sheet';
import { ShuffleLayer } from '../components/ShuffleLayer';
import { PARTNERS, SCENES } from '../data/catalog';
import { CLOSING_TEXT } from '../data/questions';
import { buildDeck, reshuffleRemaining, settingsFromParams } from '../lib/deck';
import { haptic, playSound, setMuted, useMuted, warmUpSounds } from '../lib/feedback';
import { noise } from '../lib/noise';
import { toggleFavorite, useFavorites } from '../lib/storage';
import { CARD_RATIO, colors, fonts, shadow } from '../theme';

type Phase = 'shuffling' | 'ready' | 'drawing' | 'revealed' | 'discarding' | 'done';
/** 手勢模式（在 UI 執行緒讀取）：0 鎖定、1 牌在牌堆上可抽、2 已翻開可滑走 */
const LOCKED = 0;
const ON_DECK = 1;
const REVEALED = 2;

const RULES_KEY = 'buhui.rules.seen.v1';

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
  const partner = PARTNERS.find((x) => x.id === settings.partner) ?? PARTNERS[0];

  const { width: winW } = useWindowDimensions();
  const colW = Math.min(winW, 560);

  const [deck, setDeck] = useState(() => buildDeck(settings));
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('shuffling');
  const [shuffleId, setShuffleId] = useState(0);
  const [sheet, setSheet] = useState<null | 'rules' | 'leave'>(null);
  const [table, setTable] = useState<{ w: number; h: number } | null>(null);
  const favorites = useFavorites();
  const muted = useMuted();

  useEffect(warmUpSounds, []);

  /* ---------- 版面：上方翻牌區、下方牌堆 ---------- */

  const geo = useMemo(() => {
    if (!table) return null;
    const bottomPad = 18;
    const minGap = 30;
    const fit = (table.h - bottomPad - minGap - 14) / (CARD_RATIO * 1.36);
    const cardW = Math.floor(Math.min(table.w * 0.8, 400, fit));
    const deckW = Math.round(cardW * 0.36);
    const cardH = cardHeight(cardW);
    const deckH = cardHeight(deckW);
    const free = table.h - bottomPad - cardH - deckH - minGap;
    const slotTop = Math.max(4, free * 0.32);
    return {
      cardW,
      cardH,
      deckW,
      deckH,
      slot: { x: table.w / 2, y: slotTop + cardH / 2 },
      deckC: { x: table.w / 2, y: table.h - bottomPad - deckH / 2 },
      slotTop,
    };
  }, [table]);

  const done = phase === 'done';
  const beneath = done ? 0 : Math.max(0, deck.length - pos - 1);
  const onDeck = phase === 'ready' || phase === 'shuffling';
  const remaining = done ? 0 : deck.length - pos - (onDeck ? 0 : 1);
  const card = deck[Math.min(pos, deck.length - 1)];

  /* ---------- 動畫狀態 ---------- */

  const mode = useSharedValue(LOCKED);
  const progress = useSharedValue(0); // 0 在牌堆上 → 1 在翻牌區
  const flip = useSharedValue(0); // 0 背面 → 1 正面
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const outX = useSharedValue(0);
  const outY = useSharedValue(0);
  const outRot = useSharedValue(0);
  const hold = useSharedValue(0);
  const burst = useSharedValue(0);
  const shine = useSharedValue(0);

  const onRevealed = useCallback(() => {
    setPhase('revealed');
    mode.set(REVEALED);
    haptic.medium();
    burst.set(0);
    burst.set(withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }));
    shine.set(0);
    shine.set(withDelay(60, withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) })));
  }, [burst, mode, shine]);

  const draw = useCallback(() => {
    if (mode.get() !== ON_DECK) return;
    mode.set(LOCKED);
    setPhase('drawing');
    playSound('flip', 0.9);
    haptic.light();
    const cfg = { duration: 700, easing: Easing.bezier(0.2, 0.9, 0.25, 1) };
    progress.set(withTiming(1, cfg));
    dragX.set(withTiming(0, cfg));
    dragY.set(withTiming(0, cfg));
    flip.set(withDelay(
      110,
      withTiming(1, { duration: 580, easing: Easing.inOut(Easing.cubic) }, (fin) => {
        if (fin) scheduleOnRN(onRevealed);
      }),
    ));
  }, [dragX, dragY, flip, mode, onRevealed, progress]);

  const onDiscarded = useCallback(
    (autoNext: boolean, next: number, total: number) => {
      if (next >= total) {
        setPhase('done');
        haptic.medium();
        return;
      }
      // 牌飛出畫面後，悄悄放回牌堆頂（背面朝上），換成下一張的內容
      progress.set(0);
      flip.set(0);
      dragX.set(0);
      dragY.set(0);
      outX.set(0);
      outY.set(0);
      outRot.set(0);
      setPos(next);
      setPhase('ready');
      mode.set(ON_DECK);
      if (autoNext) setTimeout(draw, 120);
    },
    [draw, dragX, dragY, flip, mode, outRot, outX, outY, progress],
  );

  const discard = useCallback(
    (dir: number, autoNext: boolean) => {
      if (mode.get() !== REVEALED || !geo) return;
      mode.set(LOCKED);
      setPhase('discarding');
      playSound('swish', 0.7);
      haptic.soft();
      const cfg = { duration: 360, easing: Easing.in(Easing.quad) };
      outX.set(withTiming(dir * (winW * 0.7 + geo.cardW), cfg, (fin) => {
        if (fin) scheduleOnRN(onDiscarded, autoNext, pos + 1, deck.length);
      }));
      outY.set(withTiming(-40, cfg));
      outRot.set(withTiming(dir * 24, cfg));
    },
    [deck.length, geo, mode, onDiscarded, outRot, outX, outY, pos, winW],
  );

  const next = useCallback(() => {
    if (phase === 'ready') draw();
    else if (phase === 'revealed') discard(-1, true);
  }, [discard, draw, phase]);

  /* ---------- 洗牌 ---------- */

  const onShuffled = useCallback(() => {
    setPhase('ready');
    mode.set(ON_DECK);
    AsyncStorage.getItem(RULES_KEY)
      .then((v) => {
        if (!v) {
          setSheet('rules');
          AsyncStorage.setItem(RULES_KEY, '1').catch(() => {});
        }
      })
      .catch(() => {});
  }, [mode]);

  const reshuffle = useCallback(() => {
    if (phase !== 'ready') return;
    mode.set(LOCKED);
    setDeck((d) => reshuffleRemaining(d, pos));
    setShuffleId((k) => k + 1);
    setPhase('shuffling');
  }, [mode, phase, pos]);

  const playAgain = useCallback(() => {
    progress.set(0);
    flip.set(0);
    outX.set(0);
    outY.set(0);
    outRot.set(0);
    dragX.set(0);
    dragY.set(0);
    setDeck(buildDeck(settings));
    setPos(0);
    setShuffleId((k) => k + 1);
    setPhase('shuffling');
  }, [dragX, dragY, flip, outRot, outX, outY, progress, settings]);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  /* ---------- 網頁鍵盤：空白鍵／Enter／→ 抽下一張，S 洗牌 ---------- */

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (sheet) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 's' || e.key === 'S') reshuffle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, reshuffle, sheet]);

  /* ---------- 手勢 ---------- */

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin(() => {
        if (mode.value !== LOCKED) hold.set(withSpring(1, { damping: 15, stiffness: 260 }));
      })
      .onUpdate((e) => {
        if (mode.value === ON_DECK) {
          dragX.set(e.translationX);
          dragY.set(e.translationY);
        } else if (mode.value === REVEALED) {
          dragX.set(e.translationX);
          dragY.set(e.translationY * 0.25);
        }
      })
      .onEnd((e) => {
        if (mode.value === ON_DECK) {
          if (e.translationY < -50 || e.velocityY < -450) scheduleOnRN(draw);
          else {
            dragX.set(withSpring(0, { damping: 14 }));
            dragY.set(withSpring(0, { damping: 14 }));
          }
        } else if (mode.value === REVEALED) {
          if (Math.abs(e.translationX) > 90 || Math.abs(e.velocityX) > 650) {
            scheduleOnRN(discard, e.translationX > 0 ? 1 : -1, false);
          } else {
            dragX.set(withSpring(0, { damping: 14 }));
            dragY.set(withSpring(0, { damping: 14 }));
          }
        }
      })
      .onFinalize(() => {
        hold.set(withSpring(0, { damping: 15, stiffness: 200 }));
      });
    const tap = Gesture.Tap()
      .maxDuration(450)
      .onEnd(() => {
        if (mode.value === ON_DECK) scheduleOnRN(draw);
      });
    return Gesture.Race(pan, tap);
  }, [discard, dragX, dragY, draw, hold, mode]);

  /* ---------- 牌的姿態 ---------- */

  const s0 = geo ? geo.deckW / geo.cardW : 0.36;
  const toDeckX = geo ? geo.deckC.x - geo.slot.x : 0;
  const toDeckY = geo ? geo.deckC.y - geo.slot.y - Math.min(beneath, PILE_MAX) * PILE_STEP : 0;

  const cardStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
    const scale = (s0 + (1 - s0) * p) * (1 + 0.07 * hold.value + 0.06 * arc);
    return {
      transform: [
        { perspective: 1400 },
        { translateX: toDeckX * (1 - p) + dragX.value + outX.value },
        { translateY: toDeckY * (1 - p) + dragY.value + outY.value - 34 * arc },
        { rotateZ: `${dragX.value * 0.045 + outRot.value - 4 * arc}deg` },
        { rotateY: `${(1 - flip.value) * 180}deg` },
        { scale },
      ],
    };
  });
  const frontStyle = useAnimatedStyle(() => ({ opacity: flip.value >= 0.5 ? 1 : 0 }));
  const backStyle = useAnimatedStyle(() => ({ opacity: flip.value >= 0.5 ? 0 : 1 }));
  const shineStyle = useAnimatedStyle(() => {
    const w = geo?.cardW ?? 300;
    return {
      opacity: shine.value > 0 && shine.value < 1 ? 1 : 0,
      transform: [{ translateX: -w * 0.9 + shine.value * w * 2.1 }, { rotate: '18deg' }],
    };
  });

  /* ---------- 文案 ---------- */

  const other = settings.partnerName.trim() || '對方';
  const turnText = (() => {
    if (done) return '這一局結束了';
    if (phase === 'shuffling') return '洗牌中⋯';
    if (phase === 'ready' || phase === 'drawing') return '輕點牌堆，或把牌往上滑';
    if (card?.kind === 'wild') return '野卡！一起完成它';
    if (settings.partner === 'self') return '慢慢想，誠實地回答自己';
    if (settings.scene === 'party') return '抽牌的人先回答，再輪到下一位';
    return pos % 2 === 0 ? '輪到「你」先回答' : `輪到「${other}」先回答`;
  })();
  const subtitle = settings.partner === 'self' ? '一個人的對話' : `與 ${settings.partnerName.trim() || partner.label}`;
  const isFav = !!card && favorites.includes(card.id);

  return (
    <View style={{ flex: 1 }}>
      <Backdrop corners={false} />
      <SafeAreaView style={{ flex: 1, alignItems: 'center' }}>
        {/* 頂部 */}
        <View style={[styles.header, { width: colW }]}>
          <IconButton label="離開牌局" onPress={() => (pos > 0 && !done ? setSheet('leave') : leave())}>
            <BackIcon />
          </IconButton>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={styles.headerTitle}>{scene.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 1 }}>
              <Text style={styles.headerSub}>{subtitle}</Text>
              <Text style={styles.headerCount}>
                {Math.min(pos + (onDeck ? 0 : 1), deck.length)} / {deck.length}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton label={muted ? '開啟音效' : '關閉音效'} onPress={() => setMuted(!muted)}>
              <SoundIcon off={muted} size={18} />
            </IconButton>
            <IconButton label="玩法說明" onPress={() => setSheet('rules')}>
              <InfoIcon size={19} />
            </IconButton>
          </View>
        </View>

        <Animated.Text key={turnText} entering={FadeInDown.duration(260)} style={styles.turn}>
          {turnText}
        </Animated.Text>

        {/* 牌桌 */}
        <View
          style={{ flex: 1, width: colW }}
          onLayout={(e) => setTable({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {geo && (
            <>
              {/* 牌堆 */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="牌堆"
                disabled={phase !== 'revealed'}
                onPress={next}
                style={{
                  position: 'absolute',
                  left: geo.deckC.x - geo.deckW / 2,
                  top: geo.deckC.y - geo.deckH / 2,
                  opacity: phase === 'shuffling' ? 0 : 1,
                }}
              >
                <DeckPile count={beneath} width={geo.deckW} />
              </Pressable>

              {/* 剩餘張數（壓在所有牌之上） */}
              {remaining > 0 && phase !== 'shuffling' && (
                <View
                  style={[styles.badge, { left: geo.deckC.x + geo.deckW / 2 - 16, top: geo.deckC.y - geo.deckH / 2 - 22 }]}
                >
                  <Text style={styles.badgeText}>{remaining}</Text>
                </View>
              )}

              {/* 還沒抽牌時的空牌位提示 */}
              {phase === 'ready' && (
                <Animated.View
                  entering={FadeIn.duration(400)}
                  style={[
                    styles.slotHint,
                    {
                      left: geo.slot.x - geo.cardW / 2,
                      top: geo.slotTop,
                      width: geo.cardW,
                      height: geo.cardH,
                      borderRadius: cardRadius(geo.cardW),
                    },
                  ]}
                >
                  <Sparkle size={26} color={colors.gold} />
                  <Text style={styles.slotHintText}>{pos === 0 ? '抽第一張牌吧' : '抽下一張'}</Text>
                  <Text style={styles.slotHintEn}>draw a card</Text>
                </Animated.View>
              )}

              {/* 洗牌 */}
              {phase === 'shuffling' && (
                <ShuffleLayer
                  key={shuffleId}
                  count={deck.length - pos}
                  center={{ x: geo.slot.x, y: geo.slot.y + geo.cardH * 0.1 }}
                  geo={{
                    w: Math.round(geo.cardW * 0.52),
                    deckDX: geo.deckC.x - geo.slot.x,
                    deckDY: geo.deckC.y - (geo.slot.y + geo.cardH * 0.1),
                    deckScale: geo.deckW / Math.round(geo.cardW * 0.52),
                  }}
                  onDone={onShuffled}
                />
              )}

              {/* 抽出的那張牌 */}
              {!done && card && (
                <GestureDetector gesture={gesture}>
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        left: geo.slot.x - geo.cardW / 2,
                        top: geo.slotTop,
                        width: geo.cardW,
                        height: geo.cardH,
                        opacity: phase === 'shuffling' ? 0 : 1,
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
                      <CardFace kind={card.kind} level={card.level} text={card.text} width={geo.cardW} />
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

              {/* 收尾卡 */}
              {done && (
                <Animated.View
                  entering={ZoomIn.springify().damping(14)}
                  style={{ position: 'absolute', left: geo.slot.x - geo.cardW / 2, top: geo.slotTop, ...shadow(16, 0.32) }}
                >
                  <CardFace
                    kind="wild"
                    label="最後一張"
                    footer="Fin."
                    width={geo.cardW}
                    text={settings.partner === 'self' ? CLOSING_TEXT.self : CLOSING_TEXT.pair}
                  />
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
              <PrimaryButton
                label={pos + 1 >= deck.length ? '收尾' : '下一張'}
                onPress={next}
                icon={<NextIcon />}
                style={{ flex: 1 }}
              />
            </Animated.View>
          ) : done ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.bottomRow}>
              <GhostButton label="回首頁" onPress={() => router.replace('/')} style={{ flex: 1 }} />
              <PrimaryButton label="再來一輪" onPress={playAgain} style={{ flex: 1.4 }} />
            </Animated.View>
          ) : (
            <View style={styles.bottomRow}>
              <GhostButton
                label="重新洗牌"
                icon={<ShuffleIcon size={18} />}
                onPress={reshuffle}
                disabled={phase !== 'ready'}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>
      </SafeAreaView>

      {sheet === 'rules' && (
        <Sheet title="怎麼玩" onClose={() => setSheet(null)}>
          {[
            ['I', '輪流抽牌，抽到的人先回答，另一位也可以接著分享。'],
            ['II', '沒有標準答案，誠實就好；不想回答，就直接下一張。'],
            ['III', '認真聽、少打斷。一句「然後呢？」常常比給建議更好。'],
            ['IV', '抽到野卡時，放下手機，一起完成它。'],
            ['V', '喜歡的題目按 ♡ 收藏，下次再聊。'],
          ].map(([m, t]) => (
            <View key={m} style={styles.rule}>
              <Text style={styles.ruleMark}>{m}</Text>
              <Text style={styles.ruleText}>{t}</Text>
            </View>
          ))}
          <Text style={styles.ruleHint}>手勢：點牌堆或往上滑抽牌，左右滑走看完的牌。</Text>
          <PrimaryButton label="開始吧" onPress={() => setSheet(null)} style={{ marginTop: 16 }} />
        </Sheet>
      )}

      {sheet === 'leave' && (
        <Sheet title="要離開牌局嗎？" onClose={() => setSheet(null)}>
          <Text style={[styles.ruleText, { textAlign: 'center', marginBottom: 18 }]}>
            已經聊了 {pos + (onDeck ? 0 : 1)} 張牌，離開後這一局不會保留。
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
  headerSub: { fontFamily: fonts.serif, fontSize: 12, color: colors.inkSoft, letterSpacing: 1 },
  headerCount: { fontFamily: fonts.display, fontSize: 14, color: colors.goldDeep },
  turn: {
    fontFamily: fonts.serif,
    fontSize: 13.5,
    color: 'rgba(78,63,107,0.85)',
    letterSpacing: 2,
    marginTop: 10,
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
    zIndex: 20,
    pointerEvents: 'none',
    ...shadow(3, 0.2),
  },
  badgeText: { fontFamily: fonts.display, fontSize: 16, color: colors.plum, marginTop: -2 },
  slotHint: {
    position: 'absolute',
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: 'rgba(201,162,90,0.65)',
    backgroundColor: 'rgba(251,241,223,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    pointerEvents: 'none',
  },
  slotHintText: { fontFamily: fonts.serif, fontSize: 15, color: colors.plum, letterSpacing: 4, opacity: 0.8 },
  slotHintEn: { fontFamily: fonts.display, fontSize: 14, color: colors.goldDeep, opacity: 0.8 },
  bottom: { height: 78, paddingHorizontal: 20, justifyContent: 'center' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roundBig: { width: 54, height: 54, borderRadius: 27 },
  rule: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  ruleMark: { fontFamily: fonts.display, fontSize: 17, color: colors.goldDeep, width: 26, textAlign: 'right' },
  ruleText: { flex: 1, fontFamily: fonts.serif, fontSize: 14.5, lineHeight: 23, color: colors.ink, letterSpacing: 0.5 },
  ruleHint: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
