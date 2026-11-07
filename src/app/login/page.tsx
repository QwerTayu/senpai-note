"use client";
import { useState } from "react";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ passcode }) });
    if (res.ok) location.href = "/senpai";
    else setError("合言葉が違います");
  }
  return (
    <form onSubmit={submit} className="mx-auto mt-20 max-w-sm space-y-3 rounded-xl border border-stone-200 bg-white p-6">
      <h1 className="font-bold">合言葉を入れてください</h1>
      <input
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        className="w-full rounded-lg border border-stone-300 px-3 py-2"
        autoFocus
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="w-full rounded-lg bg-stone-900 py-2 font-medium text-white">入る</button>
    </form>
  );
}
