"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { PublicShell, Icon, useSettings } from "@/components/shared";
function Countdown({ event }) {
  const [left, set] = useState(null);
  useEffect(() => {
    const tick = () => {
      const n = Math.max(0, new Date(event).getTime() - Date.now());
      set([
        Math.floor(n / 86400000),
        Math.floor(n / 3600000) % 24,
        Math.floor(n / 60000) % 60,
        Math.floor(n / 1000) % 60,
      ]);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [event]);
  return (
    <div className="countdown">
      {["দিন", "ঘণ্টা", "মিনিট", "সেকেন্ড"].map((label, i) => (
        <div key={label}>
          <strong>
            {left
              ? String(left[i])
                  .padStart(2, "0")
                  .replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d])
              : "—"}
          </strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
function Architecture() {
  return (
    <div
      className="architecture"
      role="img"
      aria-label="চুপাইর জামিউল উলুম আলিম মাদরাসা ক্যাম্পাস"
    >
      <div className="madrasah-photo-wrapper">
        <Image
          src="/pic/madrasah.jpg"
          alt="চুপাইর জামিউল উলুম আলিম মাদরাসা"
          fill
          priority
          quality={95}
          sizes="(max-width: 780px) 100vw, (max-width: 1200px) 50vw, 650px"
          className="madrasah-photo"
        />
        <div className="madrasah-photo-gradient" />
        <div className="madrasah-photo-caption">
          <strong>চুপাইর জামিউল উলুম আলিম মাদরাসা</strong>
          <span>ঐতিহ্যের আঙিনায় ফিরে আসার নিমন্ত্রণ</span>
        </div>
      </div>
      <div className="jubilee">
        <strong>৫০</strong>
        <span>গৌরবের বছর</span>
      </div>
    </div>
  );
}
export default function Home() {
  const [s] = useSettings();
  const event = s?.eventDateTime || "2027-08-15T10:00:00+06:00";
  return (
    <PublicShell active="home">
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">
                <span /> সুবর্ণজয়ন্তী ও প্রাক্তন ছাত্র পুনর্মিলনী ২০২৭
              </div>
              <h1>
                ৫০ বছরের গৌরব,
                <br />
                <span>প্রজন্মের বন্ধন।</span>
              </h1>
              <p className="hero-description">
                সেই চেনা আঙিনা, প্রিয় মুখ আর অগণিত স্মৃতি।
                <br />
                শেকড়ের টানে ফিরে আসুন, একসাথে লিখি নতুন গল্প।
              </p>
              <div className="hero-actions">
                <Link className="button" href="/register">
                  পুনর্মিলনীতে অংশ নিন <Icon name="arrow" size={18} />
                </Link>
                <Link className="text-link" href="/status">
                  আবেদনের স্ট্যাটাস <span>↗</span>
                </Link>
              </div>
              <div className="hero-facts">
                <div>
                  <Icon name="calendar" />
                  <span>
                    {new Date(event).toLocaleDateString("bn-BD", {
                      timeZone: "Asia/Dhaka",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    <small>
                      {new Date(event).toLocaleTimeString("bn-BD", {
                        timeZone: "Asia/Dhaka",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      থেকে
                    </small>
                  </span>
                </div>
                <div>
                  <Icon name="pin" />
                  <span>
                    মাদরাসা প্রাঙ্গণ<small>চুপাইর মাদরাসা</small>
                  </span>
                </div>
              </div>
            </div>
            <Architecture />
          </div>
          <div className="container event-strip">
            <div className="strip-title">
              <span className="icon-box">
                <Icon name="clock" size={25} />
              </span>
              <div>
                <strong>অপেক্ষা শুধু মিলনের</strong>
                <small>স্মৃতির আঙিনায় দেখা হবে আবার</small>
              </div>
            </div>
            <Countdown event={event} />
            <div className="strip-fee">
              <small>রেজিস্ট্রেশন ফি</small>
              <strong>
                ৳ ২০০ <span>/ জনপ্রতি</span>
              </strong>
              {s ? (
                s.open ? (
                  <Link href="/register" className="open-dot open-dot-link">
                    <span className="open-dot-text">রেজিস্ট্রেশন চলছে</span>
                  </Link>
                ) : (
                  <span className="open-dot">
                    <span className="open-dot-text">রেজিস্ট্রেশন বন্ধ</span>
                  </span>
                )
              ) : (
                <span className="open-dot">
                  <span className="open-dot-text">পুনর্মিলনী ২০২৭</span>
                </span>
              )}
            </div>
          </div>
        </section>
        <section className="section container" id="about">
          <div className="section-heading">
            <div>
              <div className="eyebrow">একটি প্রতিষ্ঠান, অসংখ্য গল্প</div>
              <h2>ফিরে দেখা, ফিরে পাওয়া</h2>
            </div>
            <p>
              অর্ধশতাব্দীর পথচলায় যারা এই পরিবারের অংশ,
              <br />
              এই আয়োজন তাঁদের সবার জন্য।
            </p>
          </div>
          <div className="feature-grid">
            {[
              [
                "book",
                "ঐতিহ্যের ৫০ বছর",
                "দ্বীনি শিক্ষা, আদর্শ ও মূল্যবোধের আলো ছড়িয়ে অর্ধশতাব্দীর গৌরবময় পথচলা।",
                "০১",
              ],
              [
                "users",
                "পুরোনো বন্ধন, নতুন গল্প",
                "ব্যস্ততার দূরত্ব পেরিয়ে প্রিয় সহপাঠী ও শ্রদ্ধেয় শিক্ষকদের সঙ্গে আবার দেখা।",
                "০২",
              ],
              [
                "star",
                "স্মৃতিময় একটি দিন",
                "স্মৃতিচারণ, আন্তরিক আড্ডা ও আনন্দঘন আয়োজনে তৈরি হোক নতুন স্মৃতি।",
                "০৩",
              ],
            ].map(([icon, title, desc, n]) => (
              <article className="feature" key={title}>
                <div className="feature-top">
                  <span className="icon-box">
                    <Icon name={icon} size={26} />
                  </span>
                  <span>{n}</span>
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="steps-section">
          <div className="container">
            <div className="center-heading">
              <div className="eyebrow">অংশ নেওয়া খুবই সহজ</div>
              <h2>মিলনমেলার পথে তিন ধাপ</h2>
              <p>কয়েক মিনিটেই সম্পন্ন করুন আপনার রেজিস্ট্রেশন।</p>
            </div>
            <div className="steps">
              {[
                [
                  "১",
                  "আপনার তথ্য দিন",
                  "নাম, মোবাইল ও দাখিল ব্যাচ দিয়ে ফর্ম পূরণ করুন।",
                ],
                [
                  "২",
                  "ফি জমা দিন",
                  "Nagad অথবা Rocket-এ ২০০ টাকা পাঠিয়ে TrxID দিন।",
                ],
                [
                  "৩",
                  "কনফার্মেশন স্লিপ নিন",
                  "পেমেন্ট যাচাই ও অনুমোদনের পর PDF স্লিপ ডাউনলোড করুন।",
                ],
              ].map(([n, t, d]) => (
                <div key={n}>
                  <span className="step-number">{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
            <div className="center">
              <Link className="button" href="/register">
                রেজিস্ট্রেশন শুরু করুন <Icon name="arrow" size={18} />
              </Link>
              <div className="secure-note">
                <Icon name="shield" size={15} /> আপনার তথ্য নিরাপদ ও সুরক্ষিত
              </div>
            </div>
          </div>
        </section>
        <section className="container section schedule" id="schedule">
          <div>
            <div className="eyebrow">দিনটি আমাদের</div>
            <h2>একদিন, অগণিত স্মৃতি।</h2>
            <p>
              শ্রদ্ধেয় শিক্ষক, প্রিয় সহপাঠী ও অনুজদের সঙ্গে
              <br />
              একটি আন্তরিক পুনর্মিলনের অপেক্ষায়।
            </p>
            <div className="hijri">
              {s?.eventHijriDate || "১২ রবিউল আউয়াল"}{" "}
              <small>· প্রাথমিক হিজরি তারিখ; আয়োজক কর্তৃক সংশোধনযোগ্য</small>
            </div>
          </div>
          <div className="schedule-card">
            <span className="icon-box">
              <Icon name="calendar" />
            </span>
            <div>
              <small>পুনর্মিলনীর দিন ও সময়</small>
              <h3>
                {new Date(event).toLocaleDateString("bn-BD", {
                  timeZone: "Asia/Dhaka",
                  dateStyle: "long",
                })}
              </h3>
              <p>
                {new Date(event).toLocaleTimeString("bn-BD", {
                  timeZone: "Asia/Dhaka",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                · মাদরাসা প্রাঙ্গণ
              </p>
              <span className="muted">
                বিস্তারিত অনুষ্ঠানসূচি আয়োজক কমিটি পরবর্তীতে জানাবে।
              </span>
            </div>
          </div>
        </section>
        <section className="container">
          <div className="cta-banner">
            <div>
              <h2>আপনার উপস্থিতিতেই পূর্ণতা পাবে আয়োজন।</h2>
              <p>বন্ধুদের জানান, একসাথে ফিরে আসুন প্রিয় আঙিনায়।</p>
            </div>
            <Link className="button light" href="/register">
              আমিও থাকছি <Icon name="arrow" size={18} />
            </Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}

