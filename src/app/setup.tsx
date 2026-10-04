import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop, Sparkle } from '../components/Backdrop';
import { IconButton, PrimaryButton } from '../components/Buttons';
import { BackIcon, CloseIcon } from '../components/Icons';
import { SectionTitle } from '../components/Ornament';
import { LEVEL_MARK, PARTNERS, SCENES, STAGES, TOPICS, TOPIC_IDS, type TopicId } from '../data/catalog';
import {
  buildDeck,
  cleanName,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NAME_MAX,
  normalizePlayers,
  settingsToParams,
  stageSpans,
  type Settings,
} from '../lib/deck';
import { haptic } from '../lib/feedback';
import { loadSettings, saveSettings } from '../lib/storage';
import { colors, fonts, shadow } from '../theme';

/** 被選取時輕輕放大、出現金框 */
function Selectable({
  selected,
  onPress,
  style,
  children,
  label,
}: {
  selected: boolean;
  onPress: () => void;
  style?: object;
  children: React.ReactNode;
  label: string;
}) {
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(selected ? 1 : 0.97, { damping: 14, stiffness: 220 }) }],
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptic.tick();
        onPress();
      }}
      style={style}
    >
      <Animated.View style={[{ flex: 1 }, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

function SelectedBadge() {
  return (
    <View style={styles.badge}>
      <Sparkle size={12} color="#FFF8EA" />
    </View>
  );
}

export default function Setup() {
  const { width } = useWindowDimensions();
  const colW = Math.min(width, 560);
  const gap = 12;
  const tileW = (colW - 40 - gap) / 2;

  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    loadSettings().then(setS);
  }, []);

  const update = (patch: Partial<Settings>) => setS((prev) => ({ ...prev, ...patch }));

  const toggleTopic = (id: TopicId) =>
    setS((prev) => {
      const base = prev.random ? [] : prev.topics;
      const topics = base.includes(id) ? base.filter((t) => t !== id) : [...base, id];
      return { ...prev, topics, random: topics.length === 0 };
    });

  const setPlayer = (i: number, name: string) =>
    setS((prev) => ({ ...prev, players: prev.players.map((n, k) => (k === i ? cleanName(name) : n)) }));
  const addPlayer = () => {
    haptic.tick();
    setS((prev) => ({ ...prev, players: normalizePlayers([...prev.players, '']) }));
  };
  const removePlayer = (i: number) =>
    setS((prev) => ({ ...prev, players: normalizePlayers(prev.players.filter((_, k) => k !== i)) }));

  const scene = SCENES.find((x) => x.id === s.scene) ?? SCENES[0];
  const deck = useMemo(() => buildDeck(s), [s]);
  const layerCount = useMemo(() => stageSpans(deck).length, [deck]);
  const isSelf = s.partner === 'self';

  const start = () => {
    saveSettings(s);
    router.push({ pathname: '/play', params: settingsToParams(s) });
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop corners={false} />
      <SafeAreaView style={{ flex: 1, alignItems: 'center' }} edges={['top', 'left', 'right']}>
        <View style={[styles.header, { width: colW }]}>
          <View style={[styles.headerBg, { left: -(width - colW) / 2 - 1, right: -(width - colW) / 2 - 1 }]} />
          <IconButton label="返回" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <BackIcon />
          </IconButton>
          <Text style={styles.headerTitle}>準備牌局</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView
          style={{ width: '100%' }}
          contentContainerStyle={{ alignItems: 'center', paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: colW, paddingHorizontal: 20 }}>
            {/* ---------- I. 對象 ---------- */}
            <SectionTitle mark="I" title="談話對象" sub="今天想和誰聊聊？" />
            <View style={styles.chips}>
              {PARTNERS.map((p) => {
                const on = s.partner === p.id;
                return (
                  <Selectable
                    key={p.id}
                    label={p.label}
                    selected={on}
                    onPress={() => update({ partner: p.id })}
                    style={{ width: (colW - 40 - gap * 2) / 3, height: 78 }}
                  >
                    <View style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipGlyph, on && { color: colors.goldLight }]}>{p.glyph}</Text>
                      <Text style={[styles.chipLabel, on && { color: '#FFF8EA' }]}>{p.label}</Text>
                      <Text numberOfLines={1} style={[styles.chipHint, on && { color: '#EDE2FA' }]}>
                        {p.hint}
                      </Text>
                    </View>
                  </Selectable>
                );
              })}
            </View>
            {!isSelf && (
              <View style={styles.players}>
                <View style={styles.playersHead}>
                  <Text style={styles.nameLabel}>一起玩的人</Text>
                  <Text style={styles.playersMeta}>{s.players.length} 人・照順序輪流抽牌回答</Text>
                </View>
                {s.players.map((name, i) => (
                  <View key={i} style={styles.nameRow}>
                    <Text style={styles.nameIndex}>{i + 1}</Text>
                    <TextInput
                      value={name}
                      onChangeText={(t) => setPlayer(i, t)}
                      placeholder={namePlaceholder(i, s.players.length)}
                      placeholderTextColor="#A69CB8"
                      style={styles.nameInput}
                      maxLength={NAME_MAX}
                      returnKeyType="done"
                      accessibilityLabel={`第 ${i + 1} 位的名字`}
                    />
                    {s.players.length > MIN_PLAYERS && (
                      <IconButton label={`移除第 ${i + 1} 位`} onPress={() => removePlayer(i)} style={styles.removeBtn}>
                        <CloseIcon size={13} color={colors.inkSoft} />
                      </IconButton>
                    )}
                  </View>
                ))}
                {s.players.length < MAX_PLAYERS && (
                  <Pressable accessibilityRole="button" onPress={addPlayer} style={styles.addPlayer}>
                    <Text style={styles.addPlayerText}>＋ 再加一位（最多 {MAX_PLAYERS} 人）</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* ---------- II. 情境 ---------- */}
            <View style={{ height: 30 }} />
            <SectionTitle mark="II" title="聊天情境" sub="情境會決定題目的深淺與張數" />
            <View style={styles.grid}>
              {SCENES.map((sc) => {
                const on = s.scene === sc.id;
                return (
                  <Selectable
                    key={sc.id}
                    label={sc.name}
                    selected={on}
                    onPress={() => update({ scene: sc.id })}
                    style={{ width: tileW, height: tileW * 0.78 + SCENE_TEXT_H }}
                  >
                    <View style={[styles.sceneTile, on ? styles.tileOn : styles.tileOff]}>
                      <Image source={sc.image} style={{ width: '100%', height: tileW * 0.78 }} contentFit="cover" />
                      <View style={styles.sceneText}>
                        <Text style={styles.sceneName}>{sc.name}</Text>
                        <Text numberOfLines={1} style={styles.sceneMood}>
                          {sc.mood}
                        </Text>
                        <Text style={styles.sceneMeta}>
                          {[STAGES[0].mark, ...sc.levels.map((l) => LEVEL_MARK[l])].join(' · ')}　約 {sc.count} 張
                        </Text>
                      </View>
                      {on && <SelectedBadge />}
                    </View>
                  </Selectable>
                );
              })}
            </View>

            {/* ---------- III. 主題 ---------- */}
            <View style={{ height: 30 }} />
            <SectionTitle mark="III" title="話題主題" sub="可複選；不選就是完全隨機" />
            <Selectable
              label="完全隨機"
              selected={s.random}
              onPress={() => update({ random: true, topics: [] })}
              style={{ height: 70, marginBottom: gap }}
            >
              <LinearGradient
                colors={s.random ? ['#8F7BBE', '#6B5899'] : ['rgba(251,241,223,0.92)', 'rgba(243,228,200,0.92)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.randomTile, s.random ? styles.tileOn : styles.tileOff]}
              >
                <Sparkle size={22} color={s.random ? colors.goldLight : colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.randomTitle, s.random && { color: '#FFF8EA' }]}>完全隨機</Text>
                  <Text style={[styles.randomSub, s.random && { color: '#EDE2FA' }]}>
                    所有主題混在一起，交給命運決定
                  </Text>
                </View>
                <Text style={[styles.randomEn, s.random && { color: colors.goldLight }]}>Fate</Text>
              </LinearGradient>
            </Selectable>
            <View style={styles.grid}>
              {TOPIC_IDS.map((id) => {
                const t = TOPICS[id];
                const on = !s.random && s.topics.includes(id);
                return (
                  <Selectable
                    key={id}
                    label={t.name}
                    selected={on}
                    onPress={() => toggleTopic(id)}
                    style={{ width: tileW, height: tileW * 0.62 + 64 }}
                  >
                    <View style={[styles.topicTile, on ? styles.tileOn : styles.tileOff, { opacity: s.random ? 0.82 : 1 }]}>
                      <Image source={t.thumb} style={{ width: '100%', height: tileW * 0.62 }} contentFit="cover" />
                      <View style={[styles.topicText, { borderTopColor: t.accent }]}>
                        <Text style={[styles.topicName, { color: t.ink }]}>{t.name}</Text>
                        <Text numberOfLines={2} style={styles.topicDesc}>
                          {t.desc}
                        </Text>
                      </View>
                      {on && <SelectedBadge />}
                    </View>
                  </Selectable>
                );
              })}
            </View>

            {/* 野卡開關 */}
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: s.wild && !isSelf, disabled: isSelf }}
              disabled={isSelf}
              onPress={() => {
                haptic.tick();
                update({ wild: !s.wild });
              }}
              style={[styles.wildRow, isSelf && { opacity: 0.5 }]}
            >
              <Image source={TOPICS.wild.thumb} style={styles.wildThumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.wildTitle}>加入互動野卡</Text>
                <Text style={styles.wildSub}>{isSelf ? '一個人的時候先休息一下' : '偶爾放下問答，一起做一件小事'}</Text>
              </View>
              <View style={[styles.switch, s.wild && !isSelf && styles.switchOn]}>
                <View style={[styles.knob, s.wild && !isSelf && { transform: [{ translateX: 18 }] }]} />
              </View>
            </Pressable>
          </View>
        </ScrollView>

        {/* 底部開始按鈕 */}
        <View style={styles.footer}>
          <LinearGradient
            colors={['rgba(251,243,230,0)', 'rgba(251,243,230,0.95)', colors.bgBottom]}
            style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
          />
          <SafeAreaView edges={['bottom']} style={{ width: colW, paddingHorizontal: 20 }}>
            <PrimaryButton
              label="洗牌開始"
              sub={`${scene.name} · ${layerCount} 層 · ${deck.length} 張`}
              onPress={start}
              disabled={deck.length === 0}
            />
          </SafeAreaView>
        </View>
      </SafeAreaView>
    </View>
  );
}

