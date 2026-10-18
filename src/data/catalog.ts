import type { ImageSourcePropType } from 'react-native';

import type { MusicId } from '../lib/music';

/* ---------- 談話對象 ---------- */

export type PartnerId = 'friend' | 'crush' | 'partner' | 'family' | 'colleague' | 'stranger' | 'self';

export type Partner = {
  id: PartnerId;
  label: string;
  hint: string;
  glyph: string;
};

export const PARTNERS: Partner[] = [
  { id: 'friend', label: '朋友', hint: '想更靠近一點', glyph: '✦' },
  { id: 'crush', label: '曖昧對象', hint: '還在試探心意', glyph: '❦' },
  { id: 'partner', label: '戀人・伴侶', hint: '重新認識彼此', glyph: '♡' },
  { id: 'family', label: '家人', hint: '熟悉卻少深聊', glyph: '✧' },
  { id: 'colleague', label: '同事', hint: '工作外的一面', glyph: '◇' },
  { id: 'stranger', label: '新朋友', hint: '從零開始認識', glyph: '☆' },
  { id: 'self', label: '我自己', hint: '和自己對話', glyph: '☾' },
];

/* ---------- 情境 ---------- */

/** 經典版是 cafe、latenight⋯⋯；特別版的情境以版本代號開頭（ad-、pa-） */
export type SceneId = string;
export type Level = 1 | 2 | 3;

export type Scene = {
  id: SceneId;
  name: string;
  mood: string;
  /** 情境插畫；沒有的話選單上改用大字張數 */
  image?: ImageSourcePropType;
  /** 此情境會出現的題目深度 */
  levels: Level[];
  /** 一局的牌數 */
  count: number;
  /** 每一層固定的張數（第 0 個是暖身層）；沒有就依 count 自動分配 */
  plan?: number[];
  /** 這個情境的背景音樂；沒有就不放 */
  music?: MusicId;
};

export const SCENES: Scene[] = [
  {
    id: 'cafe',
    name: '咖啡廳小聊',
    mood: '輕鬆不尷尬的一杯咖啡',
    image: require('../../assets/scenes/cafe.jpg'),
    levels: [1, 2],
    count: 15,
    music: 'cafe',
  },
  {
    id: 'latenight',
    name: '深夜長聊',
    mood: '夜深了，適合說真心話',
    image: require('../../assets/scenes/latenight.jpg'),
    levels: [1, 2, 3],
    count: 30,
    music: 'latenight',
  },
  {
    id: 'walk',
    name: '散步漫談',
    mood: '並肩走著，想到什麼聊什麼',
    image: require('../../assets/scenes/walk.jpg'),
    levels: [1, 2],
    count: 18,
    music: 'walk',
  },
  {
    id: 'dinner',
    name: '微醺餐桌',
    mood: '有點醉意，話匣子打開了',
    image: require('../../assets/scenes/dinner.jpg'),
    levels: [1, 2, 3],
    count: 22,
    music: 'dinner',
  },
  {
    id: 'travel',
    name: '旅途之中',
    mood: '漫長的車程，慢慢聊',
    image: require('../../assets/scenes/travel.jpg'),
    levels: [1, 2, 3],
    count: 25,
    music: 'travel',
  },
  {
    id: 'party',
    name: '朋友聚會',
    mood: '一群人輪流抽，熱鬧又走心',
    image: require('../../assets/scenes/party.jpg'),
    levels: [1, 2],
    count: 24,
    music: 'party',
  },
];

/* ---------- 主題 ---------- */

export type TopicId = 'icebreak' | 'memory' | 'values' | 'love' | 'dreams' | 'heart' | 'whatif';
/** 深夜限定的四種牌 */
export type AfterDarkKind = 'ad-talk' | 'ad-touch' | 'ad-fantasy' | 'ad-pose';
/** 爸媽聊聊的三種主題＋野卡 */
export type ParentsKind = 'pa-past' | 'pa-home' | 'pa-heart' | 'pa-wild';
export type CardKind = TopicId | 'wild' | AfterDarkKind | ParentsKind;

export type Topic = {
  id: CardKind;
  name: string;
  en: string;
  desc: string;
  /** 淺色底（選單、收藏清單）上的文字顏色；卡面沒有另外指定時也用它 */
  ink: string;
  accent: string;
  /** 卡面留白是深色時，題目改用淺色字（faceInk），標題與頁尾用 faceTrim */
  faceInk?: string;
  faceTrim?: string;
  /** 輪到的人要做的事，預設「回答」 */
  act?: string;
  face: ImageSourcePropType;
  thumb: ImageSourcePropType;
};

