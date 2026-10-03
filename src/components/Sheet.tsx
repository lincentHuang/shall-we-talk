import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { colors, fonts, shadow } from '../theme';
import { Divider } from './Ornament';

/** 簡單的底部彈出面板（網頁與手機通用，不依賴原生 Modal） */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable accessibilityLabel="關閉" style={styles.scrim} onPress={onClose} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().damping(18)}
        exiting={SlideOutDown.duration(220)}
        style={styles.panelWrap}
      >
        <View style={[styles.panel, shadow(18, 0.3)]}>
          <Text style={styles.title}>{title}</Text>
          <Divider width={150} />
          <View style={{ marginTop: 14, alignSelf: 'stretch' }}>{children}</View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(46,34,70,0.42)' },
  panelWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', pointerEvents: 'box-none' },
  panel: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.parchment,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: colors.gold,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 36,
    alignItems: 'center',
  },
  title: { fontFamily: fonts.serifBold, fontSize: 19, color: colors.plum, letterSpacing: 5, marginBottom: 4 },
});
