import type { CardKind, EditionId, StageId } from './catalog';

/**
 * 主持流程用到的文案：開場白、接話小抄、收尾分享。
 * 依人數分成：pair 兩個人、group 三人以上、self 和自己對話。
 * 特別版各有一份，見最下面的 GUIDES。
 */

export type Crowd = 'pair' | 'group' | 'self';

export function crowdOf(players: number): Crowd {
  if (players === 0) return 'self';
  return players > 2 ? 'group' : 'pair';
}

/** 開場白：由一個人念出來，讓大家安靜下來、進入狀態 */
export const OPENING: Record<Crowd, { who: string; text: string }> = {
  pair: {
    who: '由其中一人，慢慢念出這段話',
    text:
      '先把手機放下，一起深呼吸一次。接下來這段時間，我們不急著給答案，也不評斷對錯，只是好好聽、好好說。想分享多少都可以，不想回答也沒關係。今天說出口的話，就留在這裡。準備好了，我們從輕鬆的開始。',
  },
  group: {
    who: '請一位主持人念出開場白，其他人可以閉上眼睛聽',
    text:
      '先把手機放下，一起深呼吸一次。今天能坐在一起，本身就是一種緣分。接下來，我們不評斷對錯，不比較好壞，只帶著好奇和善意，聽每一個人的故事。想說多少都可以，不想回答也沒關係。今天說出口的話，就留在這張桌子上。準備好了，我們從輕鬆的開始。',
  },
  self: {
    who: '在心裡，或小聲念給自己聽',
    text:
      '找一個安靜的角落，深呼吸三次。接下來的問題沒有標準答案，也不需要說給誰聽，只要對自己誠實。想到什麼就寫下來，或在心裡回答也好。慢慢來，今天只屬於你自己。',
  },
};

type FollowUps = { title: string; sub: string; lines: string[] }[];

/** 接話小抄：聽完回答之後，其他人可以怎麼接話 */
export const FOLLOW_UPS: FollowUps = [
  {
    title: '接球',
    sub: '輕鬆回應，把話題傳下去',
    lines: ['換你！你的答案是什麼？', '真的假的？多說一點！', '我也是！我的是⋯⋯', '猜猜看，我會怎麼回答？'],
  },
  {
    title: '追問',
    sub: '對回答好奇，請對方多說一點',
    lines: ['後來呢？', '那時候你心裡在想什麼？', '為什麼是它，而不是別的？', '如果再來一次，你會怎麼做？'],
  },
  {
    title: '回饋',
    sub: '讚美、鼓勵，讓對方知道你有在聽',
    lines: ['謝謝你願意說這些。', '聽起來那時候真的不容易。', '我很喜歡你剛剛說的那句話。', '原來你是這樣想的，我好像更懂你了。'],
  },
  {
    title: '深入',
    sub: '溫柔地引導，往心裡再走一步',
    lines: ['可以多說一點嗎？', '這件事對現在的你有什麼影響？', '你最希望別人怎麼理解這件事？', '那個感覺，現在還在嗎？'],
  },
];

/** 每一層適合的接話方式（FOLLOW_UPS 的位置）：越往深處，越需要接住，而不是追問 */
const TIPS_BY_STAGE: Record<StageId, number[]> = { 0: [0], 1: [0, 1], 2: [1, 2, 3], 3: [2, 3] };

/** 每張牌輪流提示一句接話 */
export function followUpTip(n: number, stage: StageId, edition: EditionId = 'classic') {
  const { followUps, tipsByStage } = GUIDES[edition];
  const order = tipsByStage[stage];
  const group = followUps[order[n % order.length]];
  const line = group.lines[Math.floor(n / order.length) % group.lines.length];
  return `${group.title}：「${line}」`;
}

/** 一局結束時的收尾分享卡 */
export const CLOSING: Record<Crowd, string> = {
  pair: '輪流說說：今天哪一個回答讓你印象最深？最後，留一句話給對方。',
  group: '每個人輪流說說：今天哪一個回答讓你印象最深？對誰有了新的認識？',
  self: '寫一段話給明天的自己，謝謝今天這麼誠實的你。',
};

