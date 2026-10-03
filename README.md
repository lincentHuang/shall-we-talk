# Shall We Talk・聊聊

一副讓話題慢慢變深的對話卡牌 App。用 Expo（React Native）製作，iOS、Android、網頁共用同一份程式碼。

## 功能

- **談話對象**：朋友、曖昧對象、戀人・伴侶、家人、同事、新朋友、我自己；可填對方名字，牌桌上會顯示「輪到誰先回答」
- **聊天情境**：咖啡廳小聊、深夜長聊、散步漫談、微醺餐桌、旅途之中、朋友聚會——情境決定題目深度（I 淺談／II 走心／III 深談）與張數
- **話題主題**：初見破冰、回憶與成長、價值與信念、愛與關係、夢想與未來、真心與脆弱、假如與奇想，可複選或「完全隨機」
- **互動野卡**：偶爾穿插「一起做一件事」的卡
- **動態**：兩輪鴿尾式洗牌、點牌堆或往上滑抽牌、3D 翻牌＋金色星芒、左右滑走；搭配音效與觸覺回饋
- **收藏**：喜歡的題目按 ♡，在首頁「我的收藏」查看

## 開發

```bash
npm install
npx expo start          # 手機用 Expo Go 掃 QR code
npx expo start --web    # 網頁版
npm run typecheck
```

網頁版快捷鍵：空白鍵／Enter／→ 抽下一張，S 重新洗牌。

## 專案結構

```
src/app/            畫面（Expo Router）：index 首頁、setup 準備牌局、play 牌桌、favorites 收藏
src/components/     卡牌、牌堆、洗牌動畫（ShuffleLayer）、按鈕、面板
src/data/           catalog（對象／情境／主題）、questions（題庫）
src/lib/            deck（組牌邏輯）、storage（收藏與設定）、feedback（音效與震動）
assets/cards/       卡背與 8 種卡面美術
assets/scenes/      情境插畫
assets/fonts/       已子集化的思源宋體與 Cormorant Garamond
art-source/         美術原始大圖與完整字型（不會打包進 App）
```

## 新增或修改題目

題目在 `src/data/questions.ts`，格式為 `[深度, 題目, 適用對象?]`：

- 深度：`1` 淺談、`2` 走心、`3` 深談
- 適用對象（可省略）：`'pair'` 需要兩個人、`'known'` 需要已經認識、`'romance'` 曖昧或戀人、`'couple'` 只限戀人

中文字型為了縮小檔案只保留用到的字。**新增題目後請執行一次：**

```bash
npm run fonts
```

否則新出現的字會改用系統字型顯示。

## 美術

卡牌美術以使用者提供的參考圖風格（新藝術運動、慕夏風、薰衣草紫與土耳其藍、金色秋葉）透過 AI 生成；音效同樣為 AI 生成。原始檔放在 `art-source/`。
