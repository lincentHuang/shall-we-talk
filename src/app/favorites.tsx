import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '../components/Backdrop';
import { IconButton, PrimaryButton } from '../components/Buttons';
import { CardFace } from '../components/Card';
import { CloseIcon, HeartIcon } from '../components/Icons';
import { Divider } from '../components/Ornament';
import { Text } from '../components/Text';
import { TOPICS } from '../data/catalog';
import { phrase, QUESTION_BY_ID, type Question } from '../data/questions';
import { haptic } from '../lib/feedback';
import { toggleFavorite, useFavorites } from '../lib/storage';
import { colors, fonts, radius, shadow, type } from '../theme';

export default function Favorites() {
  const { width, height } = useWindowDimensions();
  const colW = Math.min(width, 560);
  const ids = useFavorites();
  const items = ids.map((id) => QUESTION_BY_ID[id]).filter(Boolean) as Question[];
  const [open, setOpen] = useState<Question | null>(null);
  const bigW = Math.min(colW * 0.82, (height - 220) / 1.49, 400);

  return (
    <View style={{ flex: 1 }}>
      <Backdrop corners={false} />
      <SafeAreaView style={{ flex: 1, alignItems: 'center' }}>
        <View style={[styles.header, { width: colW }]}>
          <IconButton label="關閉" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <CloseIcon />
          </IconButton>
          <Text style={styles.title}>我的收藏</Text>
          <View style={{ width: 42 }} />
        </View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <HeartIcon size={36} color={colors.gold} />
            <Text style={styles.emptyTitle}>還沒有收藏的題目</Text>
            <Text style={styles.emptySub}>在牌桌上按 ♡，喜歡的題目就會收在這裡</Text>
            <PrimaryButton label="去抽牌" onPress={() => router.replace('/setup')} style={{ marginTop: 18 }} />
          </View>
        ) : (
          <FlatList
            style={{ width: colW }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
            data={items}
            keyExtractor={(q) => q.id}
            ListHeaderComponent={
              <View style={{ alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.count}>共 {items.length} 題</Text>
                <Divider width={140} />
              </View>
            }
            renderItem={({ item }) => {
              const t = TOPICS[item.kind];
              return (
                <Animated.View layout={LinearTransition} exiting={FadeOut.duration(180)}>
                  <Pressable
                    onPress={() => {
                      haptic.tick();
                      setOpen(item);
                    }}
                    style={[styles.row, { borderLeftColor: t.accent }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTopic, { color: t.ink }]}>✦ {t.name}</Text>
                      <Text style={styles.rowText}>{phrase(item.text)}</Text>
                    </View>
                    <IconButton label="取消收藏" onPress={() => toggleFavorite(item.id)} style={styles.rowHeart}>
                      <HeartIcon filled size={18} color={colors.heart} />
                    </IconButton>
                  </Pressable>
                </Animated.View>
              );
            }}
          />
        )}
      </SafeAreaView>

      {open && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(null)} accessibilityLabel="關閉" />
          <Animated.View entering={ZoomIn.springify().damping(15)} style={shadow(18, 0.35)}>
            <CardFace kind={open.kind} level={open.level} text={phrase(open.text)} width={bigW} />
          </Animated.View>
          <Text style={styles.overlayHint}>點任意處關閉</Text>
        </Animated.View>
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
    paddingVertical: 6,
  },
  title: { ...type.heading, color: colors.plum, letterSpacing: 6 },
  count: { ...type.callout, color: colors.inkSoft, letterSpacing: 2, marginBottom: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 30, paddingBottom: 60 },
  emptyTitle: { ...type.heading, color: colors.plum, letterSpacing: 3, marginTop: 8, textAlign: 'center' },
  emptySub: { ...type.callout, color: colors.inkSoft, textAlign: 'center', letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(251,241,223,0.94)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
  },
  rowTopic: { ...type.footnote, fontFamily: fonts.serifBold, letterSpacing: 2, marginBottom: 4 },
  rowText: { ...type.body, color: colors.ink },
  rowHeart: { width: 36, height: 36, borderRadius: 18, borderColor: 'rgba(217,154,171,0.6)' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(46,34,70,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  overlayHint: { ...type.caption, color: '#F1E8FA', marginTop: 18, letterSpacing: 2 },
});