export const TOPICS: Record<CardKind, Topic> = {
  icebreak: {
    id: 'icebreak',
    name: '初見破冰',
    en: 'First Light',
    desc: '輕鬆暖身，從小事開始認識',
    ink: '#4E3F6B',
    accent: '#B9A6DA',
    face: require('../../assets/cards/icebreak.jpg'),
    thumb: require('../../assets/topics/icebreak.jpg'),
  },
  memory: {
    id: 'memory',
    name: '回憶與成長',
    en: 'Memories',
    desc: '那些把你變成現在的你的事',
    ink: '#6B4626',
    accent: '#D9A866',
    face: require('../../assets/cards/memory.jpg'),
    thumb: require('../../assets/topics/memory.jpg'),
  },
  values: {
    id: 'values',
    name: '價值與信念',
    en: 'Lantern',
    desc: '你在乎什麼、相信什麼',
    ink: '#2F5A52',
    accent: '#8DBFAF',
    face: require('../../assets/cards/values.jpg'),
    thumb: require('../../assets/topics/values.jpg'),
  },
  love: {
    id: 'love',
    name: '愛與關係',
    en: 'Entwined',
    desc: '關於愛、陪伴，與我們之間',
    ink: '#7D3B50',
    accent: '#E3A5B5',
    face: require('../../assets/cards/love.jpg'),
    thumb: require('../../assets/topics/love.jpg'),
  },
  dreams: {
    id: 'dreams',
    name: '夢想與未來',
    en: 'Crescent',
    desc: '想去的地方、想成為的人',
    ink: '#333C70',
    accent: '#8E98D4',
    face: require('../../assets/cards/dreams.jpg'),
    thumb: require('../../assets/topics/dreams.jpg'),
  },
  heart: {
    id: 'heart',
    name: '真心與脆弱',
    en: 'Rain & Bloom',
    desc: '比較少說出口的那一面',
    ink: '#434A78',
    accent: '#A3A9D6',
    face: require('../../assets/cards/heart.jpg'),
    thumb: require('../../assets/topics/heart.jpg'),
  },
  whatif: {
    id: 'whatif',
    name: '假如與奇想',
    en: 'What If',
    desc: '天馬行空，看見對方的想像力',
    ink: '#2C625B',
    accent: '#8FD6C8',
    face: require('../../assets/cards/whatif.jpg'),
    thumb: require('../../assets/topics/whatif.jpg'),
  },
  wild: {
    id: 'wild',
    name: '互動野卡',
    en: 'Wild Card',
    desc: '放下手機，做一件事',
    ink: '#6E4E17',
    accent: '#E3C27A',
    face: require('../../assets/cards/wild.jpg'),
    thumb: require('../../assets/topics/wild.jpg'),
  },

  /* 深夜限定：卡面留白是深紫絨布，字用奶油色、標題用金色 */
  'ad-talk': {
    id: 'ad-talk',
    name: '情話問答',
    en: 'Whisper',
    desc: '說出口的慾望，比想像中更撩人',
    ink: '#6B2440',
    accent: '#C45C7A',
    faceInk: '#F6E9D6',
    faceTrim: '#E3C27A',
    face: require('../../assets/cards/afterdark/talk.jpg'),
    thumb: require('../../assets/topics/afterdark/talk.jpg'),
  },
  'ad-touch': {
    id: 'ad-touch',
    name: '撩撥任務',
    en: 'Touch',
    desc: '放下手機，用手、用唇去做',
    ink: '#7A1F2E',
    accent: '#D0605E',
    faceInk: '#F6E9D6',
    faceTrim: '#E3C27A',
    act: '出手',
    face: require('../../assets/cards/afterdark/touch.jpg'),
    thumb: require('../../assets/topics/afterdark/touch.jpg'),
  },
  'ad-fantasy': {
    id: 'ad-fantasy',
    name: '祕密幻想',
    en: 'Fantasy',
    desc: '想試的、不敢說的，都可以聊',
    ink: '#4A2A6B',
    accent: '#9A74C8',
    faceInk: '#F6E9D6',
    faceTrim: '#E3C27A',
    act: '坦白',
    face: require('../../assets/cards/afterdark/fantasy.jpg'),
    thumb: require('../../assets/topics/afterdark/fantasy.jpg'),
  },
  'ad-pose': {
    id: 'ad-pose',
    name: '姿勢圖解',
    en: 'Position',
    desc: '換個姿勢，附圖說明怎麼做',
    ink: '#2E3A6B',
    accent: '#7D8FD0',
    faceInk: '#F6E9D6',
    faceTrim: '#E3C27A',
    act: '帶頭',
    face: require('../../assets/cards/afterdark/pose.jpg'),
    thumb: require('../../assets/topics/afterdark/pose.jpg'),
  },

  /* 爸媽聊聊 */
  'pa-past': {
    id: 'pa-past',
    name: '從前從前',
    en: 'Once Upon',
    desc: '爸媽年輕時，和你小時候',
    ink: '#6B4626',
    accent: '#D9A866',
    face: require('../../assets/cards/parents/past.jpg'),
    thumb: require('../../assets/topics/parents/past.jpg'),
  },
  'pa-home': {
    id: 'pa-home',
    name: '我們這一家',
    en: 'Our Home',
    desc: '餐桌、家規，和家裡的笑話',
    ink: '#3F5A2E',
    accent: '#9DBB7E',
    face: require('../../assets/cards/parents/home.jpg'),
    thumb: require('../../assets/topics/parents/home.jpg'),
  },
  'pa-heart': {
    id: 'pa-heart',
    name: '想對你說',
    en: 'Unsaid',
    desc: '謝謝、對不起，和我很擔心你',
    ink: '#7D3B50',
    accent: '#E3A5B5',
    face: require('../../assets/cards/parents/heart.jpg'),
    thumb: require('../../assets/topics/parents/heart.jpg'),
  },
  'pa-wild': {
    id: 'pa-wild',
    name: '一起做件事',
    en: 'Together',
    desc: '放下手機，一家人一起動起來',
    ink: '#6E4E17',
    accent: '#E3C27A',
    face: require('../../assets/cards/parents/wild.jpg'),
    thumb: require('../../assets/topics/parents/wild.jpg'),
  },
};

