// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // 文字一律走共用元件（統一系統字體放大上限）；只有共用元件本身可以直接用 react-native 的 Text
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/Text.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["Text"],
              message: "請改用 src/components/Text 的 Text（套用字體放大上限）。",
            },
          ],
        },
      ],
    },
  },
]);
