import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // tsconfig.json の paths ("@/*" -> "./src/*") と一致させる
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // @/lib/db を import するテストでも開発用の data/gran.db に触れないよう、
    // 共有シングルトンをインメモリDBにする（テストファイルごとに独立）。
    env: {
      GRAN_DB_PATH: ":memory:",
    },
  },
});
