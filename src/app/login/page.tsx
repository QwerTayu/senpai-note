"use client";
import { useState } from "react";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ passcode }) });
    if (res.ok) location.href = "/";
    else setError("合言葉が違います");
  }
  return (
    <form onSubmit={submit} className="page mx-auto mt-16 max-w-sm space-y-4 p-6">
      <h1 className="font-bold">合言葉を入れてください</h1>
      <input
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        className="field"
        autoFocus
      />
      {error && <p className="text-sm text-pen">{error}</p>}
      <button className="btn btn-ink w-full">入る</button>
    </form>
  );
}
