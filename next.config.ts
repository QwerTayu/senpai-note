import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 手元の開発サーバーで出る Next.js の表示（左下の丸）を出さない。デモ動画に映り込むため
  devIndicators: false,
};

export default nextConfig;
