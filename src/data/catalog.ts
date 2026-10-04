import type { ImageSourcePropType } from 'react-native';

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

export type SceneId = 'cafe' | 'latenight' | 'walk' | 'dinner' | 'travel' | 'party';
export type Level = 1 | 2 | 3;

export type Scene = {
  id: SceneId;
  name: string;
  mood: string;
  image: ImageSourcePropType;
  /** 此情境會出現的題目深度 */
  levels: Level[];
  /** 一局的牌數 */
  count: number;
};

export const SCENES: Scene[] = [
  {
    id: 'cafe',
    name: '咖啡廳小聊',
    mood: '輕鬆不尷尬的一杯咖啡',
    image: require('../../assets/scenes/cafe.jpg'),
    levels: [1, 2],
    count: 15,
  },
  {
    id: 'latenight',
    name: '深夜長聊',
    mood: '夜深了，適合說真心話',
    image: require('../../assets/scenes/latenight.jpg'),
    levels: [1, 2, 3],
    count: 30,
  },
  {
    id: 'walk',
    name: '散步漫談',
    mood: '並肩走著，想到什麼聊什麼',
    image: require('../../assets/scenes/walk.jpg'),
    levels: [1, 2],
    count: 18,
  },
  {
    id: 'dinner',
    name: '微醺餐桌',
    mood: '有點醉意，話匣子打開了',
    image: require('../../assets/scenes/dinner.jpg'),
    levels: [1, 2, 3],
    count: 22,
  },
  {
    id: 'travel',
    name: '旅途之中',
    mood: '漫長的車程，慢慢聊',
    image: require('../../assets/scenes/travel.jpg'),
    levels: [1, 2, 3],
    count: 25,
  },
  {
    id: 'party',
    name: '朋友聚會',
    mood: '一群人輪流抽，熱鬧又走心',
    image: require('../../assets/scenes/party.jpg'),
    levels: [1, 2],
    count: 24,
  },
];

/* ---------- 主題 ---------- */

export type TopicId = 'icebreak' | 'memory' | 'values' | 'love' | 'dreams' | 'heart' | 'whatif';
export type CardKind = TopicId | 'wild';

export type Topic = {
  id: CardKind;
  name: string;
  en: string;
  desc: string;
  /** 卡面文字顏色，與卡框色調對應 */
  ink: string;
  accent: string;
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
