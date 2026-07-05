// Refreshes the Supabase session cookie and gates routes: unauthenticated users
// are sent to /login. (Stripped from the static GitHub-Pages demo build.)
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" || // public start/landing page (has its own login form)
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/api") || // API routes self-guard (return 401)
    path.startsWith("/note/") || // published notes are public (read-only)
    path.startsWith("/submit/") || // public write-only project intake form
    path === "/designsystem" || // public design-system / style-guide showcase
    // Legal pages must be reachable without a login (§ 5 DDG: ständig verfügbar)
    path === "/impressum" ||
    path === "/datenschutz" ||
    path === "/terms" ||
    path === "/story";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/"; // unauthenticated → start page (login lives there)
    return NextResponse.redirect(url);
  }
  // Already-signed-in users skip the marketing/login surfaces → straight to app.
  if (user && (path === "/" || path.startsWith("/login"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|webmanifest)$).*)",
  ],
};
