import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import DashboardClient from "./client";

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardClient user={session.user} />;
}