/** 玩法說明：[記號, 標題, 內容] */
type Rules = [string, string, string][];

const RULES: Rules = [
  ['I', '開場', '一個人念出開場白，大家放下手機、安靜下來。'],
  ['II', '抽牌', '牌分成暖身、淺談、走心、深談幾層，由淺入深，一層聊完再往下。'],
  ['III', '回答', '輪到的人回答。不想答可以「換一張」，也可以「請別人答」。'],
  ['IV', '接話', '其他人可以追問、回饋、鼓勵。一句「然後呢？」常常比給建議更好。'],
  ['V', '收尾', '最後每個人說說今天的感受。喜歡的題目按 ♡ 收藏。'],
];

const GESTURE_HINT = '手勢：手指滑過扇形手牌挑一張，往上拉出（或再點一下）就抽到它；聊完的牌左右滑走。';

export type Guide = {
  opening: Record<Crowd, { who: string; text: string }>;
  rules: Rules;
  ruleHint: string;
  /** 牌桌上「接話小抄」的名稱與說明 */
  tipsTitle: string;
  tipsLead: string;
  followUps: FollowUps;
  tipsByStage: Record<StageId, number[]>;
  /** 一局結束時的收尾卡 */
  closing: Record<Crowd, string>;
  closingKind: CardKind;
  closingLabel: string;
  closingFooter: string;
  /** 收尾時狀態列的提示 */
  closingHint: string;
  /** 換層時的小標，與挑牌時「提早往下一層」的連結字 */
  nextStage: string;
  skipLabel: string;
};

/* ---------- 深夜限定 ---------- */

const AFTERDARK_OPENING = {
  who: '關燈前，由其中一人慢慢念給對方聽',
  text:
    '把燈調暗一點，手機只留下這副牌。今晚沒有標準答案，也沒有誰一定要怎樣。我們先約好三個燈號：「綠燈」是喜歡、繼續；「黃燈」是慢一點、換個方式；「紅燈」是停下來，不用解釋，對方也不會失望。任何一張牌都可以換掉。準備好了，就從調情開始。',
};

const AFTERDARK_CLOSING = '抱著對方，輪流說：今晚最喜歡的一個瞬間，還有下次想再試一次的事。最後，說聲晚安。';

/* ---------- 爸媽聊聊 ---------- */

const PARENTS_OPENING = {
  pair: {
    who: '由其中一人，慢慢念出這段話',
    text:
      '先把手機放下，泡杯茶，坐近一點。我們常常見面，卻很少好好聊天。今天不講道理、不翻舊帳，只是聽聽彼此的故事。想說多少都可以，不想回答也沒關係。說出口的話，就留在這裡。準備好了，我們從輕鬆的開始。',
  },
  group: {
    who: '請一位家人念出開場白，其他人可以閉上眼睛聽',
    text:
      '先把手機放下，泡壺茶，大家坐近一點。一家人能聚在一起不容易。今天不講道理、不翻舊帳、不比誰對誰錯，只是好好聽每個人的故事。想說多少都可以，不想回答也沒關係。今天說出口的話，就留在這張桌子上。準備好了，我們從輕鬆的開始。',
  },
};

