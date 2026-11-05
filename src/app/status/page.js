"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { readStatusIdentifier } from "@/lib/status-identifier";
import StatusLink from "@/components/status-link";
import { consumeRegistrationMobile } from "@/lib/status-handoff";
import {
  PublicShell,
  Field,
  Alert,
  Icon,
  Badge,
  api,
  date,
} from "@/components/shared";
export default function Status() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mobileInput = useRef(null);
  const requestVersion = useRef(0);
  const lookupStatus = useCallback(async (credentials) => {
    const version = ++requestVersion.current;
    setBusy(true);
    setError("");
    setData(null);
    try {
      const result = await api("status", credentials);
      if (version === requestVersion.current) {
        if (mobileInput.current)
          mobileInput.current.value =
            credentials.id ?? credentials.mobile ?? result.registrationNumber;
        window.history.replaceState(
          window.history.state,
          "",
          result.statusPath,
        );
        setData({
          ...result,
          statusUrl: new URL(result.statusPath, window.location.origin).href,
        });
      }
    } catch (error) {
      if (version === requestVersion.current) setError(error.message);
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const id = readStatusIdentifier(window.location.search);
      const mobile = consumeRegistrationMobile();
      if (id !== null) {
        if (mobileInput.current) mobileInput.current.value = id;
        void lookupStatus({ id });
        return;
      }
      if (!mobile) return;
      if (mobileInput.current) mobileInput.current.value = mobile;
      void lookupStatus({ mobile });
    });
    return () => {
      cancelled = true;
      requestVersion.current += 1;
    };
  }, [lookupStatus]);
  function lookup(event) {
    event.preventDefault();
    window.history.replaceState(window.history.state, "", "/status");
    void lookupStatus({
      mobile: new FormData(event.currentTarget).get("mobile"),
    });
  }
  async function correction(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("correction", Object.fromEntries(new FormData(e.target)));
      setData({
        ...data,
        paymentStatus: "pending",
        applicationStatus: "pending",
        rejectionReason: "",
      });
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  }
  const approved =
    data?.applicationStatus === "approved" &&
    data?.paymentStatus === "verified";
  const decision =
    data?.paymentStatus === "correction_required"
      ? "correction"
      : data?.applicationStatus === "rejected" ||
          data?.paymentStatus === "rejected"
        ? "rejected"
        : approved
          ? "approved"
          : "pending";
  const messages = {
    approved: [
      "অনুমোদিত হয়েছে",
      "আপনার পেমেন্ট যাচাই ও রেজিস্ট্রেশন নিশ্চিত করা হয়েছে। নিচের বাটন থেকে কনফার্মেশন স্লিপ ডাউনলোড করুন।",
    ],
    pending: [
      "আবেদন অপেক্ষমান রয়েছে",
      "আপনার আবেদন জমা হয়েছে। আয়োজক পেমেন্ট যাচাই করলেই রেজিস্ট্রেশন অনুমোদিত হবে এবং PDF স্লিপ পাওয়া যাবে।",
    ],
    rejected: [
      "আবেদন বাতিল হয়েছে",
      "পেমেন্ট যাচাইয়ে অসংগতির কারণে আবেদন অনুমোদিত হয়নি। বিস্তারিত জানতে আয়োজক কমিটির সঙ্গে যোগাযোগ করুন।",
    ],
    correction: [
      "পেমেন্টের তথ্য সংশোধন প্রয়োজন",
      "নিচের ফর্মে সঠিক পেমেন্টের তথ্য দিয়ে আবার জমা দিন। পুনরায় যাচাইয়ের পর রেজিস্ট্রেশন নিশ্চিত করা হবে।",
    ],
  };
  return (
    <PublicShell active="status">
      <main className="container status-page status-lookup-page">
        <div className="page-intro">
          <div className="eyebrow">আপনার আবেদনের খবর</div>
          <h1>আবেদনের স্ট্যাটাস দেখুন</h1>
          <p>
            মোবাইল নম্বর অথবা রেজিস্ট্রেশন ID দিয়ে আপনার আবেদনের স্ট্যাটাস
            দেখুন।
          </p>
        </div>
        <form className="panel lookup-form" onSubmit={lookup}>
          <Field
            label="মোবাইল নম্বর অথবা রেজিস্ট্রেশন ID"
            ref={mobileInput}
            name="mobile"
            type="text"
            placeholder="যেমন: 501 অথবা 01XXXXXXXXX"
            required
          />
          <button className="button" disabled={busy}>
            {busy ? (
              <span className="btn-spinner" aria-hidden="true" />
            ) : (
              <Icon name="search" size={19} />
            )}
            {busy ? "খোঁজা হচ্ছে…" : "স্ট্যাটাস দেখুন"}
          </button>
        </form>
        {busy && (
          <div className="status-loading-box" role="status" aria-live="polite">
            <div className="spinner-large" aria-hidden="true" />
            <p>আবেদনের তথ্য খোঁজা হচ্ছে, একটু অপেক্ষা করুন…</p>
          </div>
        )}
        <Alert>
          {error}
          {error &&
            (error.includes("আবেদন পাওয়া যায়নি") ||
              error.includes("রেজিস্ট্রেশন")) && (
              <div style={{ marginTop: "8px" }}>
                👉 আগে রেজিস্ট্রেশন না করে থাকলে{" "}
                <Link
                  href="/register"
                  style={{
                    color: "#115b43",
                    fontWeight: 700,
                    textDecoration: "underline",
                  }}
                >
                  এখানে ক্লিক করে নতুন রেজিস্ট্রেশন করুন
                </Link>
              </div>
            )}
        </Alert>
        {data && (
          <section className="registration-status-card" aria-live="polite">
            <header className="registration-card-header">
              <Icon name="shield" size={25} />
              <h2>রেজিস্ট্রেশন স্ট্যাটাস</h2>
            </header>
            <div className="registration-card-body">
              <div className="registration-id">
                <span>রেজিস্ট্রেশন নম্বর</span>
                <strong>{data.registrationNumber}</strong>
              </div>
              <StatusLink key={data.statusUrl} url={data.statusUrl} />
              <dl className="registration-details">
                {[
                  ["নাম", data.name],
                  ["মোবাইল নম্বর", data.mobile],
                  ["দাখিল ব্যাচ", data.batchYear],
                  ["জমার তারিখ", date(data.createdAt)],
                  [
                    "পেমেন্টের অবস্থা",
                    <Badge key="payment" value={data.paymentStatus} />,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className={"registration-decision " + decision}>
                <span className="decision-icon">
                  <Icon
                    name={
                      approved
                        ? "check"
                        : decision === "pending"
                          ? "clock"
                          : "shield"
                    }
                    size={24}
                  />
                </span>
                <h3>{messages[decision][0]}</h3>
                <p>{messages[decision][1]}</p>
                {data.rejectionReason && (
                  <p className="decision-reason">
                    <strong>আয়োজকের নির্দেশনা:</strong> {data.rejectionReason}
                  </p>
                )}
              </div>
              {approved && (
                <a
                  href="/api/slip"
                  download
                  className="button full slip-download"
                >
                  <Icon name="download" size={22} />
                  কনফার্মেশন স্লিপ ডাউনলোড করুন
                </a>
              )}
              {data.paymentStatus === "correction_required" && (
                <form onSubmit={correction} className="correction-form">
                  <h3>পেমেন্টের তথ্য সংশোধন</h3>
                  <Field label="পেমেন্ট মেথড">
                    <select name="method">
                      <option value="nagad">Nagad</option>
                      <option value="rocket">Rocket</option>
                    </select>
                  </Field>
                  <Field
                    label="TrxID"
                    name="transactionId"
                    minLength={4}
                    required
                  />
                  <Field
                    label="প্রেরকের নম্বর"
                    optional
                    name="senderMobileNumber"
                    type="tel"
                  />
                  <button className="button" disabled={busy}>
                    {busy && (
                      <span className="btn-spinner" aria-hidden="true" />
                    )}
                    {busy ? "জমা হচ্ছে…" : "সংশোধন জমা দিন"}
                  </button>
                </form>
              )}
            </div>
          </section>
        )}
        <div className="secure-note">
          <Icon name="shield" size={16} /> আপনার তথ্য শুধু আবেদন যাচাইয়ের জন্য
          ব্যবহার করা হয়।
        </div>
      </main>
    </PublicShell>
  );
}
