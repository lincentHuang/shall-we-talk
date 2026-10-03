import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
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

import { Backdrop } from '../components/Backdrop';
import { GhostButton, IconButton, PrimaryButton } from '../components/Buttons';
import { CardBack, CardFace, cardHeight } from '../components/Card';
import { HeartIcon, SoundIcon } from '../components/Icons';
import { Divider } from '../components/Ornament';
import { DEFAULT_SETTINGS, settingsToParams } from '../lib/deck';
import { haptic, playSound, setMuted, useMuted } from '../lib/feedback';
import { loadSettings, useFavorites } from '../lib/storage';
import { colors, fonts, shadow } from '../theme';

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

export default function Home() {
  const { width, height } = useWindowDimensions();
  const favorites = useFavorites();
  const muted = useMuted();

  const colW = Math.min(width, 520);
  const cardW = Math.min(colW * 0.46, height * 0.235, 220);
  const spread = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    spread.set(withDelay(250, withSpring(1, { damping: 11, stiffness: 90 })));
    float.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [spread, float]);

  const fanAgain = () => {
    haptic.soft();
    playSound('swish', 0.5);
    spread.set(withSequence(withTiming(0.2, { duration: 160 }), withSpring(1, { damping: 9, stiffness: 120 })));
  };

  const quickStart = async () => {
    const last = await loadSettings();
    router.push({
      pathname: '/play',
      params: settingsToParams({ ...DEFAULT_SETTINGS, partner: last.partner, partnerName: last.partnerName, scene: last.scene }),
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.col, { width: colW }]}>
          <View style={styles.topBar}>
            <IconButton label={muted ? '開啟音效' : '關閉音效'} onPress={() => setMuted(!muted)}>
              <SoundIcon off={muted} />
            </IconButton>
            <IconButton label="我的收藏" onPress={() => router.push('/favorites')}>
              <HeartIcon filled={favorites.length > 0} color={colors.plum} />
            </IconButton>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>✦ Shall We Talk ✦</Text>
            <Text style={styles.title}>聊聊</Text>
            <Divider width={200} />
            <Text style={styles.tagline}>抽一張牌，讓話題慢慢變深</Text>
          </View>

          <Pressable onPress={fanAgain} style={[styles.hero, { height: cardHeight(cardW) + 50 }]}>
            <FanCard spread={spread} float={float} side={-1}>
              <CardFace kind="memory" level={1} width={cardW} text="有沒有一種味道，會把你帶回某段時光？" />
            </FanCard>
            <FanCard spread={spread} float={float} side={1}>
              <CardFace kind="dreams" level={2} width={cardW} text="五年後的你，最希望自己多了什麼？" />
            </FanCard>
            <FanCard spread={spread} float={float} side={0}>
              <CardBack width={cardW} style={shadow(14, 0.3)} />
            </FanCard>
          </Pressable>

          <View style={styles.actions}>
            <PrimaryButton label="開始一局" sub="Begin" onPress={() => router.push('/setup')} style={{ alignSelf: 'stretch' }} />
            <View style={styles.row}>
              <GhostButton label="直接隨機抽" onPress={quickStart} style={{ flex: 1 }} />
              <GhostButton
                label={favorites.length ? `我的收藏 ${favorites.length}` : '我的收藏'}
                onPress={() => router.push('/favorites')}
                style={{ flex: 1 }}
              />
            </View>
          </View>

          <Text style={styles.footer}>給每一個想好好聊天，卻不知道從何開口的人</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: 'center' },
  col: { flex: 1, paddingHorizontal: 22, paddingBottom: 12 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  titleBlock: { alignItems: 'center', marginTop: 4, gap: 4 },
  eyebrow: { fontFamily: fonts.display, color: colors.goldDeep, fontSize: 15, letterSpacing: 1 },
  title: { fontFamily: fonts.serifBold, color: colors.plum, fontSize: 46, letterSpacing: 12, marginLeft: 12 },
  tagline: { fontFamily: fonts.serif, color: colors.inkSoft, fontSize: 15, letterSpacing: 3, marginTop: 2 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  fanCard: { position: 'absolute', ...shadow(8, 0.2), borderRadius: 10 },
  actions: { gap: 12, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  footer: {
    fontFamily: fonts.serif,
    color: colors.inkSoft,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: 1.5,
    opacity: 0.8,
  },
});
