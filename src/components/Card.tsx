import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CARD_BACK, STAGES, TOPICS, type CardKind, type StageId } from '../data/catalog';
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

function questionSize(w: number, len: number) {
  if (len > 30) return w * 0.054;
  if (len > 22) return w * 0.059;
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
  style?: StyleProp<ViewStyle>;
};

export const CardFace = memo(function CardFace({ kind, text, level, width, label, footer: footerText, style }: FaceProps) {
  const topic = TOPICS[kind];
  const h = cardHeight(width);
  const fs = questionSize(width, text.length);
  const footer =
    footerText ?? (kind === 'wild' ? 'Wild Card' : level != null ? `${STAGES[level].mark} · ${STAGES[level].name}` : topic.en);

  return (
    <View style={[{ width, height: h, borderRadius: cardRadius(width), overflow: 'hidden' }, style]}>
      <View style={artLayer}>
        <Image source={topic.face} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
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
            color: topic.ink,
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
            color: topic.ink,
            textAlign: 'center',
            letterSpacing: fs * 0.04,
          }}
        >
          {text}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            fontFamily: fonts.display,
            fontSize: width * 0.042,
            lineHeight: width * 0.042 * 1.3,
            color: topic.ink,
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

export const CardBack = memo(function CardBack({ width, style }: { width: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width, height: cardHeight(width), borderRadius: cardRadius(width), overflow: 'hidden' }, style]}>
      <View style={artLayer}>
        <Image source={CARD_BACK} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      </View>
    </View>
  );
});
