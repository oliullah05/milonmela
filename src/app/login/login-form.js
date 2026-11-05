"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PublicShell, Field, Alert, Icon, api } from "@/components/shared";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api("auth/me")
      .then(() => router.replace("/admin"))
      .catch(() => {});
  }, [router]);

  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("auth/login", Object.fromEntries(new FormData(e.target)));
      router.push("/admin");
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <main className="login-page">
        <form className="panel login-card" onSubmit={login}>
          <span className="icon-box">
            <Icon name="shield" size={30} />
          </span>
          <div className="eyebrow">আয়োজক কমিটি</div>
          <h1>অ্যাডমিন লগইন</h1>
          <p>পুনর্মিলনী ব্যবস্থাপনায় স্বাগতম।</p>
          <Field
            label="ইমেইল"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          <Field
            label="পাসওয়ার্ড"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <Alert>{error}</Alert>
          <button className="button full" disabled={busy}>
            {busy ? "লগইন হচ্ছে…" : "লগইন করুন"} <Icon name="arrow" size={18} />
          </button>
          <div className="secure-note">
            <Icon name="shield" size={15} /> শুধুমাত্র অনুমোদিত অ্যাডমিনদের জন্য
          </div>
        </form>
      </main>
    </PublicShell>
  );
}