export const TOPIC_IDS: TopicId[] = ['icebreak', 'memory', 'values', 'love', 'dreams', 'heart', 'whatif'];

export const CARD_BACK = require('../../assets/cards/back.jpg');

export const LEVEL_MARK: Record<Level, string> = { 1: 'I', 2: 'II', 3: 'III' };
export const LEVEL_NAME: Record<Level, string> = { 1: '淺談', 2: '走心', 3: '深談' };

/* ---------- 牌局的分層：先暖身，再由淺入深，一層聊完才往下 ---------- */

export type StageId = 0 | Level;

export type Stage = { id: StageId; mark: string; name: string; intro: string };

export const STAGES: Record<StageId, Stage> = {
  0: { id: 0, mark: '✧', name: '暖身破冰', intro: '從輕鬆的小事開始，先讓心情放鬆下來。' },
  1: { id: 1, mark: LEVEL_MARK[1], name: LEVEL_NAME[1], intro: '聊聊日常和喜好，從熟悉的地方開始。' },
  2: { id: 2, mark: LEVEL_MARK[2], name: LEVEL_NAME[2], intro: '說說經歷和感受，往心裡再走一點。' },
  3: { id: 3, mark: LEVEL_MARK[3], name: LEVEL_NAME[3], intro: '那些比較少說出口的事。慢慢來，不勉強。' },
};

/* ---------- 版本：經典版，以及有自己題庫、流程與卡牌美術的特別版 ---------- */

export type EditionId = 'classic' | 'afterdark' | 'parents';

export type Edition = {
  id: EditionId;
  name: string;
  en: string;
  /** 首頁入口與準備頁上的一句話 */
  tagline: string;
  /** 固定的談話對象；經典版由玩家自己選 */
  partner?: PartnerId;
  /** 一起玩的人數範圍 */
  players: [min: number, max: number];
  /** 可以選的主題（不含野卡） */
  kinds: CardKind[];
  /** 穿插在各層裡的互動野卡 */
  wild?: CardKind;
  /** 暖身層是否也只抽選定的主題；經典版的暖身不分主題 */
  warmByTopic: boolean;
  /** 某一層裡某種牌要多抽幾倍（預設 1，各主題輪流抽） */
  weights?: Partial<Record<StageId, Partial<Record<CardKind, number>>>>;
  stages: Record<StageId, Stage>;
  scenes: Scene[];
  back: ImageSourcePropType;
  /** 成人內容，進入前要確認年滿 18 歲 */
  adult?: boolean;
  /** 準備頁三個段落的標題與說明 */
  copy: { scene: [string, string]; topic: [string, string] };
  /** 依階段換背景音樂（優先於情境的 music），例如深夜限定隨四個階段升溫 */
  musicByStage?: Partial<Record<StageId, MusicId>>;
};

