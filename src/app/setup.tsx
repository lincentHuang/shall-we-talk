import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop, Sparkle } from '../components/Backdrop';
import { GhostButton, IconButton, PrimaryButton } from '../components/Buttons';
import { CardBack } from '../components/Card';
import { BackIcon, CloseIcon, SoundIcon } from '../components/Icons';
import { SectionTitle } from '../components/Ornament';
import { Sheet } from '../components/Sheet';
import { Text } from '../components/Text';
import { EDITION_IDS, EDITIONS, PARTNERS, TOPICS, type CardKind, type Edition } from '../data/catalog';
import {
  buildDeck,
  cleanName,
  DEFAULT_SETTINGS,
  NAME_MAX,
  normalizePlayers,
  partnerOf,
  sceneOf,
  settingsToParams,
  stageSpans,
  type Settings,
} from '../lib/deck';
import { haptic } from '../lib/feedback';
import { setMusicOn, useMusicOn } from '../lib/music';
import { adultConfirmed, confirmAdult, loadSettings, saveSettings } from '../lib/storage';
import { colors, fonts, gradients, MAX_FONT_SCALE, radius, shadow, type, useTextHeight } from '../theme';

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
      <Sparkle size={12} color={colors.onPrimary} />
    </View>
  );
}

/** 特別版的介紹卡：卡背＋一句話＋這一版的流程 */
function EditionIntro({ ed }: { ed: Edition }) {
  const night = ed.id === 'afterdark';
  const ink = night ? colors.nightInk : colors.hearthInk;
  const sub = night ? colors.nightGold : colors.hearthGold;
  return (
    <LinearGradient
      colors={night ? gradients.night : gradients.hearth}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.intro}
    >
      <CardBack edition={ed.id} width={58} style={shadow(5, 0.3)} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.introEn, { color: sub }]}>{ed.en}</Text>
        <Text style={[styles.introTagline, { color: ink }]}>{ed.tagline}</Text>
        <Text style={[styles.introFlow, { color: sub }]}>
          {Object.values(ed.stages)
            .map((st) => st.name)
            .join(' → ')}
        </Text>
      </View>
    </LinearGradient>
  );
}

