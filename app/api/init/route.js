import { NextResponse } from "next/server";
import { initDB } from "@/lib/db";

// GET /api/init — creates all database tables
// Call this once after your first deploy:
//   curl https://your-app.vercel.app/api/init
// Then remove or protect this endpoint.
export async function GET() {
  try {
    await initDB();
    return NextResponse.json({ success: true, message: "Database tables created." });
  } catch (err) {
    console.error("DB init error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
