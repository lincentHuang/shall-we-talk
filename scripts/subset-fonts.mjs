// 把思源宋體（Noto Serif TC，每個字重約 10MB）裁切成只包含 App 用到的字元。
// 題庫或介面文字有新增中文字時，執行：npm run fonts
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const FONT_SRC = join(ROOT, 'art-source/fonts');
const OUT = join(ROOT, 'assets/fonts');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (['.ts', '.tsx'].includes(extname(e.name))) out.push(p);
  }
  return out;
}

const files = await walk(SRC);
let text = '';
for (const f of files) text += await readFile(f, 'utf8');

// ASCII、全形標點與常用符號一律保留，讓使用者輸入的名字多數也能顯示
const extra =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~' +
  '，。、；：？！「」『』（）《》〈〉…—～·・　％＋－＝／' +
  '的一是不了人我在有他這中大來上個國到說們為子和你地出道也時年得就那要下以生會自著去之過家學對可她裡後小麼心多天而能好都然沒日於起還發成事只作當想看文無開手十用主行方又如前所本見經頭面公同三已老從動兩長知民樣現分將外但身些與高意進把法此實回二理美點月明其種聲全工己話兒者向情部正名定女問力機給等幾很業最間新什打便位因重被走電四第門相次東政海口使教西再平真聽世氣信北少關并內加化由卻代軍產入先山五太水萬市眼體別處總才場師書比住員九笑性通目華報立馬命張活難神數件安表原車白應路期叫死常提感金何更反合放做系計或司利受光王果親界及今京務制解各任至清物台象記邊共風戰干接它許八特覺望直服毛林題建南度統色字請交愛讓認算論百吃義科怎元社術結六功指思非流每青管夫連遠資隊跟帶花快條院變聯言權往展該領傳近留紅治決周保達辦運武半候七必城父強步完革深區即求品士轉量空甚眾技輕程告江語英基派滿式李息寫呢識極令黃德收臉錢黨倒未持取設始版雙歷越史商千片容研像找友孩站廣改議形委早房音火際則首單據導影失拿網香似斯專石若兵弟誰校讀志飛觀爭究包組造落視濟喜離雖壞腳歡速衣負媽姐呀妹婆奶爺哥嗎吧啊哦嗯喔';

const chars = [...new Set([...text, ...extra])].filter((c) => c.codePointAt(0) > 31).join('');
console.log(`收集到 ${chars.length} 個字元`);

const jobs = [
  ['NotoSerifTC_500Medium.ttf', 'NotoSerifTC-500.ttf', chars],
  ['NotoSerifTC_700Bold.ttf', 'NotoSerifTC-700.ttf', chars],
  ['CormorantGaramond_600SemiBold_Italic.ttf', 'Cormorant-600Italic.ttf', extra + '✦✧❦♡☾☆◇·—–'],
  ['CormorantGaramond_500Medium.ttf', 'Cormorant-500.ttf', extra + '✦✧❦♡☾☆◇·—–'],
];

for (const [src, dst, subset] of jobs) {
  const buf = await readFile(join(FONT_SRC, src));
  const out = await subsetFont(buf, subset, { targetFormat: 'truetype' });
  await writeFile(join(OUT, dst), out);
  console.log(`${dst}: ${(out.length / 1024).toFixed(0)} KB`);
}
