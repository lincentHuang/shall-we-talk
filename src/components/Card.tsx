import { Image } from 'expo-image';
import { createContext, memo, useContext } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { EDITIONS, editionOfKind, TOPICS, type CardKind, type EditionId, type StageId } from '../data/catalog';
import type { Pose } from '../data/editions/poses';
import { PoseArt } from './PoseArt';
import { CARD_RATIO, fonts } from '../theme';
import { Text } from './Text';

export const cardHeight = (w: number) => Math.round(w * CARD_RATIO);
export const cardRadius = (w: number) => Math.round(w * 0.045);

/** 卡圖包一層不接收指標事件的 View：避免桌機瀏覽器原生的「拖曳圖片」吃掉手勢、手機長按跳出存圖選單 */
const artLayer = [StyleSheet.absoluteFill, { pointerEvents: 'none' as const }];

/*
 * 卡面字級跟著卡片寬度走、要剛好落在美術的留白裡，所以不跟系統字體放大（allowFontScaling=false）。
 * 每段字都指定 lineHeight，避免 Android 上思源宋體的預設行距把題目擠出留白區。
 */

/* 卡面美術裡「留白羊皮紙」的位置（相對卡片寬高） */
const PANEL = { top: 0.583, bottom: 0.1, side: 0.135 };

/** 牌桌上用的是哪個版本：決定卡背（手牌、洗牌、牌堆都從這裡取） */
export const EditionContext = createContext<EditionId>('classic');

function questionSize(w: number, body: string) {
  // 爸媽聊聊的雙面題分兩段、每段最多兩行，一律用最小一級才放得下四行
  if (body.includes('\n') || body.length > 38) return w * 0.05;
  if (body.length > 30) return w * 0.054;
  if (body.length > 22) return w * 0.059;
  return w * 0.064;
}

type FaceProps = {
  kind: CardKind;
  text: string;
  level?: StageId;
  width: number;
  /** 收尾卡等特殊標題／頁尾 */
  label?: string;
  footer?: string;
  /** 姿勢圖解牌：在拱窗裡畫人形圖 */
  pose?: Pose;
  style?: StyleProp<ViewStyle>;
};

export const CardFace = memo(function CardFace({
  kind,
  text,
  level,
  width,
  label,
  footer: footerText,
  pose,
  style,
}: FaceProps) {
  const topic = TOPICS[kind];
  const ed = editionOfKind(kind);
  const h = cardHeight(width);
  // 爸媽聊聊的雙面題「爸媽說：⋯／孩子說：⋯」分成兩段，各自照身分讀
  const body = text.replace('／孩子說：', '\n孩子說：');
  const fs = questionSize(width, body);
  // 深色留白的卡面（深夜限定）改用淺色字
  const ink = topic.faceInk ?? topic.ink;
  const trim = topic.faceTrim ?? ink;
  const footer =
    footerText ??
    (kind === ed.wild ? 'Wild Card' : level != null ? `${ed.stages[level].mark} · ${ed.stages[level].name}` : topic.en);

  return (
    <View style={[{ width, height: h, borderRadius: cardRadius(width), overflow: 'hidden' }, style]}>
      <View style={artLayer}>
        <Image source={topic.face} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
        {pose && <PoseArt pose={pose} width={width} height={h} />}
      </View>
      <View
        style={{
          position: 'absolute',
          left: width * PANEL.side,
          right: width * PANEL.side,
          top: h * PANEL.top,
          bottom: h * PANEL.bottom,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            fontFamily: fonts.serifBold,
            fontSize: width * 0.038,
            lineHeight: width * 0.038 * 1.5,
            color: trim,
            letterSpacing: width * 0.012,
            opacity: 0.85,
          }}
        >
          ✦ {label ?? topic.name} ✦
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: fonts.serif,
            fontSize: fs,
            lineHeight: fs * 1.62,
            color: ink,
            textAlign: 'center',
            letterSpacing: fs * 0.04,
          }}
        >
          {body}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            fontFamily: fonts.display,
            fontSize: width * 0.042,
            lineHeight: width * 0.042 * 1.3,
            color: trim,
            opacity: 0.7,
            letterSpacing: 1.5,
          }}
        >
          {footer}
        </Text>
      </View>
    </View>
  );
});

export const CardBack = memo(function CardBack({
  width,
  edition,
  style,
}: {
  width: number;
  /** 沒指定就用牌桌上的版本（EditionContext） */
  edition?: EditionId;
  style?: StyleProp<ViewStyle>;
}) {
  const current = useContext(EditionContext);
  return (
    <View style={[{ width, height: cardHeight(width), borderRadius: cardRadius(width), overflow: 'hidden' }, style]}>
      <View style={artLayer}>
        <Image source={EDITIONS[edition ?? current].back} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      </View>
    </View>
  );
});
