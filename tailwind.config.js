/** @type {import('tailwindcss').Config} */
// Tailwind の設定: ダークモードを class 切り替え方式で管理
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // YomiNote 独自のカラーパレット
      colors: {
        zen: {
          bg: "#fafafa",
          surface: "#ffffff",
          border: "#e5e5e5",
          text: "#1a1a1a",
          subtle: "#737373",
          accent: "#3b82f6",
        },
        "zen-dark": {
          bg: "#1a1a1a",
          surface: "#212121",
          border: "#2e2e2e",
          text: "#e5e5e5",
          subtle: "#888888",
          accent: "#60a5fa",
        },
      },
      fontFamily: {
        // 等幅フォント (エディタ・コードブロック用)
        // 連字対応の JetBrains Mono Variable をバンドル済み
        mono: [
          "JetBrains Mono Variable",
          "JetBrains Mono",
          "Cascadia Code",
          "SF Mono",
          "Consolas",
          "Monaco",
          "monospace",
        ],
        // UI 用の Sans Serif (Inter + 日本語/中国語の Noto Sans 系)
        sans: [
          "Inter Variable",
          "Inter",
          "Noto Sans JP Variable",
          "Noto Sans JP",
          "Noto Sans SC Variable",
          "Noto Sans SC",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Hiragino Kaku Gothic ProN",
          "Yu Gothic",
          "sans-serif",
        ],
        // プレビュー本文用 Serif
        serif: [
          "Georgia",
          "Yu Mincho",
          "Hiragino Mincho ProN",
          "serif",
        ],
      },
    },
  },
  plugins: [],
};
