import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Only allow same-origin, absolute-path redirects. Anything else (a full URL,
// a protocol-relative `//evil.com`, or a `\`-trick) would be appended to the
// origin and could send the user to an attacker host (open redirect, S2).
function safeNext(raw: string | null): string {
  if (!raw) return "/app";
  if (!raw.startsWith("/")) return "/app"; // must be a local path
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/app"; // not protocol-relative
  return raw;
}

// Magic-link lands here. Handle both the PKCE `code` flow and the
// `token_hash` (verifyOtp) flow so it works regardless of the email template.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
