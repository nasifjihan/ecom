import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/catalog",
  "/orders",
  "/customers",
  "/inventory",
  "/marketing",
  "/shipping",
  "/settings",
  "/super",
];

const AUTH_ROUTES = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get("accessToken")?.value;
  const storeId = request.cookies.get("X-Store-Id")?.value;

  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isAuthRoute && accessToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isProtectedRoute && !accessToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();

  if (storeId) {
    response.headers.set("X-Store-Id", storeId);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/catalog/:path*",
    "/orders/:path*",
    "/customers/:path*",
    "/inventory/:path*",
    "/marketing/:path*",
    "/shipping/:path*",
    "/settings/:path*",
    "/super/:path*",
    "/login",
  ],
};
