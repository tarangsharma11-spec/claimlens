# ClaimLens

**Workers' Compensation Claims Intelligence Platform**

AI-powered claims analysis against the WSIB Operational Policy Manual and medical evidence standards. Built for injury lawyers, WSIB employees, and employers.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Vercel                       │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐ │
│  │ Next.js  │  │ API Routes│  │ Vercel    │ │
│  │ Frontend │→ │ /api/chat │→ │ Postgres  │ │
│  │ (React)  │  │ /api/auth │  │ (Users,   │ │
│  └──────────┘  │ /api/inv. │  │  Claims)  │ │
│                └─────┬─────┘  └───────────┘ │
│                      │                       │
│                      ▼                       │
│              Anthropic API                   │
│          (server-side only,                  │
│           key never in browser)              │
└─────────────────────────────────────────────┘
```

## Quick Start (Deploy in ~15 minutes)

### 1. Push to GitHub

```bash
cd claimlens
git init
git add .
git commit -m "Initial ClaimLens setup"
# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USER/claimlens.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"** → Import your `claimlens` repo
3. Vercel auto-detects Next.js — click **Deploy**
4. Wait for the build to complete (~2 minutes)

### 3. Add a Postgres Database

1. In your Vercel project dashboard, go to **Storage** tab
2. Click **Create Database** → Choose **Postgres**
3. Name it `claimlens-db` → Click **Create**
4. Vercel automatically adds the `POSTGRES_*` env vars to your project

### 4. Set Environment Variables

In your Vercel dashboard → **Settings** → **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (`sk-ant-...`) |
| `NEXTAUTH_SECRET` | Random string (run `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Your Vercel URL (e.g. `https://claimlens.vercel.app`) |

The `POSTGRES_*` variables are already set from step 3.

### 5. Initialize the Database

After deploying with the env vars set, visit:

```
https://your-app.vercel.app/api/init
```

This creates all the database tables. You should see `{"success":true}`.

### 6. Create the Admin User

Option A — Use the seed script locally:
```bash
# Copy your Vercel Postgres env vars to .env.local first
npm run seed
```

Option B — Or manually insert via the Vercel Postgres console:
```sql
INSERT INTO users (email, password_hash, name, role, status)
VALUES (
  'admin@yourcompany.com',
  -- bcrypt hash of 'changeme123':
  '$2a$12$LJ3lGJxFgOyZ1GW/sPmxq.ynQE3VUFXBFBqjFTT6QGPGHbR4OKFHK',
  'Admin',
  'admin',
  'active'
);
```

### 7. Create Invite Codes

1. Log in as admin at `https://your-app.vercel.app/login`
2. Invite codes can be created via API:

```bash
# From your terminal (or Postman)
curl -X POST https://your-app.vercel.app/api/invites \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_COOKIE" \
  -d '{"email": "lawyer@firm.com", "role": "user", "expiresInDays": 30}'
```

Or build an admin panel (see below).

### 8. Share with Users

Send the invite code to your users. They go to:
```
https://your-app.vercel.app/login
```
→ Click "Create Account" → Enter invite code + email + password → Done.

---

## Project Structure

```
claimlens/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.js   # NextAuth config
│   │   │   └── signup/route.js          # Invite-only signup
│   │   ├── chat/route.js                # Anthropic API proxy
│   │   ├── invites/route.js             # Invite code management
│   │   └── init/route.js                # DB table creation
│   ├── dashboard/
│   │   ├── page.js                      # Server component (auth gate)
│   │   └── client.js                    # Full ClaimLens portal UI
│   ├── login/page.js                    # Login + signup page
│   ├── layout.js                        # Root layout
│   ├── providers.js                     # Session provider
│   ├── globals.css                      # Global styles
│   └── page.js                          # Root redirect
├── lib/
│   └── db.js                            # Database schema + helpers
├── scripts/
│   └── seed-invite.mjs                  # Create first admin user
├── .env.example                         # Environment variables template
├── next.config.js
├── package.json
└── README.md
```

## Authentication Flow

```
User gets invite code from admin
        │
        ▼
  /login → "Create Account" tab
        │
        ▼
  Enter invite code + email + password
        │
        ▼
  POST /api/auth/signup
  → Validates invite code
  → Creates user (status: "active")
  → Marks invite as used
  → Auto-signs in via NextAuth
        │
        ▼
  Redirect to /dashboard (ClaimLens portal)
```

## Security Notes

- **API key**: Your Anthropic key is only in `process.env` on the server. It never reaches the browser. All AI calls go through `/api/chat`.
- **Auth**: NextAuth.js with JWT sessions. Server components check `getServerSession()` before rendering protected pages.
- **Invite-only**: No public signup. Users must have a valid, unused invite code.
- **Privacy**: The AI system prompt instructs ClaimLens to never output PII (names, SINs, SSNs, DOBs). Claims reference Claim IDs only.

## Next Steps

- [ ] Build admin panel for invite code management (UI for `/api/invites`)
- [ ] Move claims storage from localStorage to Vercel Postgres (use the DB helpers in `lib/db.js`)
- [ ] Add role-based views (lawyer sees only their claims, admin sees all)
- [ ] Add file upload to Vercel Blob storage for document persistence
- [ ] Custom domain setup in Vercel Dashboard → Settings → Domains
