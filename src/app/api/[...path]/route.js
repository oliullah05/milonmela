import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import {
  db,
  Student,
  Admin,
  nextRegistrationNumber,
  registrationState,
  settings,
  Setting,
  isOpen,
  toDhakaISO,
  getAdminStats,
  getAdminStudents,
} from "@/lib/db";
import {
  admin,
  requireAdmin,
  session,
  token,
  decode,
  rate,
  sameOrigin,
} from "@/lib/auth";
import { registration, mobile, payment } from "@/lib/validation";
export const runtime = "nodejs";
const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
async function lookupId() {
  try {
    const jar = await cookies();
    const claims = decode(jar.get("lookup")?.value);
    return claims.kind === "lookup" ? claims.sub : null;
  } catch {
    return null;
  }
}
async function bodyJson(req) {
  const reader = req.body?.getReader();
  if (!reader) fail("Request body is required");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32768) {
      await reader.cancel();
      fail("Request is too large", 413);
    }
    chunks.push(Buffer.from(value));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    fail("Invalid JSON request");
  }
}
function filters(url) {
  const p = url.searchParams;
  const f = {};
  for (const k of ["applicationStatus", "paymentStatus", "method"])
    if (p.get(k)) f[k] = p.get(k);
  if (p.get("batchYear")) f.batchYear = Number(p.get("batchYear"));
  if (p.get("attended"))
    f.attendedAt = p.get("attended") === "yes" ? { $ne: null } : null;
  const q = p.get("q")?.slice(0, 100);
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    f.$or = [
      "name",
      "mobile",
      "registrationNumber",
      "transactionId",
      "senderMobileNumber",
    ].map((k) => ({ [k]: { $regex: safe, $options: "i" } }));
  }
  return f;
}
async function handle(req, context) {
  try {
    const { path } = await context.params;
    const route = path.join("/");
    const url = new URL(req.url);
    const readOnly =
      route === "settings" ||
      route === "auth/me" ||
      route === "slip" ||
      route === "admin/stats" ||
      route === "admin/students" ||
      route === "admin/export" ||
      path[0] === "verify";
    const allowed = readOnly
      ? ["GET"]
      : route === "admin/settings"
        ? ["GET", "PATCH"]
        : path[0] === "admin" && path[1] === "students"
          ? ["PATCH"]
          : ["POST"];
    if (!allowed.includes(req.method))
      return json({ error: "Method not allowed" }, 405);
    if (req.method !== "GET") sameOrigin(req);
    await db();
    if (route === "settings" && req.method === "GET") {
      const s = await settings();
      return json({ ...s, ...registrationState(s) });
    }
    if (route === "auth/me") {
      const a = await requireAdmin();
      return json({
        name: a.name,
        email: a.email,
        mustChangePassword: a.mustChangePassword,
      });
    }
    if (route === "auth/login") {
      await rate(req, "login", 8);
      const b = await bodyJson(req);
      const a = await Admin.findOne({
        email: String(b.email).toLowerCase().trim(),
        isActive: true,
      });
      if (!a || !(await bcrypt.compare(String(b.password), a.passwordHash)))
        fail("ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।", 401);
      await session(a);
      return json({ ok: true });
    }
    if (route === "auth/refresh") {
      const c = await cookies();
      let p;
      try {
        p = decode(c.get("refresh")?.value);
      } catch {
        fail("Session expired", 401);
      }
      if (p.kind !== "refresh") fail("Invalid session", 401);
      const a = await Admin.findOne({
        _id: p.sub,
        sessionVersion: p.version,
        isActive: true,
      });
      if (!a) fail("Session expired", 401);
      await session(a);
      return json({ ok: true });
    }
    if (route === "auth/logout") {
      const a = await admin();
      if (a)
        await Admin.updateOne({ _id: a._id }, { $inc: { sessionVersion: 1 } });
      const c = await cookies();
      c.delete("access");
      c.delete("refresh");
      return json({ ok: true });
    }
    if (route === "auth/password") {
      const a = await requireAdmin();
      const b = await bodyJson(req);
      if (!(await bcrypt.compare(String(b.currentPassword), a.passwordHash)))
        fail("বর্তমান পাসওয়ার্ড সঠিক নয়।");
      const password = z.string().min(12).max(128).parse(b.password);
      a.passwordHash = await bcrypt.hash(password, 12);
      a.mustChangePassword = false;
      a.sessionVersion += 1;
      await a.save();
      await session(a);
      return json({ ok: true });
    }
    if (route === "register") {
      await rate(req, "register", 10);
      const s = await settings();
      if (!isOpen(s)) fail("রেজিস্ট্রেশন বন্ধ রয়েছে।", 403);
      const b = registration.parse(await bodyJson(req));
      if (
        b.photoUrl &&
        !b.photoUrl.startsWith(
          `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`,
        )
      )
        fail("Invalid photo");
      if (await Student.exists({ mobile: b.mobile }))
        fail(
          "এই নম্বর দিয়ে ইতোমধ্যে রেজিস্ট্রেশন করা হয়েছে। স্ট্যাটাস দেখুন।",
          409,
        );
      if (
        await Student.exists({
          method: b.method,
          transactionId: b.transactionId,
          applicationStatus: { $ne: "rejected" },
        })
      )
        fail(
          "এই TrxID দিয়ে ইতোমধ্যে আবেদন করা হয়েছে। অনুগ্রহ করে আপনার নিজস্ব সঠিক TrxID দিন।",
          409,
        );
      const now = new Date();
      const st = await Student.create({
        ...b,
        createdAtDhaka: toDhakaISO(now),
        registrationNumber: await nextRegistrationNumber(),
        verificationToken: randomBytes(32).toString("hex"),
      });
      return json(
        {
          registrationNumber: st.registrationNumber,
          statusPath: `/status?id=${encodeURIComponent(st.registrationNumber)}`,
        },
        201,
      );
    }
    if (route === "status") {
      await rate(req, "status", 20);
      const b = await bodyJson(req);
      const identifier = z
        .string()
        .trim()
        .min(1)
        .max(64)
        .parse(b.id ?? b.mobile)
        .replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
      const phone = mobile.safeParse(identifier);
      let query;
      if (phone.success) query = { mobile: phone.data };
      else if (
        /^[1-9]\d{0,9}$/.test(identifier) ||
        /^REU-\d{4}-\d+$/i.test(identifier)
      )
        query = { registrationNumber: identifier.toUpperCase() };
      else
        fail(
          "অনুগ্রহ করে ভালো করে সঠিক মোবাইল নম্বর অথবা রেজিস্ট্রেশন ID দিন।",
        );
      const st = await Student.findOne(query).lean();
      if (!st)
        fail(
          "এই মোবাইল নম্বর বা ID দিয়ে কোনো আবেদন পাওয়া যায়নি। অনুগ্রহ করে ভালো করে সঠিক ID বা নম্বর দিন, অথবা আগে রেজিস্ট্রেশন না করে থাকলে নতুন রেজিস্ট্রেশন করুন।",
          404,
        );
      const c = await cookies();
      c.set("lookup", token({ sub: String(st._id), kind: "lookup" }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 900,
        path: "/",
      });
      return json({
        name: st.name,
        mobile: st.mobile,
        batchYear: st.batchYear,
        registrationNumber: st.registrationNumber,
        applicationStatus: st.applicationStatus,
        paymentStatus: st.paymentStatus,
        rejectionReason: st.rejectionReason,
        createdAt: st.createdAtDhaka || toDhakaISO(st.createdAt),
        approvedAt:
          st.approvedAtDhaka || (st.approvedAt ? toDhakaISO(st.approvedAt) : null),
        attendedAt:
          st.attendedAtDhaka || (st.attendedAt ? toDhakaISO(st.attendedAt) : null),
        statusPath: `/status?id=${encodeURIComponent(st.registrationNumber)}`,
      });
    }
    if (route === "correction") {
      await rate(req, "correction", 10);
      const b = payment.parse(await bodyJson(req));
      const currentId = await lookupId();
      if (!currentId) fail("সংশোধনের অনুমতি নেই।", 403);
      if (
        await Student.exists({
          _id: { $ne: currentId },
          method: b.method,
          transactionId: b.transactionId,
          applicationStatus: { $ne: "rejected" },
        })
      )
        fail(
          "এই TrxID দিয়ে ইতোমধ্যে অন্য একটি আবেদন রয়েছে। আপনার সঠিক TrxID দিন।",
          409,
        );
      const st = await Student.findOneAndUpdate(
        {
          _id: currentId,
          paymentStatus: "correction_required",
        },
        {
          $set: {
            ...b,
            paymentStatus: "pending",
            applicationStatus: "pending",
            rejectionReason: "",
            approvedAt: null,
            approvedBy: null,
          },
          $inc: { revision: 1 },
        },
        { returnDocument: "after" },
      );
      if (!st) fail("সংশোধনের অনুমতি নেই।", 403);
      return json({ ok: true });
    }
    if (route === "upload") {
      await rate(req, "upload", 12);
      const data = await req.formData();
      const file = data.get("photo");
      if (
        !file ||
        file.size > 2 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        fail("সর্বোচ্চ ২ MB JPG, PNG বা WebP ছবি দিন।");
      const buf = Buffer.from(await file.arrayBuffer());
      const valid =
        (buf[0] === 255 && buf[1] === 216) ||
        buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ||
        (buf.subarray(0, 4).toString() === "RIFF" &&
          buf.subarray(8, 12).toString() === "WEBP");
      if (!valid) fail("Invalid image content");
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      const result = await new Promise((resolve, reject) =>
        cloudinary.uploader
          .upload_stream(
            {
              folder: "milonmela",
              resource_type: "image",
              transformation: [
                { width: 600, height: 600, crop: "limit" },
                { quality: "auto" },
              ],
            },
            (e, r) => (e ? reject(e) : resolve(r)),
          )
          .end(buf),
      );
      return json({ url: result.secure_url });
    }
    if (path[0] === "verify") {
      const st = await Student.findOne({ verificationToken: path[1] }).lean();
      if (!st) fail("অকার্যকর QR / Invalid verification", 404);
      const a = await admin();
      return json(
        a
          ? { ...st, admin: true }
          : {
              name: st.name.slice(0, 3) + "…",
              batchYear: st.batchYear,
              registrationNumber: st.registrationNumber,
              applicationStatus:
                st.paymentStatus === "verified"
                  ? st.applicationStatus
                  : "invalid",
              attendedAt: st.attendedAt,
            },
      );
    }
    if (route === "slip") {
      const st = await Student.findOne({
        _id: await lookupId(),
        applicationStatus: "approved",
        paymentStatus: "verified",
      }).lean();
      if (!st) fail("শুধু অনুমোদিত ও যাচাইকৃত আবেদনকারীরা স্লিপ পাবেন।", 403);
      const { makeSlip } = await import("@/lib/pdf");
      const bytes = await makeSlip(st, await settings(), url.origin);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${st.registrationNumber}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const a = await requireAdmin();
    if (route === "admin/settings") {
      if (req.method === "GET") {
        const s = await settings();
        return json({ ...s, ...registrationState(s) });
      }
      const b = z
        .object({
          registrationOpen: z.boolean(),
          overrideDeadline: z.boolean(),
          eventDateTime: z.iso.datetime({ offset: true }),
          eventTitle: z.string().min(3).max(150),
          eventHijriDate: z.string().max(100),
        })
        .parse(await bodyJson(req));
      const updated = await Setting.findByIdAndUpdate(
        "event",
        { $set: b },
        { returnDocument: "after" },
      ).lean();
      return json({ ...updated, ...registrationState(updated) });
    }
    if (route === "admin/stats") {
      const stats = await getAdminStats();
      return json(stats);
    }
    if (route === "admin/students" || route === "admin/export") {
      const f = filters(url);
      if (route === "admin/export") {
        const rows = await Student.find(f).sort({ createdAt: -1 }).lean();
        const keys = [
          "registrationNumber",
          "name",
          "mobile",
          "batchYear",
          "bloodGroup",
          "email",
          "address",
          "applicationStatus",
          "paymentStatus",
          "method",
          "amount",
          "transactionId",
          "senderMobileNumber",
          "createdAt",
          "verifiedAt",
          "verifiedByName",
          "approvedAt",
          "approvedByName",
          "attendedAt",
          "attendedByName",
        ];
        const cell = (v) =>
          '"' +
          String(v ?? "")
            .replace(/^[=+@\-\t\r]/, "'$&")
            .replaceAll('"', '""') +
          '"';
        return new Response(
          "\uFEFF" +
            [
              keys,
              ...rows.map((r) =>
                keys.map((k) =>
                  r[k] instanceof Date
                    ? toDhakaISO(r[k])
                    : (r[k] ?? ""),
                ),
              ),
            ]
              .map((r) => r.map(cell).join(","))
              .join("\r\n"),
          {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": 'attachment; filename="registrations.csv"',
              "Cache-Control": "no-store",
            },
          },
        );
      }
      const page = Math.max(
        1,
        Math.min(100000, Number(url.searchParams.get("page")) || 1),
      );
      const data = await getAdminStudents(f, page, 15);
      return json(data);
    }
    if (route === "admin/checkin") {
      const b = await bodyJson(req);
      let query;
      if (b.token) {
        query = { verificationToken: String(b.token) };
      } else if (b.id) {
        query = { _id: b.id };
      } else {
        const raw = String(b.registrationNumber || b.identifier || "").trim();
        const digits = raw.replace(/\D/g, "");
        if (
          (/^01\d{9}$/.test(raw) || /^\+?8801\d{9}$/.test(raw)) &&
          digits.length >= 11
        ) {
          query = { mobile: digits.slice(-11) };
        } else {
          query = { registrationNumber: raw };
        }
      }
      const now = new Date();
      const nowDhaka = toDhakaISO(now);
      const adminName = a.name || a.email.split("@")[0];
      const st = await Student.findOneAndUpdate(
        {
          ...query,
          applicationStatus: "approved",
          paymentStatus: "verified",
          attendedAt: null,
        },
        {
          $set: {
            attendedAt: now,
            attendedAtDhaka: nowDhaka,
            attendedBy: String(a._id),
            attendedByName: adminName,
          },
          $inc: { revision: 1 },
        },
        { returnDocument: "after" },
      );
      if (st) return json({ message: "উপস্থিতি নিশ্চিত হয়েছে", student: st });
      const old = await Student.findOne(query);
      if (!old) {
        fail("এই রেজিস্ট্রেশন বা মোবাইল নম্বরে কোনো আবেদনকারী পাওয়া যায়নি।", 404);
      }
      if (old.attendedAt) {
        return json({
          message: "Already Attended — আগেই উপস্থিতি নিশ্চিত করা হয়েছে",
          student: old,
        });
      }
      fail("আবেদন অনুমোদিত ও পেমেন্ট যাচাইকৃত হতে হবে।");
    }
    if (path[0] === "admin" && path[1] === "students" && path[2]) {
      const b = await bodyJson(req);
      const st = await Student.findById(path[2]);
      if (!st) fail("Not found", 404);
      const revision = st.revision;
      if (b.action === "edit") {
        const data = registration.parse({ ...st.toObject(), ...b.data });
        if (
          st.paymentStatus === "verified" &&
          (data.transactionId !== st.transactionId || data.method !== st.method)
        )
          fail("যাচাইকৃত পেমেন্ট পরিবর্তন করা যাবে না।");
        if (
          (data.transactionId !== st.transactionId || data.method !== st.method) &&
          (await Student.exists({
            _id: { $ne: st._id },
            method: data.method,
            transactionId: data.transactionId,
            applicationStatus: { $ne: "rejected" },
          }))
        )
          fail("এই TrxID দিয়ে ইতোমধ্যে অন্য একটি আবেদন রয়েছে।", 409);
        Object.assign(st, data);
      } else if (b.action === "payment") {
        const status = z
          .enum(["verified", "rejected", "correction_required"])
          .parse(b.status);
        if (st.attendedAt)
          fail(
            "উপস্থিতি নিশ্চিত হওয়ার পরে পেমেন্টের সিদ্ধান্ত পরিবর্তন করা যাবে না।",
            409,
          );
        if (status === "verified") {
          const verifiedAmount = Number(b.amount);
          if (
            !Number.isFinite(verifiedAmount) ||
            verifiedAmount < 200 ||
            b.confirmed !== true
          )
            fail("লেনদেন মিলিয়ে কমপক্ষে ২০০ টাকা নিশ্চিত করুন।");
          if (
            await Student.exists({
              _id: { $ne: st._id },
              method: st.method,
              transactionId: st.transactionId,
              paymentStatus: "verified",
            })
          )
            fail("এই TrxID ইতোমধ্যে যাচাই করা হয়েছে।");
          const now = new Date();
          const nowDhaka = toDhakaISO(now);
          const adminName = a.name || a.email.split("@")[0];
          st.amount = verifiedAmount;
          st.verifiedAt ||= now;
          st.verifiedAtDhaka ||= nowDhaka;
          st.verifiedBy ||= String(a._id);
          st.verifiedByName ||= adminName;
          st.applicationStatus = "approved";
          st.approvedAt ||= now;
          st.approvedAtDhaka ||= nowDhaka;
          st.approvedBy ||= String(a._id);
          st.approvedByName ||= adminName;
        } else {
          st.verifiedAt = null;
          st.verifiedAtDhaka = null;
          st.verifiedBy = null;
          st.verifiedByName = null;
          st.applicationStatus = status === "rejected" ? "rejected" : "pending";
          st.approvedAt = null;
          st.approvedAtDhaka = null;
          st.approvedBy = null;
          st.approvedByName = null;
        }
        st.paymentStatus = status;
        st.rejectionReason =
          status === "verified" ? "" : String(b.reason || "").slice(0, 500);
      } else fail("Invalid action");
      const changes = st.toObject();
      delete changes._id;
      delete changes.__v;
      delete changes.revision;
      const updated = await Student.findOneAndUpdate(
        { _id: st._id, revision },
        { $set: changes, $inc: { revision: 1 } },
        { returnDocument: "after" },
      );
      if (!updated)
        fail("অন্য অ্যাডমিন তথ্য পরিবর্তন করেছেন। আবার খুলুন।", 409);
      return json(updated);
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(" · "),
        },
        400,
      );
    if (e.code === 11000)
      return json(
        { error: "এই মোবাইল নম্বর বা রেকর্ডটি ইতোমধ্যে ব্যবহৃত হয়েছে।" },
        409,
      );
    if (!e.status) console.error("API error:", e.name, e.message);
    return json(
      {
        error: e.status
          ? e.message
          : "সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না। একটু পরে চেষ্টা করুন।",
      },
      e.status || 503,
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH };
