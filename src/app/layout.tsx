import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { RoleSwitch } from "@/components/RoleSwitch";
import "./globals.css";

const noto = Noto_Sans_JP({ variable: "--font-noto-sans-jp", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "senpai-note",
  description: "毎年メンバーが入れ替わる組織のための「1代上の先輩」ノート",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${noto.variable} font-sans antialiased`}>
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-lg font-bold tracking-tight">senpai-note</div>
              <div className="text-xs text-stone-500">若葉祭実行委員会 総務局（架空のデモ）</div>
            </div>
            <RoleSwitch />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
