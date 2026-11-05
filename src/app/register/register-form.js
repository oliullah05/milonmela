"use client";
import { useState } from "react";
import Link from "next/link";
import StatusLink from "@/components/status-link";
import { rememberRegistrationMobile } from "@/lib/status-handoff";
import {
  PublicShell,
  Field,
  Alert,
  Icon,
  api,
} from "@/components/shared";

async function compress(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("সর্বোচ্চ ১০ MB JPG, PNG অথবা WebP ছবি দিন");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
}

export default function RegisterForm({ initialSettings }) {
  const [s] = useState(initialSettings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [method, setMethod] = useState("nagad");
  const [photo, setPhoto] = useState(null);
  const [copied, setCopied] = useState(false);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText("01812945767");
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      try {
        const input = document.createElement("input");
        input.value = "01812945767";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {}
    }
  }

  const deadlineDateText = (() => {
    try {
      const dt = s?.eventDateTime
        ? new Date(s.eventDateTime)
        : new Date("2027-08-15T10:00:00+06:00");
      const dhakaDateStr = dt.toLocaleDateString("en-CA", {
        timeZone: "Asia/Dhaka",
      });
      const prev = new Date(dhakaDateStr + "T00:00:00+06:00");
      prev.setDate(prev.getDate() - 1);
      return prev.toLocaleDateString("bn-BD", {
        timeZone: "Asia/Dhaka",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "১৪ আগস্ট, ২০২৭";
    }
  })();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(e.target));
      delete data.photo;
      data.method = method;
      if (photo) {
        const form = new FormData();
        form.append("photo", await compress(photo), "photo.jpg");
        const r = await fetch("/api/upload", { method: "POST", body: form });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        data.photoUrl = d.url;
      }
      const result = await api("register", data);
      rememberRegistrationMobile(data.mobile);
      setDone({
        ...result,
        mobile: data.mobile,
        statusUrl: new URL(result.statusPath, window.location.origin).href,
      });
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <main className="container form-page">
        <div className="page-intro">
          <div className="eyebrow">পুনর্মিলনী ২০২৭</div>
          <h1>
            {s && !s.open
              ? "পুনর্মিলনীর রেজিস্ট্রেশন"
              : "শেকড়ের টানে, আবার একসাথে"}
          </h1>
          <p>
            {s && !s.open
              ? "আগের আবেদনের স্ট্যাটাস ও অনুমোদিত স্লিপ পাওয়া যাবে।"
              : "আপনার তথ্য দিয়ে মিলনমেলার অংশ হোন।"}
          </p>
        </div>
        {done ? (
          <div className="success-card">
            <span className="success-icon">
              <Icon name="check" size={35} />
            </span>
            <h2>আবেদন জমা হয়েছে!</h2>
            <p>
              রেজিস্ট্রেশন নম্বর: <strong>{done.registrationNumber}</strong>
            </p>
            <p>পেমেন্ট যাচাই চলছে। এটি এখনো অনুমোদিত রেজিস্ট্রেশন নয়।</p>
            <StatusLink url={done.statusUrl} />
            <Link
              className="button"
              href={done.statusPath}
              onClick={() => rememberRegistrationMobile(done.mobile)}
            >
              আবেদনের স্ট্যাটাস দেখুন
            </Link>
          </div>
        ) : !s ? (
          <section className="success-card" role="status">
            <Icon name="clock" size={32} />
            <h2>রেজিস্ট্রেশনের তথ্য লোড হচ্ছে…</h2>
            <p>একটু অপেক্ষা করুন। ইভেন্টের বর্তমান রেজিস্ট্রেশন অবস্থা যাচাই করা হচ্ছে।</p>
          </section>
        ) : !s.open ? (
          <section className="registration-status-card registration-closed">
            <header className="registration-card-header">
              <Icon name="clock" size={26} />
              <h2>রেজিস্ট্রেশন বন্ধ</h2>
            </header>
            <div className="registration-card-body">
              <span className="closed-symbol">
                <Icon name="calendar" size={38} />
              </span>
              <h3>
                {s.closedReason === "deadline"
                  ? "রেজিস্ট্রেশনের সময়সীমা শেষ হয়েছে"
                  : "আয়োজকের সিদ্ধান্তে রেজিস্ট্রেশন বন্ধ রয়েছে"}
              </h3>
              <p>
                {s.closedReason === "deadline"
                  ? "নির্ধারিত সময়সীমা শেষ হওয়ায় নতুন রেজিস্ট্রেশন আর গ্রহণ করা হচ্ছে না।"
                  : "এই মুহূর্তে নতুন রেজিস্ট্রেশন গ্রহণ করা হচ্ছে না। পুনরায় চালু করার সিদ্ধান্ত হলে এখানেই জানানো হবে।"}
              </p>
              {s.registrationAutoCloseAt && (
                <div className="closing-deadline">
                  <span>রেজিস্ট্রেশন বন্ধের নির্ধারিত সময়</span>
                  <strong>
                    ইভেন্টের আগের দিন {deadlineDateText} রাত ১২:০০
                  </strong>
                  <small>বাংলাদেশ সময় · Asia/Dhaka</small>
                </div>
              )}
              <p className="closed-existing">
                ইতোমধ্যে রেজিস্ট্রেশন করেছেন? আপনার রেজিস্ট্রেশনে দেওয়া মোবাইল
                নম্বর দিয়ে আবেদনের স্ট্যাটাস দেখুন। পেমেন্ট যাচাই ও অনুমোদন হয়ে
                থাকলে কনফার্মেশন স্লিপ ডাউনলোড করতে পারবেন।
              </p>
              <Link className="button full" href="/status">
                <Icon name="download" size={21} />
                স্ট্যাটাস দেখুন / স্লিপ ডাউনলোড
              </Link>
              <p className="closed-help">
                পুনর্মিলনীতে আপনার আগ্রহের জন্য ধন্যবাদ। কোনো তথ্য সংশোধন বা
                সহায়তার প্রয়োজন হলে আয়োজক কমিটির সঙ্গে যোগাযোগ করুন।
              </p>
            </div>
          </section>
        ) : (
          <div className="registration-layout">
            <form onSubmit={submit} className="panel registration-form">
              <div className="form-section-title">
                <span>০১</span>
                <div>
                  <h2>ব্যক্তিগত তথ্য</h2>
                  <p>
                    যে ঘরগুলোর পাশে তারকা (*) চিহ্ন আছে সেগুলো অবশ্যই পূরণ করতে
                    হবে। (ঐচ্ছিক) লেখা ঘরগুলো না দিলেও চলবে।
                  </p>
                </div>
              </div>
              <div className="form-grid">
                <Field
                  label="পুরো নাম"
                  name="name"
                  placeholder="আপনার পুরো নাম লিখুন"
                  minLength={2}
                  maxLength={100}
                  required
                />
                <Field
                  label="মোবাইল নম্বর"
                  name="mobile"
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  required
                />
                <Field label="দাখিল ব্যাচ / পাসের সন">
                  <select name="batchYear" required defaultValue="">
                    <option value="" disabled>
                      ব্যাচ নির্বাচন করুন
                    </option>
                    {Array.from({ length: 58 }, (_, i) => 2027 - i).map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </Field>
                <Field label="রক্তের গ্রুপ" optional>
                  <select name="bloodGroup" defaultValue="">
                    <option value="">নির্বাচন করুন</option>
                    {[
                      "A+",
                      "A-",
                      "B+",
                      "B-",
                      "AB+",
                      "AB-",
                      "O+",
                      "O-",
                      "জানি না",
                    ].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="ইমেইল"
                  optional
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                />
                <Field
                  label="ঠিকানা"
                  optional
                  name="address"
                  maxLength={300}
                  placeholder="গ্রাম, উপজেলা, জেলা"
                />
                <Field label="আপনার ছবি" optional>
                  <input
                    type="file"
                    name="photo"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setPhoto(e.target.files[0])}
                  />
                </Field>
                <div className="upload-help">
                  <Icon name="shield" size={20} />
                  <span>
                    JPG, PNG বা WebP · ছবি স্বয়ংক্রিয়ভাবে ছোট করা হবে। ছবি না
                    দিলেও রেজিস্ট্রেশন করা যাবে।
                  </span>
                </div>
              </div>
              <div className="form-divider" />
              <div className="form-section-title">
                <span>০২</span>
                <div>
                  <h2>পেমেন্টের তথ্য</h2>
                  <p>টাকা পাঠানোর পর সঠিক TrxID লিখুন</p>
                </div>
              </div>
              <div className="payment-methods">
                {["nagad", "rocket"].map((m) => (
                  <button
                    type="button"
                    className={
                      "payment-option " + (method === m ? "selected" : "")
                    }
                    onClick={() => setMethod(m)}
                    key={m}
                  >
                    <span className={"payment-icon " + m}>
                      {m === "nagad" ? "N" : "R"}
                    </span>
                    <span className="payment-name">
                      {m === "nagad" ? "Nagad · নগদ" : "Rocket · রকেট"}
                    </span>
                    <i className="payment-radio" aria-hidden="true">
                      {method === m ? "●" : "○"}
                    </i>
                  </button>
                ))}
              </div>
              <div className="form-grid">
                <Field
                  label="Transaction ID / TrxID"
                  name="transactionId"
                  placeholder="যেমন: 8H7K9X2P"
                  minLength={4}
                  maxLength={60}
                  pattern="[a-zA-Z0-9\-]+"
                  required
                />
                <Field
                  label="যে নম্বর থেকে টাকা পাঠিয়েছেন"
                  optional
                  name="senderMobileNumber"
                  type="tel"
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div className="notice">
                <Icon name="shield" size={19} />
                <p>
                  আপনার আবেদন পেমেন্ট যাচাই না হওয়া পর্যন্ত অপেক্ষমান থাকবে।
                </p>
              </div>
              <Alert>{error}</Alert>
              <button className="button full" disabled={busy || !s}>
                {busy ? "আবেদন জমা হচ্ছে…" : "আবেদন জমা দিন"}{" "}
                <Icon name="arrow" size={18} />
              </button>
              <p className="form-foot">
                ইতোমধ্যে রেজিস্ট্রেশন করেছেন?{" "}
                <Link href="/status">স্ট্যাটাস দেখুন ↗</Link>
              </p>
            </form>
            <aside>
              <div className="payment-instructions">
                <div className="eyebrow">পেমেন্ট নির্দেশনা</div>
                <h2>একটি দিন, অসংখ্য স্মৃতি।</h2>
                <div className="fee-large">
                  ৳ ২০০ <small>রেজিস্ট্রেশন ফি</small>
                </div>
                <p>
                  Nagad অথবা Rocket দিয়ে নিচের নম্বরে{" "}
                  <strong>Send Money</strong> করুন।
                </p>
                <div className="receiver">
                  <span>প্রাপকের নম্বর</span>
                  <strong
                    onClick={copyNumber}
                    style={{
                      cursor: "pointer",
                      userSelect: "all",
                    }}
                    title="ক্লিক করে নম্বর কপি করুন"
                  >
                    +880 1812-945767
                  </strong>
                  <button
                    type="button"
                    onClick={copyNumber}
                    style={
                      copied
                        ? {
                            color: "#167448",
                            fontWeight: 600,
                            borderColor: "#a3d9b5",
                            background: "#eaf5ec",
                          }
                        : {}
                    }
                  >
                    {copied ? "✓ নম্বর কপি হয়েছে!" : "নম্বর কপি করুন ⧉"}
                  </button>
                </div>
                <ol>
                  <li>Nagad বা Rocket অ্যাপ খুলুন।</li>
                  <li>উপরের নম্বরে ২০০ টাকা পাঠান।</li>
                  <li>ফর্মে মেথড ও TrxID লিখুন।</li>
                  <li>আবেদন জমা দিয়ে অনুমোদনের অপেক্ষা করুন।</li>
                </ol>
                <small>উভয় পেমেন্ট মেথডে একই নম্বর ব্যবহার করুন।</small>
              </div>
              <div className="help-card">
                <Icon name="clock" />
                <h3>আবেদন কখন বন্ধ হবে?</h3>
                <p>
                  ইভেন্টের আগের দিন <strong>{deadlineDateText}</strong> তারিখ রাত
                  ১২টায় (বাংলাদেশ সময়) রেজিস্ট্রেশন বন্ধ হবে। আয়োজক প্রয়োজনে এর
                  আগেও বন্ধ করতে পারেন।
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </PublicShell>
  );
}

