import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { EditionBackdrop } from '../components/Backdrop';
import { GhostButton, IconButton, PrimaryButton } from '../components/Buttons';
import { CardBack, CardFace, cardHeight } from '../components/Card';
import { BackIcon, HeartIcon, SoundIcon } from '../components/Icons';
import { Divider } from '../components/Ornament';
import { Text } from '../components/Text';
import { EDITION_IDS, EDITIONS, type CardKind, type EditionId, type StageId } from '../data/catalog';
import { DEFAULT_SETTINGS, settingsToParams } from '../lib/deck';
import { haptic, playSound, setMuted, useMuted } from '../lib/feedback';
import { adultConfirmed, loadSettings, useFavorites } from '../lib/storage';
import { colors, shadow, type } from '../theme';

/* ---------- 每個版本在首頁的樣子 ---------- */

type Sample = { kind: CardKind; level: StageId; text: string };

/** 標題、副標，和扇形展示的兩張牌面（從各自題庫挑的） */
const COVERS: Record<EditionId, { eyebrow: string; title: string; tagline: string; cards: [Sample, Sample] }> = {
  classic: {
    eyebrow: 'Shall We Talk',
    title: '聊聊好嗎',
    tagline: '抽一張牌，讓話題慢慢變深',
    cards: [
      { kind: 'memory', level: 1, text: '有沒有一種味道，會把你帶回某段時光？' },
      { kind: 'dreams', level: 2, text: '五年後的你，最希望自己多了什麼？' },
    ],
  },
  afterdark: {
    eyebrow: EDITIONS.afterdark.en,
    title: EDITIONS.afterdark.name,
    tagline: EDITIONS.afterdark.tagline,
    cards: [
      { kind: 'ad-talk', level: 0, text: '你還記得第一次對對方心動，是在什麼時候嗎？' },
      { kind: 'ad-touch', level: 0, text: '牽起對方的手，用拇指在掌心慢慢畫圈 30 秒。' },
    ],
  },
  parents: {
    eyebrow: EDITIONS.parents.en,
    title: EDITIONS.parents.name,
    tagline: EDITIONS.parents.tagline,
    cards: [
      { kind: 'pa-past', level: 0, text: '你小時候最愛吃的零食是什麼？現在還會買嗎？' },
      { kind: 'pa-heart', level: 0, text: '這個禮拜，有什麼小事讓你覺得被照顧到？' },
    ],
  },
};

/** 頁籤上的短名稱 */
const TAB_LABEL: Record<EditionId, string> = { classic: '經典版', afterdark: '深夜限定', parents: '爸媽聊聊' };

const PAGES = EDITION_IDS;
const LAST = PAGES.length - 1;

/* ---------- 扇形展示牌 ---------- */

function FanCard({
  spread,
  float,
  side,
  children,
}: {
  spread: SharedValue<number>;
  float: SharedValue<number>;
  side: -1 | 0 | 1;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: side * 62 * spread.value },
      { translateY: Math.abs(side) * 16 * spread.value + (side === 0 ? -float.value * 8 : float.value * 4) },
      { rotate: `${side * 13 * spread.value + (side === 0 ? float.value * 1.5 : 0)}deg` },
    ],
  }));
  return <Animated.View style={[styles.fanCard, style]}>{children}</Animated.View>;
}

/** 一頁：標題＋扇形三張牌（中間是該版本的卡背） */
function Cover({
  id,
  width,
  colW,
  cardW,
  spread,
  float,
}: {
  id: EditionId;
  width: number;
  colW: number;
  cardW: number;
  spread: SharedValue<number>;
  float: SharedValue<number>;
}) {
  const c = COVERS[id];
  const [left, right] = c.cards;
  return (
    <View style={{ width, alignItems: 'center' }}>
      <View style={[styles.cover, { width: colW }]}>
        <View style={styles.titleBlock}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>✦ {c.eyebrow} ✦</Text>
            {EDITIONS[id].adult && <Text style={styles.adultBadge}>18+</Text>}
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.title}>
            {c.title}
          </Text>
          <Divider width={200} />
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.tagline}>
            {c.tagline}
          </Text>
        </View>

        <View style={[styles.hero, { height: cardHeight(cardW) + 50 }]}>
          <FanCard spread={spread} float={float} side={-1}>
            <CardFace kind={left.kind} level={left.level} width={cardW} text={left.text} />
          </FanCard>
          <FanCard spread={spread} float={float} side={1}>
            <CardFace kind={right.kind} level={right.level} width={cardW} text={right.text} />
          </FanCard>
          <FanCard spread={spread} float={float} side={0}>
            <CardBack edition={id} width={cardW} style={shadow(14, 0.3)} />
          </FanCard>
        </View>
      </View>
    </View>
  );
}