function namePlaceholder(i: number, total: number) {
  if (i === 0) return '你的名字（選填）';
  if (total === 2) return '對方的名字（選填）';
  return `第 ${i + 1} 位的名字（選填）`;
}

/** 情境卡文字區固定高度：三行字（行高 22 + 16 + 18 + 間距 3）+ 上下內距 14 + 選取框 4，留一點餘裕 */
const SCENE_TEXT_H = 80;

const tileBase = {
  flex: 1,
  borderRadius: 14,
  overflow: 'hidden' as const,
  backgroundColor: colors.parchment,
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    zIndex: 5,
  },
  headerBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 56,
    backgroundColor: 'rgba(233,224,245,0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(201,162,90,0.5)',
  },
  headerTitle: { fontFamily: fonts.serifBold, fontSize: 17, color: colors.plum, letterSpacing: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,162,90,0.55)',
    backgroundColor: 'rgba(251,241,223,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipOn: { backgroundColor: '#7D69AD', borderColor: colors.goldLight, borderWidth: 1.5, ...shadow(6, 0.25) },
  chipGlyph: { fontFamily: fonts.displayRegular, fontSize: 15, color: colors.gold },
  chipLabel: { fontFamily: fonts.serifBold, fontSize: 14.5, color: colors.plum, letterSpacing: 1 },
  chipHint: { fontFamily: fonts.serif, fontSize: 10, color: colors.inkSoft, marginTop: 2 },
  players: { marginTop: 18 },
  playersHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 },
  playersMeta: { fontFamily: fonts.serif, color: colors.inkSoft, fontSize: 11.5, letterSpacing: 0.5 },
  nameRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,162,90,0.6)',
    minHeight: 44,
  },
  nameLabel: { fontFamily: fonts.serifBold, color: colors.plum, fontSize: 14, letterSpacing: 2 },
  nameIndex: { fontFamily: fonts.display, color: colors.goldDeep, fontSize: 17, width: 16, textAlign: 'center' },
  removeBtn: { width: 28, height: 28, borderRadius: 14 },
  addPlayer: { alignSelf: 'flex-start', paddingVertical: 12, paddingRight: 12 },
  addPlayerText: { fontFamily: fonts.serif, color: colors.goldDeep, fontSize: 13.5, letterSpacing: 1 },
  nameInput: {
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 8,
    outlineStyle: 'none',
  } as object,
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileOff: { borderWidth: 1, borderColor: 'rgba(201,162,90,0.45)' },
  tileOn: { borderWidth: 2, borderColor: colors.gold, ...shadow(8, 0.28) },
  sceneTile: tileBase,
  sceneText: { flex: 1, paddingHorizontal: 8, paddingVertical: 7, justifyContent: 'center' },
  sceneName: { fontFamily: fonts.serifBold, fontSize: 15, lineHeight: 22, color: colors.plum, letterSpacing: 1 },
  sceneMood: { fontFamily: fonts.serif, fontSize: 11, lineHeight: 16, color: colors.inkSoft, marginTop: 1 },
  sceneMeta: { fontFamily: fonts.display, fontSize: 12.5, lineHeight: 18, color: colors.goldDeep, marginTop: 2 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(3, 0.3),
  },
  randomTile: { flex: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  randomTitle: { fontFamily: fonts.serifBold, fontSize: 16, color: colors.plum, letterSpacing: 3 },
  randomSub: { fontFamily: fonts.serif, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
  randomEn: { fontFamily: fonts.display, fontSize: 20, color: colors.goldDeep },
  topicTile: tileBase,
  topicText: { flex: 1, paddingHorizontal: 8, justifyContent: 'center', borderTopWidth: 2 },
  // 文字區高 64（扣選取框剩 60）：標題 21 + 間距 2 + 描述最多兩行 30
  topicName: { fontFamily: fonts.serifBold, fontSize: 14.5, lineHeight: 21, letterSpacing: 1 },
  topicDesc: { fontFamily: fonts.serif, fontSize: 10, lineHeight: 15, color: colors.inkSoft, marginTop: 2 },
  wildRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,162,90,0.45)',
    backgroundColor: 'rgba(251,241,223,0.9)',
  },
  wildThumb: { width: 52, height: 52, borderRadius: 10 },
  wildTitle: { fontFamily: fonts.serifBold, fontSize: 14.5, color: '#6E4E17', letterSpacing: 1 },
  wildSub: { fontFamily: fonts.serif, fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D9D0E6',
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.gold },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFDF7', ...shadow(2, 0.25) },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 10,
    pointerEvents: 'box-none',
  },
});
