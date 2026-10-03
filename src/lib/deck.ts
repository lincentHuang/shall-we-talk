import { PARTNERS, SCENES, TOPIC_IDS, type PartnerId, type SceneId, type TopicId } from '../data/catalog';
import { QUESTIONS, fitsPartner, type Question } from '../data/questions';

export type Settings = {
  partner: PartnerId;
  partnerName: string;
  scene: SceneId;
  /** 選定的主題；完全隨機時忽略 */
  topics: TopicId[];
  random: boolean;
  wild: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  partner: 'friend',
  partnerName: '',
  scene: 'cafe',
  topics: [],
  random: true,
  wild: true,
};

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

/**
 * 依設定組出一副牌：
 * - 情境決定深度範圍與張數
 * - 主題之間輪流抽題，避免某個主題獨佔
 * - 指定主題時嚴格「由淺入深」；完全隨機則打散主題、深度大致漸進
 * - 互動野卡隨機插入（不會是前兩張）
 */
export function buildDeck(s: Settings): Question[] {
  const scene = SCENES.find((x) => x.id === s.scene) ?? SCENES[0];
  const pools = activeTopics(s).map((t) =>
    shuffle(QUESTIONS.filter((q) => q.kind === t && scene.levels.includes(q.level) && fitsPartner(q, s.partner))),
  );

  const wildPool = wildAllowed(s) ? shuffle(QUESTIONS.filter((q) => q.kind === 'wild')) : [];
  const wildCount = Math.min(wildPool.length, wildPool.length ? Math.max(1, Math.round(scene.count / 7)) : 0);
  const target = scene.count - wildCount;

  const picked: Question[] = [];
  while (picked.length < target && pools.some((p) => p.length)) {
    for (const p of pools) {
      const q = p.pop();
      if (q) picked.push(q);
      if (picked.length >= target) break;
    }
  }

  // 完全隨機：主題全混、相鄰深度會交錯，但整體仍大致由淺入深，避免一開場就太沉重
  const ordered = s.random
    ? picked
        .map((q) => ({ q, k: q.level + Math.random() * 1.6 }))
        .sort((a, b) => a.k - b.k)
        .map((x) => x.q)
    : shuffle(picked).sort((a, b) => a.level - b.level);

  for (const w of wildPool.slice(0, wildCount)) {
    const at = 2 + Math.floor(Math.random() * Math.max(1, ordered.length - 1));
    ordered.splice(Math.min(at, ordered.length), 0, w);
  }
  return ordered;
}

/** 洗牌但保留已抽過的牌 */
export function reshuffleRemaining(deck: Question[], from: number): Question[] {
  return [...deck.slice(0, from), ...shuffle(deck.slice(from))];
}

/* ---------- 讓設定可以放進路由參數（網頁可重新整理／分享） ---------- */

export function settingsToParams(s: Settings): Record<string, string> {
  return {
    partner: s.partner,
    name: s.partnerName,
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
  return {
    partner: partner ?? DEFAULT_SETTINGS.partner,
    partnerName: (get('name') ?? '').slice(0, 12),
    scene: scene ?? DEFAULT_SETTINGS.scene,
    topics,
    random: get('random') !== '0' || topics.length === 0,
    wild: get('wild') !== '0',
  };
}
