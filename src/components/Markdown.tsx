"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// エージェントや資料の文を表示する。太字・箇条書き・見出し・表などのマークダウンを解釈する
// （生の HTML は react-markdown の既定どおり表示しない）
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
