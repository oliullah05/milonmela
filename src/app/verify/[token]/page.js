"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  PublicShell,
  Alert,
  Badge,
  api,
  date,
  Icon,
} from "@/components/shared";
export default function Verify({ params }) {
  const { token } = use(params);
  const [s, set] = useState(null);
  const [error, setError] = useState("");
  const [msg, message] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("verify/" + token)
      .then(set)
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <PublicShell>
      <main className="container status-page">
        <div className="page-intro">
          <div className="eyebrow">পুনর্মিলনী ২০২৭</div>
          <h1>স্লিপ যাচাইকরণ</h1>
          <p>রেজিস্ট্রেশনের সত্যতা ও উপস্থিতি যাচাই করুন।</p>
        </div>
        <Alert>{error}</Alert>
        {s && (
          <section className="panel status-result">
            <div className="result-top">
              <span className="icon-box">
                <Icon name="shield" size={30} />
              </span>
              <div>
                <h2>{s.name}</h2>
                <p>{s.registrationNumber}</p>
              </div>
              <Badge value={s.applicationStatus} />
            </div>
            <div className="detail-grid">
              <div>
                <small>দাখিল ব্যাচ</small>
                <strong>{s.batchYear}</strong>
              </div>
              <div>
                <small>উপস্থিতি</small>
                <strong>
                  {s.attendedAt ? "Already Attended" : "এখনো Check-in হয়নি"}
                </strong>
              </div>
              {s.admin && (
                <>
                  <div>
                    <small>মোবাইল</small>
                    <strong>{s.mobile}</strong>
                  </div>
                  <div>
                    <small>পেমেন্ট</small>
                    <Badge value={s.paymentStatus} />
                  </div>
                </>
              )}
            </div>
            {s.attendedAt && (
              <p>
                Check-in সম্পন্ন: {date(s.attendedAt)}
                {s.attendedByName && <> · গ্রহণকারী: {s.attendedByName}</>}
              </p>
            )}
            <Alert success>{msg}</Alert>
            {s.admin ? (
              <button
                disabled={
                  busy ||
                  s.applicationStatus !== "approved" ||
                  s.paymentStatus !== "verified"
                }
                className="button full"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api("admin/checkin", { token });
                    message(r.message);
                    set({ ...s, attendedAt: r.student.attendedAt });
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy
                  ? "যাচাই হচ্ছে…"
                  : s.attendedAt
                    ? "Already Attended"
                    : "Mark as Attended"}
              </button>
            ) : (
              <Link className="button outline full" href="/login">
                Check-in করতে অ্যাডমিন লগইন করুন
              </Link>
            )}
          </section>
        )}
      </main>
    </PublicShell>
  );
}
