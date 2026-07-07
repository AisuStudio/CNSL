import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "aisustudio.berlin@gmail.com",
    subject: `CNSL Demo Request — ${name || email}`,
    html: `
      <p style="font-family:monospace;font-size:14px;color:#1a1a1a">
        <strong>New demo request from CNSL landing page</strong><br/><br/>
        ${name ? `<strong>Name:</strong> ${name}<br/>` : ""}
        <strong>Email:</strong> ${email}<br/>
      </p>
    `,
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