/** 頁籤：目前這副牌、以及點一下就能切換的另外兩副 */
function Tabs({ page, onPick }: { page: number; onPick: (i: number) => void }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {PAGES.map((id, i) => {
        const on = i === page;
        return (
          <Pressable
            key={id}
            accessibilityRole="tab"
            aria-selected={on}
            accessibilityLabel={`${TAB_LABEL[id]}：${COVERS[id].tagline}`}
            onPress={() => onPick(i)}
            hitSlop={8}
            style={styles.tab}
          >
            <Text numberOfLines={1} style={[styles.tabText, on && styles.tabTextOn]}>
              {TAB_LABEL[id]}
            </Text>
            <View style={[styles.tabDot, on && styles.tabDotOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- 首頁 ---------- */

export default function Home() {
  const { width, height } = useWindowDimensions();
  const favorites = useFavorites();
  const muted = useMuted();

  const colW = Math.min(width, 520);
  const cardW = Math.min(colW * 0.46, height * 0.235, 220);
  const spread = useSharedValue(0);
  const float = useSharedValue(0);

  /** 目前滑到第幾頁（滑動中是小數），驅動頁面位移與背景交叉淡換 */
  const pos = useSharedValue(0);
  const start = useSharedValue(0);
  const [page, setPage] = useState(0);
  const edition = PAGES[page];

  useEffect(() => {
    spread.set(withDelay(250, withSpring(1, { damping: 11, stiffness: 90 })));
    float.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [spread, float]);

  const fanAgain = useCallback(() => {
    haptic.soft();
    playSound('swish', 0.5);
    spread.set(withSequence(withTiming(0.2, { duration: 160 }), withSpring(1, { damping: 9, stiffness: 120 })));
  }, [spread]);

  // 滑過一半就算換頁：頁籤、按鈕跟著換，牌輕輕收攏再攤開
  const onPage = useCallback(
    (i: number) => {
      setPage(i);
      haptic.tick();
      spread.set(withSequence(withTiming(0.55, { duration: 140 }), withSpring(1, { damping: 10, stiffness: 120 })));
    },
    [spread],
  );
  useAnimatedReaction(
    () => Math.min(LAST, Math.max(0, Math.round(pos.value))),
    (cur, prev) => {
      if (prev !== null && cur !== prev) scheduleOnRN(onPage, cur);
    },
  );

  const goTo = useCallback(
    (i: number) => {
      const target = Math.min(LAST, Math.max(0, i));
      if (target === page) return;
      playSound('swish', 0.35);
      pos.set(withSpring(target, { damping: 20, stiffness: 170, mass: 0.9 }));
    },
    [page, pos],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-12, 12])
      .failOffsetY([-16, 16])
      .onBegin(() => {
        cancelAnimation(pos);
        start.set(Math.round(pos.get()));
      })
      .onUpdate((e) => {
        let p = start.get() - e.translationX / width;
        // 兩端拉過頭有阻力
        if (p < 0) p *= 0.3;
        if (p > LAST) p = LAST + (p - LAST) * 0.3;
        pos.set(p);
      })
      .onEnd((e) => {
        // 依位置和甩動的速度決定停在哪一頁，一次最多換一頁
        const projected = pos.get() - (e.velocityX / width) * 0.25;
        const s = start.get();
        const target = Math.min(LAST, Math.max(0, Math.min(s + 1, Math.max(s - 1, Math.round(projected)))));
        if (target !== s) scheduleOnRN(playSound, 'swish', 0.35);
        pos.set(withSpring(target, { damping: 20, stiffness: 170, mass: 0.9, velocity: -e.velocityX / width }));
      });
    const tap = Gesture.Tap()
      .maxDistance(10)
      .onEnd((_e, ok) => {
        if (ok) scheduleOnRN(fanAgain);
      });
    return Gesture.Race(pan, tap);
  }, [fanAgain, pos, start, width]);

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: -pos.value * width }] }));

  // 網頁：鍵盤左右鍵也能換
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(page - 1);
      else if (e.key === 'ArrowRight') goTo(page + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, page]);

  const begin = () =>
    router.push(edition === 'classic' ? '/setup' : { pathname: '/setup', params: { edition } });

  const quickStart = async () => {
    // 成人內容還沒確認過年齡：先到準備頁確認
    if (EDITIONS[edition].adult && !(await adultConfirmed())) return begin();
    const last = await loadSettings(edition);
    router.push({
      pathname: '/play',
      params: settingsToParams({
        ...DEFAULT_SETTINGS,
        edition,
        partner: last.partner,
        players: last.players,
        scene: last.scene,
      }),
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <EditionBackdrop editions={PAGES} pos={pos} />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.topBar, { width: colW }]}>
          <IconButton label={muted ? '開啟聲音' : '關閉聲音'} onPress={() => setMuted(!muted)}>
            <SoundIcon off={muted} />
          </IconButton>
          <IconButton label="我的收藏" onPress={() => router.push('/favorites')}>
            <HeartIcon filled={favorites.length > 0} color={colors.plum} />
          </IconButton>
        </View>

        {/* 左右滑動換一副牌；點一下牌會重新攤開 */}
        <GestureDetector gesture={gesture}>
          <View style={[styles.pager, { width }]}>
            <Animated.View style={[styles.track, { width: width * PAGES.length }, track]}>
              {PAGES.map((id) => (
                <Cover key={id} id={id} width={width} colW={colW} cardW={cardW} spread={spread} float={float} />
              ))}
            </Animated.View>
            {page > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`上一副：${TAB_LABEL[PAGES[page - 1]]}`}
                onPress={() => goTo(page - 1)}
                hitSlop={10}
                style={[styles.arrow, { left: Math.max(4, (width - colW) / 2) }]}
              >
                <BackIcon size={18} color={colors.goldDeep} />
              </Pressable>
            )}
            {page < LAST && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`下一副：${TAB_LABEL[PAGES[page + 1]]}`}
                onPress={() => goTo(page + 1)}
                hitSlop={10}
                style={[styles.arrow, { right: Math.max(4, (width - colW) / 2), transform: [{ scaleX: -1 }] }]}
              >
                <BackIcon size={18} color={colors.goldDeep} />
              </Pressable>
            )}
          </View>
        </GestureDetector>

        <View style={[styles.col, { width: colW }]}>
          <Tabs page={page} onPick={goTo} />

          <View style={styles.actions}>
            <PrimaryButton
              label="開始一局"
              sub={edition === 'classic' ? 'Begin' : EDITIONS[edition].en}
              onPress={begin}
              style={{ alignSelf: 'stretch' }}
            />
            <View style={styles.row}>
              <GhostButton label="直接隨機抽" onPress={quickStart} style={{ flex: 1 }} />
              <GhostButton
                label={favorites.length ? `我的收藏 ${favorites.length}` : '我的收藏'}
                onPress={() => router.push('/favorites')}
                style={{ flex: 1 }}
              />
            </View>
          </View>

          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.footer}>
            給每一個想好好聊天，卻不知道從何開口的人
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, paddingHorizontal: 22 },
  pager: { flex: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row' },
  cover: { flex: 1, paddingHorizontal: 22 },
  col: { paddingHorizontal: 22, paddingBottom: 12 },
  titleBlock: { alignItems: 'center', marginTop: 4, gap: 4 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { ...type.script, color: colors.goldDeep, letterSpacing: 1 },
  adultBadge: {
    ...type.micro,
    color: colors.goldDeep,
    borderWidth: 1,
    borderColor: colors.goldDeep,
    borderRadius: 4,
    paddingHorizontal: 3,
  },
  title: { ...type.hero, color: colors.plum, letterSpacing: 12, marginLeft: 12 },
  tagline: { ...type.body, color: colors.inkSoft, letterSpacing: 3, marginTop: 2, textAlign: 'center' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  fanCard: { position: 'absolute', ...shadow(8, 0.2), borderRadius: 10 },
  arrow: {
    position: 'absolute',
    bottom: '32%',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,250,240,0.55)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginBottom: 14 },
  tab: { alignItems: 'center', gap: 4 },
  tabText: { ...type.callout, color: colors.inkSoft, letterSpacing: 2, opacity: 0.7 },
  tabTextOn: { fontFamily: type.subtitle.fontFamily, color: colors.plum, opacity: 1 },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  tabDotOn: { width: 18, backgroundColor: colors.gold },
  actions: { gap: 12, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  footer: {
    ...type.footnote,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: 1.5,
    opacity: 0.8,
  },
});
