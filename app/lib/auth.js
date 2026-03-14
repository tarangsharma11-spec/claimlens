import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { sql } from "@vercel/postgres";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const result = await sql`
            SELECT id, email, password_hash, name, role, status, org_id
            FROM users WHERE email = ${credentials.email.toLowerCase()}
          `;
          const user = result.rows[0];
          if (!user) return null;
          if (user.status === "disabled") return null;
          const valid = await bcrypt.compare(credentials.password, user.password_hash);
          if (!valid) return null;
          return { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.org_id };
        } catch (err) {
          console.error("Auth error:", err);
          return null;
        }
      },
    }),

    ...(process.env.GOOGLE_CLIENT_ID ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    })] : []),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true;

      const email = user.email?.toLowerCase();
      if (!email) return false;

      try {
        const existing = await sql`SELECT id, status FROM users WHERE email = ${email}`;
        if (existing.rows.length > 0) {
          if (existing.rows[0].status === "disabled") return false;
          return true;
        }

        const invite = await sql`
          SELECT m.id, m.org_id, m.role, m.user_name, o.name as org_name
          FROM memberships m
          JOIN organizations o ON o.id = m.org_id
          WHERE m.user_email = ${email} AND m.status = 'invited'
          LIMIT 1
        `;

        if (invite.rows.length === 0) return false;

        const inviteRow = invite.rows[0];
        const name = user.name || profile?.name || inviteRow.user_name || email.split("@")[0];
        const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);

        await sql`
          INSERT INTO users (email, password_hash, name, role, status, org_id, created_at)
          VALUES (${email}, ${passwordHash}, ${name}, 'user', 'active', ${inviteRow.org_id}, NOW())
          ON CONFLICT (email) DO UPDATE SET org_id = ${inviteRow.org_id}, status = 'active'
        `;

        await sql`
          UPDATE memberships SET status = 'active', joined_at = NOW(), user_name = ${name}
          WHERE id = ${inviteRow.id}
        `;

        await sql`
          INSERT INTO activity_log (org_id, user_email, action, detail)
          VALUES (${inviteRow.org_id}, ${email}, 'member_joined', ${name + ' joined via Google SSO as ' + inviteRow.role})
        `;

        try {
          const RESEND_API_KEY = process.env.RESEND_API_KEY;
          if (RESEND_API_KEY) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: process.env.RESEND_FROM_EMAIL || "CaseAssist <onboarding@resend.dev>",
                to: [email],
                subject: "Welcome to CaseAssist",
                html: '<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#1D1D1F"><div style="padding:24px 0;border-bottom:2px solid #E8EAEF"><div style="display:inline-flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#1A1040,#3B5EC0);display:inline-flex;align-items:center;justify-content:center"><span style="color:#fff;font-size:13px;font-weight:800">CA</span></div><span style="font-size:16px;font-weight:700">CaseAssist</span></div></div><div style="padding:28px 0"><h1 style="font-size:22px;font-weight:700;margin:0 0 12px">Welcome to ' + inviteRow.org_name + ', ' + name + '!</h1><p style="font-size:14px;color:#6E6F76;line-height:1.7">Your account is active. You\'ve joined as <strong>' + inviteRow.role + '</strong>.</p><div style="margin-top:24px"><a href="https://www.caseassist.ca/dashboard" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#1A1040,#3B5EC0);color:#fff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600">Open CaseAssist</a></div></div></div>',
              }),
            });
          }
        } catch {}

        return true;
      } catch (err) {
        console.error("SSO signIn callback error:", err);
        return false;
      }
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.provider = account?.provider;
      }
      if (token.email) {
        try {
          const result = await sql`
            SELECT id, email, name, role, status, org_id FROM users WHERE email = ${token.email.toLowerCase()}
          `;
          if (result.rows[0]) {
            token.userId = result.rows[0].id;
            token.role = result.rows[0].role;
            token.orgId = result.rows[0].org_id;
            token.status = result.rows[0].status;
          }
        } catch {}
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.role = token.role;
        session.user.orgId = token.orgId;
        session.user.status = token.status;
        session.user.provider = token.provider;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      return baseUrl + "/dashboard";
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  secret: process.env.NEXTAUTH_SECRET,
};
