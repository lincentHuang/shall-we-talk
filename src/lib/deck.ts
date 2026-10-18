import {
  EDITION_IDS,
  EDITIONS,
  PARTNERS,
  type CardKind,
  type Edition,
  type EditionId,
  type PartnerId,
  type Scene,
  type SceneId,
  type StageId,
} from '../data/catalog';
import { crowdOf, type Crowd } from '../data/guide';
import { QUESTIONS, fitsTable, phrase, type Question } from '../data/questions';

export type Settings = {
  /** 經典版或特別版；特別版有自己的題庫、分層、情境與卡牌美術 */
  edition: EditionId;
  /** 談話對象；特別版固定，見 partnerOf() */
  partner: PartnerId;
  /** 一起玩的人，依輪流順序（2–8 位）；空字串代表沒填名字 */
  players: string[];
  scene: SceneId;
  /** 選定的主題；完全隨機時忽略 */
  topics: CardKind[];
  random: boolean;
  wild: boolean;
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const NAME_MAX = 12;

export const DEFAULT_SETTINGS: Settings = {
  edition: 'classic',
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

export function editionOf(s: Pick<Settings, 'edition'>): Edition {
  return EDITIONS[s.edition] ?? EDITIONS.classic;
}

/** 這一局的談話對象：特別版固定（深夜限定是伴侶、爸媽聊聊是家人） */
export function partnerOf(s: Settings): PartnerId {
  return editionOf(s).partner ?? s.partner;
}

/** 這一局可以選的情境 */
export function scenesOf(s: Pick<Settings, 'edition'>): Scene[] {
  return editionOf(s).scenes;
}

export function sceneOf(s: Settings): Scene {
  const scenes = scenesOf(s);
  return scenes.find((x) => x.id === s.scene) ?? scenes[0];
}

/** 補足／裁切人數（預設 2–8 位；深夜限定固定 2 位） */
export function normalizePlayers(players: readonly string[], [min, max]: [number, number] = [MIN_PLAYERS, MAX_PLAYERS]): string[] {
  const list = players.slice(0, max).map(cleanName);
  while (list.length < min) list.push('');
  return list;
}

/** 牌桌上顯示的玩家稱呼；和自己對話時是空陣列 */
export function playerLabels(s: Settings): string[] {
  if (partnerOf(s) === 'self') return [];
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
  return s.wild && !!editionOf(s).wild && partnerOf(s) !== 'self';
}

export function activeTopics(s: Settings): CardKind[] {
  const { kinds } = editionOf(s);
  const picked = s.topics.filter((t) => kinds.includes(t));
  return s.random || picked.length === 0 ? kinds : picked;
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

/** 每一層裡通用題最多佔的比例，其餘都用這個談話對象的專屬題；專屬題不夠時再用通用題補 */
const GENERIC_SHARE = 0.3;

/** 專屬題先抽，通用題只補一小部分；任一邊不夠時由另一邊補足 */
function blend(mine: Question[][], common: Question[][], quota: number): Question[] {
  const a = roundRobin(mine, Math.ceil(quota * (1 - GENERIC_SHARE)));
  const b = roundRobin(common, quota - a.length);
  return [...a, ...b, ...roundRobin(mine, quota - a.length - b.length)];
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
 * - 每一層以這個談話對象的專屬題為主，通用題最多佔 GENERIC_SHARE
 * - 第 0 層「暖身破冰」：經典版不論選了哪些主題，都先用暖身題開場；特別版只抽選定主題的暖身題
 * - 之後依情境的深度一層一層往下（I 淺談 → II 走心 → III 深談），各層張數大致平均；
 *   情境有 plan 時照 plan 的張數（深夜限定：調情 → 前夕 → 激情 → 收尾）
 * - 某一層題目不夠時，缺的張數順延到下一層
 * - 互動野卡平均穿插在暖身之後的各層（不會是該層第一張），而且挑同一層深淺的
 */
export function buildDeck(s: Settings): DeckCard[] {
  const ed = editionOf(s);
  const scene = sceneOf(s);
  const crowd = tableCrowd(s);
  const topics = activeTopics(s);
  const fits = (q: Question) => fitsTable(q, partnerOf(s), crowd);
  const toCard = (q: Question, stage: StageId): DeckCard => ({ ...q, text: phrase(q.text, crowd), stage });

  const warmCount = scene.plan ? scene.plan[0] : Math.min(5, Math.max(2, Math.round(scene.count * 0.17)));
  const split = (qs: Question[]) => [shuffle(qs.filter((q) => q.partner)), shuffle(qs.filter((q) => !q.partner))];

  const warmKinds: CardKind[] = ed.warmByTopic ? topics : ed.kinds;
  const [warmMine, warmCommon] = split(QUESTIONS.filter((q) => q.level === 0 && warmKinds.includes(q.kind) && fits(q)));
  const warm = shuffle(blend([warmMine], [warmCommon], warmCount));

  // 野卡同一層裡先挑專屬的
  const wildPool = wildAllowed(s) ? split(QUESTIONS.filter((q) => q.kind === ed.wild && fits(q))).flat() : [];
  const wildCount = Math.min(wildPool.length, wildPool.length ? Math.max(1, Math.round(scene.count / 7)) : 0);

  const levels = scene.levels;
  const rest = Math.max(0, scene.count - warm.length - wildCount);
  const base = Math.floor(rest / levels.length);
  const extra = rest - base * levels.length;

  const layers: DeckCard[][] = [warm.map((q) => toCard(q, 0))];
  // 暖身題不夠時，缺的張數也順延到下一層
  let carry = warmCount - warm.length;
  levels.forEach((level, i) => {
    // 餘數分給比較深的層
    const quota = (scene.plan ? scene.plan[i + 1] : base + (i >= levels.length - extra ? 1 : 0)) + carry;
    // 權重 n 就把同一個題池放 n 次，輪流抽時每一輪會抽到它 n 次
    const pools = topics.flatMap((t) => {
      const pool = split(QUESTIONS.filter((q) => q.kind === t && q.level === level && fits(q)));
      return Array.from({ length: ed.weights?.[level]?.[t] ?? 1 }, () => pool);
    });
    const picked = blend(
      pools.map((p) => p[0]),
      pools.map((p) => p[1]),
      quota,
    );
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
    edition: s.edition,
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
  const edition = EDITION_IDS.find((x) => x === get('edition')) ?? 'classic';
  const ed = EDITIONS[edition];
  const topics = (get('topics') ?? '')
    .split(',')
    .filter((t): t is CardKind => (ed.kinds as string[]).includes(t));
  const partner = PARTNERS.find((x) => x.id === get('partner'))?.id;
  const scene = ed.scenes.find((x) => x.id === get('scene'))?.id;
  const players = get('players');
  return {
    edition,
    partner: partner ?? DEFAULT_SETTINGS.partner,
    // 舊網址只有一個 name（對方的名字）
    players: normalizePlayers(players != null ? players.split('|') : ['', get('name') ?? ''], ed.players),
    scene: scene ?? ed.scenes[0].id,
    topics,
    random: get('random') !== '0' || topics.length === 0,
    wild: get('wild') !== '0',
  };
}
