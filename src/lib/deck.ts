import { PARTNERS, SCENES, TOPIC_IDS, type PartnerId, type SceneId, type StageId, type TopicId } from '../data/catalog';
import { crowdOf, type Crowd } from '../data/guide';
import { QUESTIONS, fitsTable, phrase, type Question } from '../data/questions';

export type Settings = {
  partner: PartnerId;
  /** 一起玩的人，依輪流順序（2–8 位）；空字串代表沒填名字 */
  players: string[];
  scene: SceneId;
  /** 選定的主題；完全隨機時忽略 */
  topics: TopicId[];
  random: boolean;
  wild: boolean;
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const NAME_MAX = 12;

export const DEFAULT_SETTINGS: Settings = {
  partner: 'friend',
  players: ['', ''],
  scene: 'cafe',
  topics: [],
  random: true,
  wild: true,
};

/** 名字裡的「|」是路由參數的分隔字元，先拿掉 */
export function cleanName(name: string) {
  return name.replace(/\|/g, '').slice(0, NAME_MAX);
}

/** 補足／裁切成 2–8 位 */
export function normalizePlayers(players: readonly string[]): string[] {
  const list = players.slice(0, MAX_PLAYERS).map(cleanName);
  while (list.length < MIN_PLAYERS) list.push('');
  return list;
}

/** 牌桌上顯示的玩家稱呼；和自己對話時是空陣列 */
export function playerLabels(s: Settings): string[] {
  if (s.partner === 'self') return [];
  return s.players.map((n, i) => n.trim() || (i === 0 ? '你' : s.players.length === 2 ? '對方' : `玩家 ${i + 1}`));
}

/** 這一桌是兩個人、三人以上，還是和自己對話 */
export function tableCrowd(s: Settings): Crowd {
  return crowdOf(playerLabels(s).length);
}

export function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function wildAllowed(s: Settings) {
  return s.wild && s.partner !== 'self';
}

export function activeTopics(s: Settings): TopicId[] {
  return s.random || s.topics.length === 0 ? TOPIC_IDS : s.topics;
}

/** 牌桌上的一張牌：題目（{TA} 已換成這一桌的說法）＋它屬於哪一層 */
export type DeckCard = Question & { stage: StageId };

/** 主題之間輪流抽題，避免某個主題獨佔 */
function roundRobin(pools: Question[][], quota: number): Question[] {
  const picked: Question[] = [];
  while (picked.length < quota && pools.some((p) => p.length)) {
    for (const p of pools) {
      const q = p.pop();
      if (q) picked.push(q);
      if (picked.length >= quota) break;
    }
  }
  return picked;
}

/** 從野卡裡挑一張這一層的；沒有就往淺一層找，再沒有就隨便一張 */
function pickWild(pool: Question[], stage: StageId): Question | undefined {
  for (let l = stage; l >= 0; l--) {
    const i = pool.findIndex((w) => w.level === l);
    if (i >= 0) return pool.splice(i, 1)[0];
  }
  return pool.shift();
}

/**
 * 依設定組出一副牌，分成幾層依序排好：
 * - 第 0 層「暖身破冰」：不論選了哪些主題，都先用暖身題開場
 * - 之後依情境的深度一層一層往下（I 淺談 → II 走心 → III 深談），各層張數大致平均
 * - 某一層題目不夠時，缺的張數順延到下一層
 * - 互動野卡平均穿插在暖身之後的各層（不會是該層第一張），而且挑同一層深淺的
 */
export function buildDeck(s: Settings): DeckCard[] {
  const scene = SCENES.find((x) => x.id === s.scene) ?? SCENES[0];
  const crowd = tableCrowd(s);
  const fits = (q: Question) => fitsTable(q, s.partner, crowd);
  const toCard = (q: Question, stage: StageId): DeckCard => ({ ...q, text: phrase(q.text, crowd), stage });

  const warmCount = Math.min(5, Math.max(2, Math.round(scene.count * 0.17)));
  const warm = shuffle(QUESTIONS.filter((q) => q.level === 0 && q.kind !== 'wild' && fits(q))).slice(0, warmCount);

  const wildPool = wildAllowed(s) ? shuffle(QUESTIONS.filter((q) => q.kind === 'wild' && fits(q))) : [];
  const wildCount = Math.min(wildPool.length, wildPool.length ? Math.max(1, Math.round(scene.count / 7)) : 0);

  const levels = scene.levels;
  const rest = Math.max(0, scene.count - warm.length - wildCount);
  const base = Math.floor(rest / levels.length);
  const extra = rest - base * levels.length;

  const layers: DeckCard[][] = [warm.map((q) => toCard(q, 0))];
  let carry = 0;
  levels.forEach((level, i) => {
    // 餘數分給比較深的層
    const quota = base + (i >= levels.length - extra ? 1 : 0) + carry;
    const pools = activeTopics(s).map((t) => shuffle(QUESTIONS.filter((q) => q.kind === t && q.level === level && fits(q))));
    const picked = roundRobin(pools, quota);
    carry = quota - picked.length;
    if (picked.length) layers.push(shuffle(picked).map((q) => toCard(q, level)));
  });

  const deep = shuffle(layers.slice(1));
  for (let k = 0; k < wildCount && deep.length; k++) {
    const layer = deep[k % deep.length];
    const stage = layer[0].stage;
    const w = pickWild(wildPool, stage);
    if (!w) break;
    const at = 1 + Math.floor(Math.random() * layer.length);
    layer.splice(at, 0, toCard(w, stage));
  }
  return layers.flat();
}

export type StageSpan = { stage: StageId; start: number; end: number };

/** 這副牌依序有哪幾層，各自的範圍 [start, end) */
export function stageSpans(deck: readonly DeckCard[]): StageSpan[] {
  const spans: StageSpan[] = [];
  deck.forEach((c, i) => {
    const last = spans[spans.length - 1];
    if (last && last.stage === c.stage) last.end = i + 1;
    else spans.push({ stage: c.stage, start: i, end: i + 1 });
  });
  return spans;
}

/** 把第 from 張移到第 to 張（從手牌挑中的牌換到最上面） */
export function moveCard<T>(deck: readonly T[], from: number, to: number): T[] {
  const d = deck.slice();
  const [c] = d.splice(from, 1);
  d.splice(to, 0, c);
  return d;
}

/** 只洗 [from, to) 這一段，已抽過的牌與後面幾層都不動 */
export function reshuffleRange<T>(deck: readonly T[], from: number, to: number): T[] {
  return [...deck.slice(0, from), ...shuffle(deck.slice(from, to)), ...deck.slice(to)];
}

/* ---------- 讓設定可以放進路由參數（網頁可重新整理／分享） ---------- */

export function settingsToParams(s: Settings): Record<string, string> {
  return {
    partner: s.partner,
    players: s.players.map(cleanName).join('|'),
    scene: s.scene,
    topics: s.topics.join(','),
    random: s.random ? '1' : '0',
    wild: s.wild ? '1' : '0',
  };
}

export function settingsFromParams(p: Record<string, string | string[] | undefined>): Settings {
  const get = (k: string) => {
    const v = p[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const topics = (get('topics') ?? '')
    .split(',')
    .filter((t): t is TopicId => (TOPIC_IDS as string[]).includes(t));
  const partner = PARTNERS.find((x) => x.id === get('partner'))?.id;
  const scene = SCENES.find((x) => x.id === get('scene'))?.id;
  const players = get('players');
  return {
    partner: partner ?? DEFAULT_SETTINGS.partner,
    // 舊網址只有一個 name（對方的名字）
    players: normalizePlayers(players != null ? players.split('|') : ['', get('name') ?? '']),
    scene: scene ?? DEFAULT_SETTINGS.scene,
    topics,
    random: get('random') !== '0' || topics.length === 0,
    wild: get('wild') !== '0',
  };
}
