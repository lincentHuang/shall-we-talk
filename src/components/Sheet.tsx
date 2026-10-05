import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, type } from '../theme';
import { Divider } from './Ornament';
import { Text } from './Text';

/** 簡單的底部彈出面板（網頁與手機通用，不依賴原生 Modal） */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
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
        {/* 面板不超過螢幕、內容太長就捲動；底部讓出手勢列／導覽列 */}
        <View
          style={[
            styles.panel,
            shadow(18, 0.3),
            { maxHeight: height - insets.top - 24, paddingBottom: 24 + insets.bottom },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <Divider width={150} />
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingTop: 14 }}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
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
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: colors.gold,
    paddingHorizontal: 24,
    paddingTop: 22,
    alignItems: 'center',
  },
  title: { ...type.title, color: colors.plum, letterSpacing: 5, marginBottom: 4, textAlign: 'center' },
  body: { alignSelf: 'stretch', flexGrow: 0 },
});
