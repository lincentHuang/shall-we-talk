# Progress

- 2026-10-12：修正面板（Sheet）彈跳：進場改減速曲線不用彈簧，play 畫面合併成單一 Sheet，切換面板只換內容不重新滑入；收藏放大卡也去掉回彈（src/components/Sheet.tsx、src/app/play.tsx、src/app/favorites.tsx）
- 2026-10-12：題庫擴充 163 題（311→474），每種對象×人數×主題×層都有 15–22 題、野卡每層 10–18 張（src/data/questions.ts）
- 2026-10-12：題目依談話對象分開：朋友／家人／同事／曖昧／伴侶各 193 題專屬題庫，抽牌時專屬題約七成、通用題最多三成（src/data/partners/、src/data/questions.ts、src/lib/deck.ts）