export const EDITIONS: Record<EditionId, Edition> = {
  classic: {
    id: 'classic',
    name: '經典版',
    en: 'Classic',
    tagline: '抽一張牌，讓話題慢慢變深',
    players: [2, 8],
    kinds: TOPIC_IDS,
    wild: 'wild',
    warmByTopic: false,
    stages: STAGES,
    scenes: SCENES,
    back: CARD_BACK,
    copy: {
      scene: ['聊天情境', '情境會決定題目的深淺與張數'],
      topic: ['話題主題', '可複選；不選就是完全隨機'],
    },
  },
  afterdark: {
    id: 'afterdark',
    name: '深夜限定',
    en: 'After Dark',
    tagline: '從調情到溫存，兩個人的夜晚',
    partner: 'partner',
    players: [2, 2],
    kinds: ['ad-talk', 'ad-touch', 'ad-fantasy', 'ad-pose'],
    warmByTopic: true,
    // 前夕、激情以動手為主：撩撥任務抽兩倍（姿勢圖解只在激情出現）
    weights: { 1: { 'ad-touch': 2 }, 2: { 'ad-touch': 2 } },
    stages: {
      0: { id: 0, mark: 'I', name: '調情', intro: '衣服先別脫。靠近一點，用眼神和說話慢慢升溫。' },
      1: { id: 1, mark: 'II', name: '前夕', intro: '親吻、觸碰、慢慢褪去衣服。不急，越慢越好。' },
      2: { id: 2, mark: 'III', name: '激情', intro: '交給身體，也記得說出感覺。隨時可以喊「黃燈」。' },
      3: { id: 3, mark: 'IV', name: '收尾', intro: '抱著彼此，喝口水、蓋好被子，把溫度留久一點。' },
    },
    scenes: [
      { id: 'ad-quick', name: '等不及了', mood: '十張牌，一路升溫', levels: [1, 2, 3], count: 10, plan: [3, 3, 3, 1] },
      { id: 'ad-night', name: '今晚剛好', mood: '四個階段都走一遍', levels: [1, 2, 3], count: 16, plan: [4, 5, 5, 2] },
      { id: 'ad-slow', name: '慢慢來', mood: '整夜不趕，細細品嘗', levels: [1, 2, 3], count: 24, plan: [6, 7, 8, 3] },
    ],
    back: require('../../assets/cards/afterdark/back.jpg'),
    adult: true,
    copy: {
      scene: ['今晚的節奏', '張數不同，四個階段都會走完'],
      topic: ['牌組', '可複選；不選就全部混在一起'],
    },
    // 調情、前夕、激情、收尾各有一首，換階段時交叉淡入
    musicByStage: { 0: 'ad-flirt', 1: 'ad-prelude', 2: 'ad-passion', 3: 'ad-after' },
  },
  parents: {
    id: 'parents',
    name: '爸媽聊聊',
    en: 'Mom & Dad',
    tagline: '聽爸媽說從前，也說心裡話',
    partner: 'family',
    players: [2, 8],
    kinds: ['pa-past', 'pa-home', 'pa-heart'],
    wild: 'pa-wild',
    warmByTopic: true,
    stages: {
      0: { id: 0, mark: '✧', name: '暖暖身', intro: '先從輕鬆的小事聊起，笑一笑就熱絡了。' },
      1: { id: 1, mark: 'I', name: '家常話', intro: '聊聊日常和家裡的習慣，那些天天見卻沒問過的事。' },
      2: { id: 2, mark: 'II', name: '老故事', intro: '爸媽年輕時、你小時候，把記憶翻出來對一對。' },
      3: { id: 3, mark: 'III', name: '心裡話', intro: '謝謝、對不起、我很擔心你。慢慢說，不勉強。' },
    },
    scenes: [
      { id: 'pa-dinner', name: '飯後閒聊', mood: '收完碗筷，再多坐一會兒', image: require('../../assets/scenes/dinner.jpg'), levels: [1, 2], count: 15, music: 'home' },
      { id: 'pa-walk', name: '陪爸媽散步', mood: '並肩走一段，聊聊從前', image: require('../../assets/scenes/walk.jpg'), levels: [1, 2], count: 12, music: 'walk' },
      { id: 'pa-holiday', name: '回家過節', mood: '一家人難得到齊', image: require('../../assets/scenes/party.jpg'), levels: [1, 2, 3], count: 24, music: 'holiday' },
      { id: 'pa-night', name: '睡前長聊', mood: '夜深了，說說心裡話', image: require('../../assets/scenes/latenight.jpg'), levels: [1, 2, 3], count: 28, music: 'latenight' },
    ],
    back: require('../../assets/cards/parents/back.jpg'),
    copy: {
      scene: ['在哪裡聊', '情境會決定題目的深淺與張數'],
      topic: ['話題主題', '可複選；不選就是完全隨機'],
    },
  },
};

/** 也是首頁左右滑動的順序 */
export const EDITION_IDS: EditionId[] = ['classic', 'afterdark', 'parents'];

/** 每一種牌屬於哪個版本，卡面頁尾的層名要用那個版本的 */
export function editionOfKind(kind: CardKind): Edition {
  if (kind.startsWith('ad-')) return EDITIONS.afterdark;
  if (kind.startsWith('pa-')) return EDITIONS.parents;
  return EDITIONS.classic;
}
