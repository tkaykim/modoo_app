import { NextRequest, NextResponse } from "next/server";

const COOKIE = "ui_bucket";
const ROLLOUT_PCT = Number(process.env.V2_ROLLOUT_PCT ?? "0");

const V2_PREFIX = "/v2";

function isAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  if (isAsset(pathname)) return NextResponse.next();

  // Direct /v2/* access (internal QA) — never rewrite, just set cookie/header.
  const isDirectV2 = pathname.startsWith(V2_PREFIX);

  const force = url.searchParams.get("ui");
  let bucket = req.cookies.get(COOKIE)?.value;

  if (force === "v1" || force === "v2") bucket = force;
  else if (!bucket)
    bucket = Math.random() * 100 < ROLLOUT_PCT ? "v2" : "v1";

  let res: NextResponse;

  if (!isDirectV2 && bucket === "v2") {
    const u = url.clone();
    u.pathname = V2_PREFIX + pathname;
    res = NextResponse.rewrite(u);
  } else {
    res = NextResponse.next();
  }

  res.cookies.set(COOKIE, bucket, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });
  res.headers.set("x-ui-bucket", bucket);
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
