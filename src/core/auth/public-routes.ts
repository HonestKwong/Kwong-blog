const PUBLIC_PREFIXES = [
  "/blog",
  "/login",
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
];

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
