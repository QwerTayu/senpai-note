import type { Metadata } from "next";
import { BIZ_UDPGothic, Klee_One } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ProfileMenu } from "@/components/ProfileMenu";
import { Tour } from "@/components/Tour";
import "./globals.css";

const bizUd = BIZ_UDPGothic({ variable: "--font-biz-ud", subsets: ["latin"], weight: ["400", "700"] });
// 先輩の赤ペンの書き込みだけに使う、教科書体のような手書き風の書体
const klee = Klee_One({ variable: "--font-klee", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "senpai-note",
  description: "毎年メンバーが入れ替わる組織のための「1代上の先輩」ノート",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${bizUd.variable} ${klee.variable} font-sans antialiased`}>
        <header className="border-b border-rule bg-sheet">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <Logo />
              <span className="hidden text-xs text-pencil sm:inline">若葉祭実行委員会 総務局（架空のデモ）</span>
            </Link>
            <ProfileMenu />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
        <Tour />
      </body>
    </html>
  );
}
