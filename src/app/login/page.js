import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, Admin } from "@/lib/db";
import { decode } from "@/lib/auth";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
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
  if (claims) {
    await db();
    const account = await Admin.exists({
      _id: claims.sub,
      isActive: true,
      sessionVersion: claims.version,
    });
    if (account) redirect("/admin");
  }

  return <LoginForm />;
}
