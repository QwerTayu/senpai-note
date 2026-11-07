import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { passcode } = (await req.json()) as { passcode: string };
  if (!process.env.DEMO_PASSCODE || passcode !== process.env.DEMO_PASSCODE) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("demo_passcode", passcode, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 14 });
  return res;
}
