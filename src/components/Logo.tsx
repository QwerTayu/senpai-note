// senpai-note のロゴ。上半分は先輩の赤い鉛筆（消しゴムの先・金具・軸・削った先・芯）、
// 下半分はその芯から書かれていく現役の白い線。全体で senpai の S になる。
// 同じ形を src/app/icon.svg（ファビコン）でも使っている
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="14" fill="#1d2b44" />
      <g transform="translate(32 32) scale(0.82) translate(-32 -32)">
        <path d="M36 27H20A15 15 0 0 0 20 57H58L52 47H20A5 5 0 0 1 20 37H36Z" fill="#fff" />
        <path d="M18 7H44A15 15 0 0 1 44 37H36V27H44A5 5 0 0 0 44 17H18Z" fill="#e8545d" />
        <path d="M10 7A5 5 0 0 0 10 17Z" fill="#e8545d" />
        <rect x="12" y="7" width="4" height="10" fill="#e8545d" />
        <path d="M36 27L24 32L36 37Z" fill="#f4d3b5" />
        <path d="M28 30.33L24 32L28 33.67Z" fill="#e8545d" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
      <LogoMark size={28} />
      senpai-note
    </span>
  );
}
