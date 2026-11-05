"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
export async function api(path, body, method) {
  let r = await fetch("/api/" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && path !== "auth/login" && path !== "auth/refresh") {
    const refresh = await fetch("/api/auth/refresh", { method: "POST" });
    if (refresh.ok)
      r = await fetch("/api/" + path, {
        method: method || (body ? "POST" : "GET"),
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
  }
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "অনুরোধ সম্পন্ন হয়নি");
  return data;
}
export const date = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "long",
    timeStyle: "short",
  });
};
export function Icon({ name, size = 22 }) {
  const paths = {
    arrow: "M5 12h14m-6-6 6 6-6 6",
    calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2",
    pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8m6 10v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    check: "m5 12 4 4L19 6",
    shield: "M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7L12 3Zm-4 9 3 3 5-6",
    clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
    book: "M12 5C8 2 3 3 2 4v15c4-2 7-1 10 1m0-15c4-3 9-2 10-1v15c-4-2-7-1-10 1V5",
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.book} />
    </svg>
  );
}
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brandmark">
        <Icon name="book" size={28} />
      </span>
      <span>
        মিলনমেলা<small>চুপাইর জামিউল উলুম আলিম মাদরাসা</small>
      </span>
    </Link>
  );
}
export function Header({ active = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="header">
      <div className="container nav">
        <Brand />
        <button
          className="menu-toggle"
          onClick={() => setOpen(!open)}
          aria-label="মেনু খুলুন"
        >
          ☰
        </button>
        <nav className={open ? "navlinks expanded" : "navlinks"}>
          <Link className={active === "home" ? "active" : ""} href="/">
            মূলপাতা
          </Link>
          <Link href="/#about">আয়োজন সম্পর্কে</Link>
          <Link href="/#schedule">অনুষ্ঠানসূচি</Link>
          <Link className={active === "status" ? "active" : ""} href="/status">
            আবেদনের স্ট্যাটাস
          </Link>
        </nav>
        <Link className="button small nav-cta" href="/register">
          রেজিস্ট্রেশন করুন <Icon name="arrow" size={17} />
        </Link>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer>
      <div className="container footer-inner">
        <Brand />
        <p>শেকড়ের টানে, আবার একসাথে।</p>
      </div>
      <div className="container copyright">
        © ২০২৭ চুপাইর জামিউল উলুম আলিম মাদরাসা · সর্বস্বত্ব সংরক্ষিত{" "}
        <span>ভালোবাসা ও ভ্রাতৃত্বের ৫০ বছর</span>
      </div>
    </footer>
  );
}
export function PublicShell({ children, active }) {
  return (
    <>
      <Header active={active} />
      {children}
      <Footer />
    </>
  );
}
export function Field({ label, optional, children, ...props }) {
  return (
    <label className="field">
      <span>
        {label} {optional ? <small> (ঐচ্ছিক)</small> : <em>*</em>}
      </span>
      {children || <input {...props} />}
    </label>
  );
}
export function Alert({ children, success = false }) {
  const hasContent = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);
  return hasContent ? (
    <div role="status" className={"alert " + (success ? "success" : "")}>
      {children}
    </div>
  ) : null;
}
export function Badge({ value }) {
  const labels = {
    pending: "অপেক্ষমান",
    approved: "অনুমোদিত",
    rejected: "বাতিল",
    verified: "যাচাইকৃত",
    correction_required: "সংশোধন প্রয়োজন",
    invalid: "অকার্যকর",
  };
  return <span className={"badge " + value}>{labels[value] || value}</span>;
}
export function useSettings() {
  const [s, set] = useState(null);
  const [e, error] = useState("");
  useEffect(() => {
    api("settings")
      .then(set)
      .catch((x) => error(x.message));
  }, []);
  return [s, e];
}