export default function Setup() {
  const params = useLocalSearchParams<{ edition?: string }>();
  const edition = EDITION_IDS.find((x) => x === params.edition) ?? 'classic';
  const ed = EDITIONS[edition];
  const { width } = useWindowDimensions();
  const colW = Math.min(width, 560);
  const gap = 12;
  const tileW = (colW - 40 - gap) / 2;
  // 卡片文字區高度跟著系統字體大小放大，避免字被卡片邊框切掉
  const textH = useTextHeight();
  // 底部浮動按鈕的實際高度（含手勢列），讓清單最後一項不會被蓋住
  const [footerH, setFooterH] = useState(140);

  const [s, setS] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    edition,
    scene: ed.scenes[0].id,
    players: normalizePlayers([], ed.players),
  }));
  useEffect(() => {
    loadSettings(edition).then(setS);
  }, [edition]);

  // 成人內容：第一次進來先確認年滿 18 歲
  const [ageGate, setAgeGate] = useState(false);
  useEffect(() => {
    if (ed.adult) adultConfirmed().then((ok) => setAgeGate(!ok));
  }, [ed.adult]);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const update = (patch: Partial<Settings>) => setS((prev) => ({ ...prev, ...patch }));

  const toggleTopic = (id: CardKind) =>
    setS((prev) => {
      const base = prev.random ? [] : prev.topics;
      const topics = base.includes(id) ? base.filter((t) => t !== id) : [...base, id];
      return { ...prev, topics, random: topics.length === 0 };
    });

  const setPlayer = (i: number, name: string) =>
    setS((prev) => ({ ...prev, players: prev.players.map((n, k) => (k === i ? cleanName(name) : n)) }));
  const addPlayer = () => {
    haptic.tick();
    setS((prev) => ({ ...prev, players: normalizePlayers([...prev.players, ''], ed.players) }));
  };
  const removePlayer = (i: number) =>
    setS((prev) => ({ ...prev, players: normalizePlayers(prev.players.filter((_, k) => k !== i), ed.players) }));

  const [minPlayers, maxPlayers] = ed.players;
  const scene = sceneOf(s);
  const deck = useMemo(() => buildDeck(s), [s]);
  const layerCount = useMemo(() => stageSpans(deck).length, [deck]);
  const isSelf = partnerOf(s) === 'self';
  const wild = ed.wild ? TOPICS[ed.wild] : null;
  const classic = ed.id === 'classic';
  const musicOn = useMusicOn();

  const start = () => {
    saveSettings(s);
    router.push({ pathname: '/play', params: settingsToParams(s) });
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop corners={false} edition={edition} />
      <SafeAreaView style={{ flex: 1, alignItems: 'center' }} edges={['top', 'left', 'right']}>
        <View style={[styles.header, { width: colW }]}>
          <View style={[styles.headerBg, { left: -(width - colW) / 2 - 1, right: -(width - colW) / 2 - 1 }]} />
          <IconButton label="返回" onPress={goBack}>
            <BackIcon />
          </IconButton>
          <Text style={styles.headerTitle}>{classic ? '準備牌局' : ed.name}</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView
          style={{ width: '100%' }}
          contentContainerStyle={{ alignItems: 'center', paddingBottom: footerH + 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: colW, paddingHorizontal: 20 }}>
            {!classic && <EditionIntro ed={ed} />}

            {/* ---------- I. 對象 ---------- */}
            {classic ? (
              <SectionTitle mark="I" title="談話對象" sub="今天想和誰聊聊？" />
            ) : (
              <SectionTitle
                mark="I"
                title="一起玩的人"
                sub={minPlayers === maxPlayers ? '只限你們兩個人，照順序輪流' : '爸媽、孩子、阿公阿嬤都可以一起玩'}
              />
            )}
            {classic && (
            <View style={styles.chips}>
              {PARTNERS.map((p) => {
                const on = s.partner === p.id;
                return (
                  <Selectable
                    key={p.id}
                    label={p.label}
                    selected={on}
                    onPress={() => update({ partner: p.id })}
                    style={{ width: (colW - 40 - gap * 2) / 3, height: textH(CHIP_TEXT_H, 20) }}
                  >
                    <View style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipGlyph, on && { color: colors.goldLight }]}>{p.glyph}</Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[styles.chipLabel, on && { color: colors.onPrimary }]}
                      >
                        {p.label}
                      </Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[styles.chipHint, on && { color: colors.onPrimarySoft }]}
                      >
                        {p.hint}
                      </Text>
                    </View>
                  </Selectable>
                );
              })}
            </View>
            )}
            {!isSelf && (
              <View style={[styles.players, !classic && { marginTop: 0 }]}>
                <View style={styles.playersHead}>
                  {classic && <Text style={styles.nameLabel}>一起玩的人</Text>}
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
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                      style={styles.nameInput}
                      maxLength={NAME_MAX}
                      returnKeyType="done"
                      accessibilityLabel={`第 ${i + 1} 位的名字`}
                    />
                    {s.players.length > minPlayers && (
                      <IconButton label={`移除第 ${i + 1} 位`} onPress={() => removePlayer(i)} style={styles.removeBtn}>
                        <CloseIcon size={13} color={colors.inkSoft} />
                      </IconButton>
                    )}
                  </View>
                ))}
                {s.players.length < maxPlayers && (
                  <Pressable accessibilityRole="button" onPress={addPlayer} style={styles.addPlayer}>
                    <Text style={styles.addPlayerText}>＋ 再加一位（最多 {maxPlayers} 人）</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* ---------- II. 情境 ---------- */}
            <View style={{ height: 30 }} />
            <SectionTitle mark="II" title={ed.copy.scene[0]} sub={ed.copy.scene[1]} />
            <View style={styles.grid}>
              {ed.scenes.map((sc) => {
                const on = s.scene === sc.id;
                return (
                  <Selectable
                    key={sc.id}
                    label={sc.name}
                    selected={on}
                    onPress={() => update({ scene: sc.id })}
                    style={{ width: tileW, height: tileW * 0.78 + textH(SCENE_TEXT_H, 21) }}
                  >
                    <View style={[styles.sceneTile, on ? styles.tileOn : styles.tileOff]}>
                      {sc.image ? (
                        <Image source={sc.image} style={{ width: '100%', height: tileW * 0.78 }} contentFit="cover" />
                      ) : (
                        // 沒有插畫的情境（深夜限定的節奏）：用大字張數代替
                        <LinearGradient
                          colors={gradients.night}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.sceneCount, { height: tileW * 0.78 }]}
                        >
                          <Text style={styles.sceneCountNum}>{sc.count}</Text>
                          <Text style={styles.sceneCountUnit}>cards</Text>
                        </LinearGradient>
                      )}
                      <View style={styles.sceneText}>
                        <Text numberOfLines={1} style={styles.sceneName}>
                          {sc.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.sceneMood}>
                          {sc.mood}
                        </Text>
                        <Text numberOfLines={1} style={styles.sceneMeta}>
                          {([0, ...sc.levels] as const).map((l) => ed.stages[l].mark).join(' · ')}　約 {sc.count} 張
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
            <SectionTitle mark="III" title={ed.copy.topic[0]} sub={ed.copy.topic[1]} />
            <Selectable
              label="完全隨機"
              selected={s.random}
              onPress={() => update({ random: true, topics: [] })}
              style={{ height: textH(RANDOM_TEXT_H, 29), marginBottom: gap }}
            >
              <LinearGradient
                colors={s.random ? gradients.primary : ['rgba(251,241,223,0.92)', 'rgba(243,228,200,0.92)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.randomTile, s.random ? styles.tileOn : styles.tileOff]}
              >
                <Sparkle size={22} color={s.random ? colors.goldLight : colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.randomTitle, s.random && { color: colors.onPrimary }]}>
                    完全隨機
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[styles.randomSub, s.random && { color: colors.onPrimarySoft }]}
                  >
                    {classic ? '所有主題混在一起，交給命運決定' : '全部混在一起，交給命運決定'}
                  </Text>
                </View>
                <Text style={[styles.randomEn, s.random && { color: colors.goldLight }]}>Fate</Text>
              </LinearGradient>
            </Selectable>
            <View style={styles.grid}>
              {ed.kinds.map((id) => {
                const t = TOPICS[id];
                const on = !s.random && s.topics.includes(id);
                return (
                  <Selectable
                    key={id}
                    label={t.name}
                    selected={on}
                    onPress={() => toggleTopic(id)}
                    style={{ width: tileW, height: tileW * 0.62 + textH(TOPIC_TEXT_H, 10) }}
                  >
                    <View style={[styles.topicTile, on ? styles.tileOn : styles.tileOff, { opacity: s.random ? 0.82 : 1 }]}>
                      <Image source={t.thumb} style={{ width: '100%', height: tileW * 0.62 }} contentFit="cover" />
                      <View style={[styles.topicText, { borderTopColor: t.accent }]}>
                        <Text numberOfLines={1} style={[styles.topicName, { color: t.ink }]}>
                          {t.name}
                        </Text>
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

            {/* 野卡開關（深夜限定沒有野卡：撩撥任務本身就是互動） */}
            {wild && (
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
              <Image source={wild.thumb} style={styles.wildThumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.wildTitle}>加入{wild.name}</Text>
                <Text style={styles.wildSub}>
                  {isSelf ? '一個人的時候先休息一下' : classic ? '偶爾放下問答，一起做一件小事' : wild.desc}
                </Text>
              </View>
              <View style={[styles.switch, s.wild && !isSelf && styles.switchOn]}>
                <View style={[styles.knob, s.wild && !isSelf && { transform: [{ translateX: 18 }] }]} />
              </View>
            </Pressable>
            )}

            {/* 背景音樂開關（每個版本、每一局都一樣，設定記在手機上） */}
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: musicOn }}
              onPress={() => {
                haptic.tick();
                setMusicOn(!musicOn);
              }}
              style={[styles.wildRow, { marginTop: wild ? 12 : 18 }]}
            >
              <View style={styles.musicIcon}>
                <SoundIcon size={24} color={colors.goldDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.wildTitle}>背景音樂</Text>
                <Text style={styles.wildSub}>依情境播放輕柔配樂</Text>
              </View>
              <View style={[styles.switch, musicOn && styles.switchOn]}>
                <View style={[styles.knob, musicOn && { transform: [{ translateX: 18 }] }]} />
              </View>
            </Pressable>
          </View>
        </ScrollView>

        {/* 底部開始按鈕 */}
        <View style={styles.footer} onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}>
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

      {ageGate && (
        <Sheet title="年滿 18 歲了嗎？" onClose={goBack}>
          <Text style={styles.gateText}>
            「{ed.name}」是給成年伴侶的情慾卡牌，內容包含親密接觸與性愛的提問和任務。
          </Text>
          <Text style={styles.gateText}>
            請確認你們都已年滿 18 歲、彼此同意一起玩。任何一張牌都可以換掉，喊「紅燈」就停下來。
          </Text>
          <PrimaryButton
            label="我們都滿 18 歲"
            onPress={() => {
              confirmAdult();
              setAgeGate(false);
            }}
            style={{ marginTop: 16 }}
          />
          <GhostButton label="先不要" onPress={goBack} style={{ marginTop: 10 }} />
        </Sheet>
      )}
    </View>
  );
}

function namePlaceholder(i: number, total: number) {
  if (i === 0) return '你的名字（選填）';
  if (total === 2) return '對方的名字（選填）';
  return `第 ${i + 1} 位的名字（選填）`;
}

/*
 * 卡片文字區的字高（字體 1 倍時，由字級表的 lineHeight 加總），
 * 實際高度 = 內距 + 字高 × 系統字體倍率（useTextHeight）。
 */
/** 對象小卡：符號＋名稱＋間距 2＋提示；內距另加上下留白與選取框 20 */
const CHIP_TEXT_H = type.glyph.lineHeight + type.subtitle.lineHeight + 2 + type.micro.lineHeight;
/** 情境卡：名稱＋氛圍＋層數（間距 3）；內距另加上下 14、選取框 4 與餘裕 */
const SCENE_TEXT_H = type.subtitle.lineHeight + type.footnote.lineHeight + type.scriptS.lineHeight + 3;
/** 完全隨機：標題＋間距 2＋說明；內距另加上下 10 與選取框 */
const RANDOM_TEXT_H = type.subtitle.lineHeight + 2 + type.footnote.lineHeight;
/** 主題卡：標題＋間距 2＋描述最多兩行；內距另加上框線 2、選取框 4 與餘裕 */
const TOPIC_TEXT_H = type.subtitle.lineHeight + 2 + type.micro.lineHeight * 2;

const tileBase = {
  flex: 1,
  borderRadius: radius.md,
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
  headerTitle: { ...type.heading, color: colors.plum, letterSpacing: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(201,162,90,0.55)',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.goldLight, borderWidth: 1.5, ...shadow(6, 0.25) },
  chipGlyph: { ...type.glyph, color: colors.gold },
  chipLabel: { ...type.subtitle, color: colors.plum, letterSpacing: 1 },
  chipHint: { ...type.micro, color: colors.inkSoft, marginTop: 2 },
  players: { marginTop: 18 },
  playersHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 },
  playersMeta: { ...type.footnote, color: colors.inkSoft, letterSpacing: 0.5, flexShrink: 1, textAlign: 'right' },
  nameRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineStrong,
    minHeight: 44,
  },
  nameLabel: { ...type.subtitle, color: colors.plum, letterSpacing: 2 },
  nameIndex: { ...type.numeralS, color: colors.goldDeep, width: 16, textAlign: 'center' },
  removeBtn: { width: 28, height: 28, borderRadius: 14 },
  addPlayer: { alignSelf: 'flex-start', paddingVertical: 12, paddingRight: 12 },
  addPlayerText: { ...type.callout, color: colors.goldDeep, letterSpacing: 1 },
  // 輸入框不設 lineHeight（iOS 會讓游標與文字錯位），高度交給 nameRow 的 minHeight
  nameInput: {
    flex: 1,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.ink,
    paddingVertical: 8,
    outlineStyle: 'none',
  } as object,
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileOff: { borderWidth: 1, borderColor: colors.line },
  tileOn: { borderWidth: 2, borderColor: colors.gold, ...shadow(8, 0.28) },
  sceneTile: tileBase,
  sceneText: { flex: 1, paddingHorizontal: 8, paddingVertical: 7, justifyContent: 'center' },
  sceneName: { ...type.subtitle, color: colors.plum, letterSpacing: 1 },
  sceneMood: { ...type.footnote, color: colors.inkSoft, marginTop: 1 },
  sceneMeta: { ...type.scriptS, color: colors.goldDeep, marginTop: 2 },
  sceneCount: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  sceneCountNum: { ...type.numeralXL, color: colors.nightGold },
  sceneCountUnit: { ...type.script, color: colors.nightInk, opacity: 0.8, letterSpacing: 2 },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    marginTop: 14,
    marginBottom: 24,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    ...shadow(6, 0.18),
  },
  introEn: { ...type.script, letterSpacing: 1 },
  introTagline: { ...type.subtitle, letterSpacing: 1 },
  introFlow: { ...type.caption, fontFamily: fonts.serifBold, letterSpacing: 1, marginTop: 2 },
  gateText: { ...type.body, color: colors.ink, letterSpacing: 0.5, marginBottom: 8 },
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
  randomTile: {
    flex: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  randomTitle: { ...type.subtitle, color: colors.plum, letterSpacing: 3 },
  randomSub: { ...type.footnote, color: colors.inkSoft, marginTop: 2 },
  randomEn: { ...type.numeral, color: colors.goldDeep },
  topicTile: tileBase,
  topicText: { flex: 1, paddingHorizontal: 8, justifyContent: 'center', borderTopWidth: 2 },
  topicName: { ...type.subtitle, letterSpacing: 1 },
  topicDesc: { ...type.micro, color: colors.inkSoft, marginTop: 2 },
  wildRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  wildThumb: { width: 52, height: 52, borderRadius: radius.sm },
  musicIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,162,90,0.16)',
  },
  wildTitle: { ...type.subtitle, color: '#6E4E17', letterSpacing: 1 },
  wildSub: { ...type.footnote, color: colors.inkSoft, marginTop: 2 },
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
