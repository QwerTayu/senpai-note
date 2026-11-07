"use client";
import ReactMarkdown from "react-markdown";

// エージェントが書いた文を表示する。太字・箇条書き・見出しなどのマークダウンを解釈する
// （生の HTML は react-markdown の既定どおり表示しない）
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
