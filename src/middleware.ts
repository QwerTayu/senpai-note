import { NextResponse, type NextRequest } from "next/server";
import { homeOf, parseProfile, PROFILE_COOKIE } from "@/lib/profileCookie";

// 1. デプロイ先を合言葉（DEMO_PASSCODE）で守る。ログインは作らない
// 2. 登録（役・代・部門・名前）がなければ /register に送る
// 3. 現役は後輩の画面、前の代は先輩の画面だけを使う
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  const passcode = process.env.DEMO_PASSCODE;
  if (passcode && pathname !== "/login" && pathname !== "/api/login" && req.cookies.get("demo_passcode")?.value !== passcode) {
    if (isApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return redirect(req, "/login");
  }
  if (isApi || pathname === "/login") return NextResponse.next();

  const profile = parseProfile(req.cookies.get(PROFILE_COOKIE)?.value);
  if (pathname === "/register") return NextResponse.next();
  if (!profile) return redirect(req, "/register");

  const home = homeOf(profile);
  if (pathname === "/" || (pathname.startsWith("/kouhai") && home !== "/kouhai") || (pathname.startsWith("/senpai") && home !== "/senpai")) {
    return redirect(req, home);
  }
  return NextResponse.next();
}

function redirect(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
