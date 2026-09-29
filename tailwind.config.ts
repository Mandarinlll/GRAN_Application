import type { Config } from "tailwindcss";

// Tailwind の設定ファイル。
// content: どのファイル内のクラス名を拾うか（ここに書いたファイルの className が有効になる）
// theme.extend.colors: 独自の色名を追加。tests/home.html の tailwind.config と同じ brand/admin を定義。
const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        admin: {
          50: "#eef2ff",
          100: "#e0e7ff",
          600: "#4f46e5",
          700: "#4338ca",
        },
      },
    },
  },
  plugins: [],
};

export default config;
