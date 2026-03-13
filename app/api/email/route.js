import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { to, subject, body, claimNumber, senderName } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: "Missing required fields: to, subject, body" }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    // Build a professional HTML email
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1D1D1F;">
        <div style="padding: 24px 0; border-bottom: 2px solid #E8EAEF;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: #1D1D1F; display: inline-flex; align-items: center; justify-content: center;">
              <span style="color: #fff; font-size: 14px; font-weight: 800;">CA</span>
            </div>
            <span style="font-size: 16px; font-weight: 700;">CaseAssist</span>
          </div>
        </div>
        ${claimNumber ? `<div style="margin-top: 16px; padding: 8px 14px; background: #F0F7FF; border-radius: 8px; border: 1px solid #CCE0FF; font-size: 12px; color: #0071E3; font-weight: 600;">Re: ${claimNumber}</div>` : ''}
        <div style="margin-top: 20px; font-size: 14px; line-height: 1.7; color: #3D3F47;">
          ${body.replace(/\n/g, '<br/>')}
        </div>
        ${senderName ? `<div style="margin-top: 24px; font-size: 13px; color: #7C7F87;">Sent by ${senderName} via CaseAssist</div>` : ''}
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E8EAEF; font-size: 11px; color: #A0A3AB;">
          This email was sent from <a href="https://www.caseassist.ca" style="color: #0071E3; text-decoration: none;">CaseAssist</a> — WSIB Claims Intelligence Platform.
          <br/>This is an advisory tool only. All decisions are made by authorized WSIB adjudicators.
        </div>
      </div>
    `;

    // Use the Resend REST API directly (no SDK needed)
    const fromAddress = process.env.RESEND_FROM_EMAIL || "CaseAssist <onboarding@resend.dev>";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: htmlBody,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return NextResponse.json({ error: data.message || "Failed to send email" }, { status: response.status });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
