import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors, fonts } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [fonts.serif]: require('../../assets/fonts/NotoSerifTC-500.ttf'),
    [fonts.serifBold]: require('../../assets/fonts/NotoSerifTC-700.ttf'),
    [fonts.display]: require('../../assets/fonts/Cormorant-600Italic.ttf'),
    [fonts.displayRegular]: require('../../assets/fonts/Cormorant-500.ttf'),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  // 字型載入前先鋪上背景色，避免網頁出現黑／白畫面
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: colors.bgTop }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgTop }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.bgTop },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="play" options={{ gestureEnabled: false }} />
        <Stack.Screen name="favorites" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
