import type { StageId } from './catalog';

/**
 * 主持流程用到的文案：開場白、接話小抄、收尾分享。
 * 依人數分成：pair 兩個人、group 三人以上、self 和自己對話。
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

/** 接話小抄：聽完回答之後，其他人可以怎麼接話 */
export const FOLLOW_UPS: { title: string; sub: string; lines: string[] }[] = [
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
export function followUpTip(n: number, stage: StageId) {
  const order = TIPS_BY_STAGE[stage];
  const group = FOLLOW_UPS[order[n % order.length]];
  const line = group.lines[Math.floor(n / order.length) % group.lines.length];
  return `${group.title}：「${line}」`;
}

/** 一局結束時的收尾分享卡 */
export const CLOSING: Record<Crowd, string> = {
  pair: '輪流說說：今天哪一個回答讓你印象最深？最後，留一句話給對方。',
  group: '每個人輪流說說：今天哪一個回答讓你印象最深？對誰有了新的認識？',
  self: '寫一段話給明天的自己，謝謝今天這麼誠實的你。',
};
