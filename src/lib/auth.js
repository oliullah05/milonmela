import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { Admin, Limit } from "./db";
function secret() {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)
    throw new Error("AUTH_SECRET must contain at least 32 characters");
  return process.env.AUTH_SECRET;
}
export function token(payload, expiresIn = "15m") {
  return jwt.sign(payload, secret(), {
    expiresIn,
    issuer: "milonmela",
    audience: "admin",
  });
}
export function decode(value) {
  return jwt.verify(value, secret(), {
    issuer: "milonmela",
    audience: "admin",
    algorithms: ["HS256"],
  });
}
export async function admin() {
  try {
    const jar = await cookies();
    const p = decode(jar.get("access")?.value);
    if (p.kind !== "access") return null;
    return await Admin.findOne({
      _id: p.sub,
      isActive: true,
      sessionVersion: p.version,
    });
  } catch {
    return null;
  }
}
export async function requireAdmin() {
  const a = await admin();
  if (!a)
    throw Object.assign(new Error("অনুগ্রহ করে অ্যাডমিন লগইন করুন।"), {
      status: 401,
    });
  return a;
}
export async function session(a) {
  const c = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  };
  const payload = { sub: String(a._id), version: a.sessionVersion };
  c.set("access", token({ ...payload, kind: "access" }), {
    ...opts,
    maxAge: 900,
  });
  c.set("refresh", token({ ...payload, kind: "refresh" }, "7d"), {
    ...opts,
    maxAge: 604800,
  });
}
export async function rate(req, scope, max = 10) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const bucket = Math.floor(Date.now() / 600000);
  const key = createHash("sha256")
    .update(`${scope}:${ip}:${bucket}`)
    .digest("hex");
  const r = await Limit.findByIdAndUpdate(
    key,
    {
      $inc: { count: 1 },
      $setOnInsert: { expires: new Date(Date.now() + 1200000) },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (r.count > max)
    throw Object.assign(
      new Error("অনেকবার চেষ্টা করা হয়েছে। ১০ মিনিট পর আবার চেষ্টা করুন।"),
      { status: 429 },
    );
}
export function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin)
    throw Object.assign(new Error("Invalid request origin"), { status: 403 });
}


