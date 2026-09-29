import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // このプロジェクトのルートを明示する。
  // 親フォルダにも package-lock.json があり、Next がそちらを誤検出して
  // 警告を出すため、ここで「このフォルダが基準」と指定して警告を防ぐ。
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
