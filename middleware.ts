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

// v2 빌드에 존재하지 않는 v1 전용 경로. v2 bucket 사용자도 이 경로들은 v1으로 그대로 본다.
// (rewrite하면 /v2/mall/[shareToken] 같은 경로가 없어 404 발생)
function isV1Only(pathname: string): boolean {
  return (
    pathname.startsWith("/mall/") ||
    pathname === "/mall" ||
    pathname.startsWith("/order/custom/") ||
    pathname.startsWith("/order/") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/editor") ||
    pathname.startsWith("/cobuy") ||
    pathname.startsWith("/payment") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/inquiries") ||
    pathname.startsWith("/policies") ||
    pathname.startsWith("/reviews") ||
    pathname.startsWith("/chat")
  );
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  if (isAsset(pathname)) return NextResponse.next();

  // v1 전용 경로는 bucket 무시하고 v1으로 응답. (v2에 해당 라우트가 없어 rewrite 시 404)
  if (isV1Only(pathname)) {
    const res = NextResponse.next();
    res.headers.set("x-ui-bucket", "v1");
    return res;
  }

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