export const GUIDES: Record<EditionId, Guide> = {
  classic: {
    opening: OPENING,
    rules: RULES,
    ruleHint: GESTURE_HINT,
    tipsTitle: '接話小抄',
    tipsLead: '這不只是輪流回答。聽完之後，可以這樣接：',
    followUps: FOLLOW_UPS,
    tipsByStage: TIPS_BY_STAGE,
    closing: CLOSING,
    closingKind: 'wild',
    closingLabel: '收尾分享',
    closingFooter: 'Fin.',
    closingHint: '每個人都說一點，這一局就圓滿了',
    nextStage: '往下一層',
    skipLabel: '聊夠了？往下一層',
  },
  afterdark: {
    // 深夜限定固定兩個人
    opening: { pair: AFTERDARK_OPENING, group: AFTERDARK_OPENING, self: AFTERDARK_OPENING },
    rules: [
      ['I', '燈號', '「綠燈」繼續、「黃燈」慢一點、「紅燈」立刻停下，不需要理由。'],
      ['II', '流程', '牌分成調情、前夕、激情、收尾四個階段，一個階段抽完再往下。'],
      ['III', '輪流', '輪到的人回答、出手或坦白；不想做就「換一張」，或請對方來。'],
      ['IV', '說出來', '「這樣可以嗎？」「我喜歡這樣。」邊做邊說，比用猜的更性感。'],
      ['V', '餘溫', '最後抱著彼此說說今晚。喜歡的牌按 ♡ 收藏，下次再玩。'],
    ],
    ruleHint: `${GESTURE_HINT}\n深夜限定僅限 18 歲以上、彼此同意的伴侶。`,
    tipsTitle: '悄悄話小抄',
    tipsLead: '不知道說什麼的時候，可以這樣說：',
    followUps: [
      { title: '確認', sub: '問一句，讓對方更安心', lines: ['這樣可以嗎？', '要再慢一點嗎？', '還想要嗎？', '換你說說看？'] },
      { title: '引導', sub: '直接說出想要的', lines: ['再輕一點。', '就是那裡。', '往下一點。', '不要停。'] },
      { title: '讚美', sub: '讓對方知道你有多喜歡', lines: ['你好好看。', '我好喜歡你這樣。', '你的聲音好好聽。', '我想你很久了。'] },
      { title: '邀請', sub: '把主導權交出去，或拿過來', lines: ['換你來。', '我想要⋯⋯', '我們試試看⋯⋯', '看著我。'] },
    ],
    tipsByStage: { 0: [2, 0], 1: [0, 1, 2], 2: [1, 3, 2], 3: [2, 0] },
    closing: { pair: AFTERDARK_CLOSING, group: AFTERDARK_CLOSING, self: AFTERDARK_CLOSING },
    closingKind: 'ad-talk',
    closingLabel: '餘溫',
    closingFooter: 'Good Night',
    closingHint: '抱著彼此，慢慢說',
    nextStage: '下一個階段',
    skipLabel: '等不及了？下一個階段',
  },
  parents: {
    opening: { ...PARENTS_OPENING, self: PARENTS_OPENING.pair },
    rules: [
      ['I', '開場', '一個人念出開場白，大家放下手機、坐近一點。'],
      ['II', '抽牌', '牌分成暖暖身、家常話、老故事、心裡話四層，一層聊完再往下。'],
      ['III', '回答', '寫著「爸媽說／孩子說」的牌，照自己的身分答那一半。不想答可以「換一張」。'],
      ['IV', '接話', '多問一句「後來呢？」爸媽的故事常常就藏在後面。'],
      ['V', '收尾', '最後每個人說說今天的感受。喜歡的題目按 ♡ 收藏。'],
    ],
    ruleHint: GESTURE_HINT,
    tipsTitle: '接話小抄',
    tipsLead: '這不只是輪流回答。聽完之後，可以這樣接：',
    followUps: FOLLOW_UPS,
    tipsByStage: TIPS_BY_STAGE,
    closing: {
      pair: '輪流說說：今天聽到哪一段故事最意外？最後，給對方一個擁抱，或說聲謝謝。',
      group: '每個人輪流說：今天聽到哪一段故事最意外？最後，對家裡的每個人說聲謝謝。',
      self: '',
    },
    closingKind: 'pa-wild',
    closingLabel: '收尾分享',
    closingFooter: 'Fin.',
    closingHint: '每個人都說一點，這一局就圓滿了',
    nextStage: '往下一層',
    skipLabel: '聊夠了？往下一層',
  },
};
