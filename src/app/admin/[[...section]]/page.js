import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  db,
  Admin,
  settings,
  registrationState,
  getAdminStats,
  getAdminStudents,
} from "@/lib/db";
import { decode } from "@/lib/auth";
import Dashboard from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export async function generateMetadata(props) {
  const params = await props.params;
  const section = params?.section?.[0];
  const titles = {
    overview: "ড্যাশবোর্ড",
    students: "আবেদনকারীদের তালিকা",
    attendance: "উপস্থিতি / Check-in",
    settings: "ইভেন্ট সেটিংস",
    security: "অ্যাকাউন্ট নিরাপত্তা",
    account: "অ্যাকাউন্ট নিরাপত্তা",
  };
  const title = titles[section] || "অ্যাডমিন প্যানেল";
  return {
    title: `${title} | মিলনমেলা — চুপাইর জামিউল উলুম আলিম মাদরাসা`,
  };
}

export default async function AdminPage(props) {
  const jar = await cookies();
  let claims;
  for (const kind of ["access", "refresh"]) {
    try {
      const value = decode(jar.get(kind)?.value);
      if (value.kind === kind) {
        claims = value;
        break;
      }
    } catch {}
  }
  if (!claims) redirect("/login");
  await db();
  const [account, s, initialStats, initialList] = await Promise.all([
    Admin.findById(claims.sub).lean(),
    settings(),
    getAdminStats(),
    getAdminStudents({}, 1, 15),
  ]);
  if (
    !account ||
    !account.isActive ||
    account.sessionVersion !== claims.version
  ) {
    redirect("/login");
  }

  const initialAdmin = {
    name: account.name || account.email.split("@")[0],
    email: account.email,
    mustChangePassword: Boolean(account.mustChangePassword),
  };
  const state = registrationState(s);
  const initialSettings = JSON.parse(JSON.stringify({ ...s, ...state }));

  const params = await props.params;
  const section = params?.section?.[0];

  let tab = "overview";
  if (section === "students") tab = "students";
  else if (section === "attendance") tab = "attendance";
  else if (section === "settings") tab = "settings";
  else if (section === "security" || section === "account") tab = "account";
  else if (section) {
    redirect("/admin");
  }

  return (
    <Dashboard
      initialTab={tab}
      initialAdmin={initialAdmin}
      initialSettings={initialSettings}
      initialStats={initialStats}
      initialList={initialList}
    />
  );
}

