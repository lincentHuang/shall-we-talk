# Progress

- 2026-10-12：修正面板（Sheet）彈跳：進場改減速曲線不用彈簧，play 畫面合併成單一 Sheet，切換面板只換內容不重新滑入；收藏放大卡也去掉回彈（src/components/Sheet.tsx、src/app/play.tsx、src/app/favorites.tsx）
- 2026-10-12：題庫擴充 163 題（311→474），每種對象×人數×主題×層都有 15–22 題、野卡每層 10–18 張（src/data/questions.ts）
- 2026-10-12：題目依談話對象分開：朋友／家人／同事／曖昧／伴侶各 193 題專屬題庫，抽牌時專屬題約七成、通用題最多三成（src/data/partners/、src/data/questions.ts、src/lib/deck.ts）
- 2026-10-12：推上 main，Vercel production 部署完成，EAS preview 重新打包 Android APK（commit 0ed4cc5）
- 2026-10-18：新增特別版「深夜限定」（18+，調情 → 前夕 → 激情 → 收尾，132 張）與「爸媽聊聊」（家常話 → 老故事 → 心裡話，123 張），各有專屬卡面、卡背、開場白與收尾卡；首頁加特別版入口，準備頁與牌桌依版本切換（src/data/catalog.ts、src/data/guide.ts、src/data/editions/、src/lib/deck.ts、src/app/、src/components/Card.tsx、assets/cards/afterdark|parents/）
- 2026-10-18：深夜限定擴充到 167 張：前夕加按摩、觸碰、道具、讓對方先高潮的任務，激情加姿勢與節奏任務，新增「姿勢圖解」牌（10 種姿勢，星座風格人形圖）；前夕與激情的撩撥任務抽兩倍（src/data/editions/afterdark.ts、poses.ts、src/components/PoseArt.tsx、src/lib/deck.ts）
- 2026-10-18：加入背景音樂：12 首程式合成、可無縫循環的配樂，經典版六個情境各一首、深夜限定隨四個階段換曲、爸媽聊聊另有華爾滋與五聲音階兩首；牌桌依情境／階段交叉淡入淡出，準備頁可關閉（art-source/music/、assets/music/、src/lib/music.ts、src/data/catalog.ts、src/app/play.tsx、src/app/setup.tsx）
- 2026-10-18：首頁改為左右滑動切換三副牌（經典版／深夜限定／爸媽聊聊），背景色調隨滑動交叉淡換，含頁籤、左右箭頭與網頁鍵盤操作（src/app/index.tsx、src/components/Backdrop.tsx）
