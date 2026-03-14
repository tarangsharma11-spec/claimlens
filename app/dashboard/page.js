import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import DashboardClient from "./client";

/**
 * Dashboard page — server component.
 *
 * Auth flow:
 * 1. No session → redirect to /login
 * 2. Session but no org → redirect to /setup
 * 3. Session + org → render dashboard with org context
 *
 * The org membership check happens client-side via useOrg() hook
 * since Vercel Postgres can't be called directly in server components
 * without the connection pooling setup. The client-side hook handles
 * the /setup redirect if no org is found.
 */
export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardClient
      user={{
        email: session.user.email,
        name: session.user.name || session.user.email,
        image: session.user.image,
      }}
    />
  );
}
