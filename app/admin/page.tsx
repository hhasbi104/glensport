import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/admin-auth";
import AdminDashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get("courtly_session")?.value ?? null,
  );

  if (!session) {
    redirect("/login");
  }
  if (session.role !== "admin") redirect("/");

  return <AdminDashboard />;
}
