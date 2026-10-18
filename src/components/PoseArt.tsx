import { memo } from 'react';
import Svg, { Circle, G, Line, Polyline, Rect } from 'react-native-svg';

import type { Figure, Pose, PoseScene } from '../data/editions/poses';

/**
 * 姿勢圖解牌拱窗裡的人形圖：星座風格，四肢是線、關節是小星點，不畫身體細節。
 * 位置與畫法和 art-source/editions/tools/poses.py（選單縮圖）一致，改這裡要一起改。
 */

/** 人形圖在卡面上的位置：left、top 相對卡片寬高，width 相對卡片寬（viewBox 200×150） */
const BOX = { left: 0.13, top: 0.12, width: 0.74 };
const BACK = '#EBA3B6';
const FRONT = '#E8CF94';
const LINE = '#E3C27A';
const JOINT = '#FFF8E6';
const W = 3.4;

function Scene({ scene }: { scene: PoseScene }) {
  const line = { stroke: LINE, strokeWidth: 1.2, strokeOpacity: 0.45, fill: 'none' };
  switch (scene) {
    case 'bed':
      return <Line x1={14} y1={129} x2={186} y2={129} {...line} />;
    case 'top':
      return (
        <G>
          <Rect x={14} y={30} width={172} height={100} rx={8} {...line} />
          <Rect x={19} y={38} width={12} height={84} rx={4} {...line} />
        </G>
      );
    case 'edge':
      return (
        <G>
          <Polyline points="14,86 118,86 118,128" {...line} />
          <Line x1={14} y1={129} x2={186} y2={129} {...line} />
        </G>
      );
    case 'wall':
      return <Polyline points="40,8 40,129 186,129" {...line} />;
  }
}

function Limb({ pts, color, opacity }: { pts: [number, number][]; color: string; opacity: number }) {
  return (
    <G opacity={opacity}>
      <Polyline
        points={pts.map((p) => p.join(',')).join(' ')}
        stroke={color}
        strokeWidth={W}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {pts.slice(1).map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={W * 0.55} fill={JOINT} />
      ))}
    </G>
  );
}

function Person({ fig, color }: { fig: Figure; color: string }) {
  // 先畫遠側（淡），再畫近側與軀幹、頭
  return (
    <G>
      {[1, 0].map((i) => {
        const opacity = i ? 0.45 : 1;
        const arm = fig.arms[i];
        const leg = fig.legs[i];
        return (
          <G key={i}>
            {arm && <Limb pts={[fig.neck, ...arm]} color={color} opacity={opacity} />}
            {leg && <Limb pts={[fig.hip, ...leg]} color={color} opacity={opacity} />}
          </G>
        );
      })}
      <Limb pts={[fig.neck, fig.hip]} color={color} opacity={1} />
      <Circle cx={fig.head[0]} cy={fig.head[1]} r={6.5} stroke={color} strokeWidth={W} fill={color} fillOpacity={0.27} />
    </G>
  );
}

export const PoseArt = memo(function PoseArt({ pose, width, height }: { pose: Pose; width: number; height: number }) {
  const w = width * BOX.width;
  return (
    <Svg
      width={w}
      height={w * 0.75}
      viewBox="0 0 200 150"
      style={{ position: 'absolute', left: width * BOX.left, top: height * BOX.top }}
    >
      <Scene scene={pose.scene} />
      <Person fig={pose.back} color={BACK} />
      <Person fig={pose.front} color={FRONT} />
    </Svg>
  );
});
