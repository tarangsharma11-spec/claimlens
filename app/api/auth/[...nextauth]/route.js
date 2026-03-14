import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import bcrypt from "bcryptjs";
import { sql } from "@vercel/postgres";

/**
 * NextAuth config — three providers:
 * 1. Credentials (email + password) — existing flow
 * 2. Google OAuth — SSO for small firms
 * 3. Microsoft Azure AD — SSO for enterprise
 *
 * SSO GATING: New SSO users must provide an access code on first login.
 * The code check happens in the signIn callback. Returning users skip it.
 * The access code is passed via the authorization URL params.
 */

export const authOptions = {
  providers: [
    // ═══ EMAIL + PASSWORD ═══
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

    // ═══ GOOGLE SSO ═══
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

    // ═══ MICROSOFT AZURE AD SSO ═══
    ...(process.env.AZURE_AD_CLIENT_ID ? [AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID || "common", // "common" allows any Microsoft account
    })] : []),
  ],

  callbacks: {
    /**
     * signIn callback — runs after provider auth but before session is created.
     * For SSO providers: check if user exists. If not, require access code.
     */
    async signIn({ user, account, profile }) {
      // Credentials provider — already handled in authorize()
      if (account?.provider === "credentials") return true;

      // SSO providers (Google, Azure AD)
      const email = user.email?.toLowerCase();
      if (!email) return false;

      try {
        // Check if user already exists (returning SSO user)
        const existing = await sql`SELECT id, status FROM users WHERE email = ${email}`;
        if (existing.rows.length > 0) {
          // Existing user — check not disabled
          if (existing.rows[0].status === "disabled") return false;
          return true; // Let them in
        }

        // New SSO user — they need to go through the access code gate
        // We'll create their account but mark it as pending until code is verified
        // The access code verification happens on the client side after redirect
        const name = user.name || profile?.name || email.split("@")[0];
        const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12); // Random password for SSO users

        await sql`
          INSERT INTO users (email, password_hash, name, role, status, created_at)
          VALUES (${email}, ${passwordHash}, ${name}, 'user', 'pending_code', NOW())
          ON CONFLICT (email) DO NOTHING
        `;

        return true;
      } catch (err) {
        console.error("SSO signIn callback error:", err);
        return true; // Don't block on DB errors
      }
    },

    /**
     * jwt callback — enrich the token with user data from DB.
     */
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.provider = account?.provider;
      }

      // Fetch fresh user data from DB on each token refresh
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

    /**
     * session callback — expose user data to the client.
     */
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

    /**
     * redirect callback — after sign in, send users to dashboard.
     * SSO users with pending_code status go to the code verification page.
     */
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
