import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// テスト配置方針:
// 本プロジェクトには既存のテストディレクトリ慣習が無いため、
// テストは対象コードに近接した `__tests__` ディレクトリへ配置する
// （例: `src/features/data/utils/__tests__/ranking.test.ts`）。
// ユニットテストと fast-check によるプロパティテストの両方をここで実行する。
export default defineConfig({
  resolve: {
    alias: {
      // tsconfig の `@/* -> ./src/*` と揃える
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.{test,spec}.{ts,tsx}"],
    // サーバ層のテストは @/lib/db の共有シングルトン（実ファイル data/gran.db、
    // WAL モード）を介して単一の SQLite ファイルへ書き込む。複数テストファイルを
    // 並列ワーカーで実行すると、同一ファイルへの同時書き込みで DB が破損し得る
    // （"database disk image is malformed"）。テスト間の分離と安定性を優先し、
    // ファイル並列を無効化し単一フォークで直列実行する。
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
