import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { to, subject, body, claimNumber, senderName, senderEmail, cc, bcc } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: "Missing required fields: to, subject, body" }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1D1D1F;">
        <div style="padding: 20px 0; border-bottom: 2px solid #E8EAEF;">
          <div style="display: inline-flex; align-items: center; gap: 10px;">
            <div style="width: 28px; height: 28px; border-radius: 7px; background: #1D1D1F; display: inline-flex; align-items: center; justify-content: center;">
              <span style="color: #fff; font-size: 12px; font-weight: 800;">CA</span>
            </div>
            <span style="font-size: 15px; font-weight: 700; color: #1D1D1F;">CaseAssist</span>
          </div>
        </div>
        ${claimNumber ? '<div style="margin-top: 14px; padding: 6px 12px; background: #F0F7FF; border-radius: 6px; border: 1px solid #CCE0FF; font-size: 11px; color: #0071E3; font-weight: 600; display: inline-block;">Claim: ' + claimNumber + '</div>' : ''}
        <div style="margin-top: 18px; font-size: 14px; line-height: 1.7; color: #3D3F47; white-space: pre-wrap;">${body}</div>
        <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #E8EAEF;">
          ${senderName ? '<div style="font-size: 13px; font-weight: 600; color: #1D1D1F;">' + senderName + '</div>' : ''}
          ${senderEmail ? '<div style="font-size: 12px; color: #7C7F87;">' + senderEmail + '</div>' : ''}
          <div style="font-size: 11px; color: #A0A3AB; margin-top: 6px;">Sent via <a href="https://www.caseassist.ca" style="color: #0071E3; text-decoration: none;">CaseAssist</a></div>
        </div>
      </div>
    `;

    const fromDomain = process.env.RESEND_FROM_EMAIL || "CaseAssist <onboarding@resend.dev>";
    const fromDisplay = senderName ? senderName + " via CaseAssist <" + fromDomain.match(/<(.+)>/)?.[1] + ">" : fromDomain;

    const emailPayload = {
      from: process.env.RESEND_FROM_EMAIL || "CaseAssist <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: htmlBody,
    };

    // Set reply-to as the user's actual email so replies go to them
    if (senderEmail) {
      emailPayload.reply_to = senderEmail;
    }

    if (cc) emailPayload.cc = Array.isArray(cc) ? cc : [cc];
    if (bcc) emailPayload.bcc = Array.isArray(bcc) ? bcc : [bcc];

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
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
