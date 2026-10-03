import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { shadow } from '../theme';
import { CardBack, cardHeight, cardRadius } from './Card';

export const PILE_STEP = 1.4;
export const PILE_MAX = 7;

/** 桌上的牌堆（靜態），最上面那張由 ActiveCard 負責 */
export const DeckPile = memo(function DeckPile({
  count,
  width,
}: {
  /** 疊在下面的張數 */
  count: number;
  width: number;
}) {
  const shown = Math.min(count, PILE_MAX);
  const jitter = useMemo(() => Array.from({ length: PILE_MAX }, (_, i) => ((i * 37) % 7) - 3), []);
  const h = cardHeight(width);

  return (
    <View style={{ width, height: h }}>
      {/* 空牌位：金色虛線框 */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: cardRadius(width), borderWidth: 1.2, borderStyle: 'dashed', borderColor: 'rgba(201,162,90,0.6)' },
        ]}
      />
      {Array.from({ length: shown }, (_, i) => (
        <View
          key={i}
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateY: -i * PILE_STEP }, { rotate: `${jitter[i] * 0.35}deg` }] },
          ]}
        >
          <CardBack width={width} style={i === 0 ? shadow(8, 0.26) : undefined} />
        </View>
      ))}
    </View>
  );
});
