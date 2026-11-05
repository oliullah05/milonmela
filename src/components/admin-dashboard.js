"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import jsQR from "jsqr";
import { useRouter, usePathname } from "next/navigation";
import {
  Brand,
  Icon,
  Field,
  Alert,
  Badge,
  api,
  date,
} from "@/components/shared";
function Scanner({ onScan }) {
  const video = useRef(null);
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  const [error, setError] = useState("");
  useEffect(() => {
    let stream,
      stopped = false,
      timer;
    async function start() {
      try {
        const detector =
          "BarcodeDetector" in window
            ? new window.BarcodeDetector({ formats: ["qr_code"] })
            : null;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current.srcObject = stream;
        await video.current.play();
        timer = setInterval(async () => {
          try {
            let raw;
            if (detector) {
              raw = (await detector.detect(video.current))[0]?.rawValue;
            } else if (video.current?.videoWidth) {
              canvas.width = video.current.videoWidth;
              canvas.height = video.current.videoHeight;
              ctx.drawImage(video.current, 0, 0);
              const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
              raw = jsQR(frame.data, frame.width, frame.height, {
                inversionAttempts: "dontInvert",
              })?.data;
            }
            if (raw) {
              const u = new URL(raw);
              if (
                u.origin !== location.origin ||
                !/^\/verify\/[a-f0-9]{64}$/.test(u.pathname)
              )
                return;
              clearInterval(timer);
              onScanRef.current(u.pathname.split("/").pop());
            }
          } catch {}
        }, 700);
      } catch (e) {
        setError(e.message);
      }
    }
    start();
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <div className="scanner">
      <video ref={video} muted playsInline />
      <Alert>{error}</Alert>
    </div>
  );
}
export default function Admin({
  initialTab = "overview",
  initialAdmin = null,
  initialSettings = null,
  initialStats = null,
  initialList = null,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState(initialAdmin);

  const tab = (() => {
    if (pathname === "/admin/students") return "students";
    if (pathname === "/admin/attendance") return "attendance";
    if (pathname === "/admin/settings") return "settings";
    if (pathname === "/admin/security" || pathname === "/admin/account")
      return "account";
    if (pathname === "/admin") return "overview";
    return initialTab || "overview";
  })();
  const [stats, setStats] = useState(initialStats || {});
  const [list, setList] = useState(
    initialList
      ? { ...initialList, loaded: true }
      : { rows: [], pages: 0, loaded: false },
  );
  const [settings, setSettings] = useState(initialSettings);
  const [query, setQuery] = useState({});
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, select] = useState(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState(query.q || "");
  const [tableLoading, setTableLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const modalRef = useRef(null);
  const isFirstMountRef = useRef(Boolean(initialStats && initialList));
  const selectedId = selected?._id;
  const isFormOpen =
    typeof settings?.open === "boolean"
      ? settings.open
      : typeof settings?.registrationOpen === "boolean"
        ? settings.registrationOpen
        : true;

  const filterCount = [
    "batchYear",
    "applicationStatus",
    "paymentStatus",
    "method",
    "attended",
  ].filter((k) => Boolean(query[k])).length;

  const hasActiveFilters = filterCount > 0 || Boolean(query.q);

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchTerm(val);
    setTableLoading(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      const q = val.trim();
      setQuery((prev) => {
        const next = { ...prev };
        if (q) next.q = q;
        else delete next.q;
        return next;
      });
      setPage(1);
    }, 280);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const q = searchTerm.trim();
    setQuery((prev) => {
      const next = { ...prev };
      if (q) next.q = q;
      else delete next.q;
      return next;
    });
    setPage(1);
  }

  function handleFilterApply(e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    setQuery((prev) => {
      const next = {};
      if (prev.q) next.q = prev.q;
      for (const [k, v] of Object.entries(d)) {
        if (v && String(v).trim()) {
          next[k] = String(v).trim();
        }
      }
      return next;
    });
    setPage(1);
    setFilterModalOpen(false);
  }

  function handleModalReset() {
    setQuery((prev) => {
      const next = {};
      if (prev.q) next.q = prev.q;
      return next;
    });
    setPage(1);
    setFilterModalOpen(false);
  }

  function clearFilters() {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setSearchTerm("");
    setQuery({});
    setPage(1);
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
  }

  function removeFilter(key) {
    if (key === "q") {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      setSearchTerm("");
      if (searchInputRef.current) searchInputRef.current.value = "";
    }
    setQuery((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPage(1);
  }

  const appStatusLabels = {
    pending: "অপেক্ষমান",
    approved: "অনুমোদিত",
    rejected: "বাতিল",
  };
  const payStatusLabels = {
    pending: "পেমেন্ট অপেক্ষমান",
    verified: "যাচাইকৃত",
    rejected: "পেমেন্ট বাতিল",
    correction_required: "সংশোধন প্রয়োজন",
  };

  function openStudent(student) {
    select(student);
    setModalError("");
    setMessage("");
  }
  useEffect(() => {
    if (!selectedId) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = modalRef.current;
    const focusable = () =>
      [
        ...panel.querySelectorAll(
          "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary",
        ),
      ].filter((el) => el.getClientRects().length);
    focusable()[0]?.focus();
    const trap = (event) => {
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    panel.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = overflow;
      panel.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [selectedId]);
  const [scan, setScan] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [attendanceQuery, setAttendanceQuery] = useState("");
  const [attendanceResults, setAttendanceResults] = useState([]);
  const [attendanceSearching, setAttendanceSearching] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const attendanceSearchTimeoutRef = useRef(null);

  function handleAttendanceSearchChange(e) {
    const val = e.target.value;
    setAttendanceQuery(val);
    if (attendanceSearchTimeoutRef.current) {
      clearTimeout(attendanceSearchTimeoutRef.current);
    }
    const trimmed = val.trim();
    if (!trimmed) {
      setAttendanceResults([]);
      setAttendanceSearching(false);
      return;
    }
    setAttendanceSearching(true);
    attendanceSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api("admin/students?q=" + encodeURIComponent(trimmed));
        setAttendanceResults(res.rows || []);
      } catch {
        setAttendanceResults([]);
      } finally {
        setAttendanceSearching(false);
      }
    }, 240);
  }

  async function handleMarkAttendance(student) {
    setMarkingId(student._id);
    setError("");
    try {
      await check({ id: student._id });
      setAttendanceResults((prev) =>
        prev.map((s) =>
          s._id === student._id
            ? { ...s, attendedAt: new Date().toISOString() }
            : s,
        ),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setMarkingId(null);
    }
  }
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);
  const params = new URLSearchParams({ ...query, page }).toString();
  async function load() {
    setTableLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        api("admin/stats"),
        api("admin/students?" + params),
        api("admin/settings"),
      ]);
      setStats(a);
      setList({ ...b, loaded: true });
      setSettings(c);
    } catch (e) {
      setError(e.message);
    } finally {
      setTableLoading(false);
    }
  }
  useEffect(() => {
    if (!me) {
      api("auth/me")
        .then(setMe)
        .catch(() => router.replace("/login"));
    }
  }, [me, router]);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setTableLoading(true);
    });
    Promise.all([
      api("admin/stats"),
      api("admin/students?" + params),
      api("admin/settings"),
    ])
      .then(([a, b, c]) => {
        if (!cancelled) {
          setStats(a);
          setList({ ...b, loaded: true });
          setSettings(c);
          setTableLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setTableLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params]);
  async function action(body) {
    setBusy(true);
    setModalError("");
    try {
      const updated = await api(
        "admin/students/" + selected._id,
        body,
        "PATCH",
      );
      if (body.action === "payment") {
        select(null);
        setModalError("");
      } else {
        select(updated);
      }
      setMessage(
        body.action === "payment"
          ? updated.paymentStatus === "verified"
            ? `${updated.name}-এর পেমেন্ট যাচাই ও অনুমোদন সম্পন্ন হয়েছে।`
            : `${updated.name}-এর পেমেন্টের সিদ্ধান্ত সংরক্ষিত হয়েছে।`
          : "তথ্য আপডেট হয়েছে।",
      );
      await load();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function check(body) {
    setBusy(true);
    setError("");
    try {
      const r = await api("admin/checkin", body);
      setCheckResult(r);
      setMessage(r.message);
      if (r.student) {
        setAttendanceResults((prev) =>
          prev.map((s) =>
            s._id === r.student._id ||
            s.registrationNumber === r.student.registrationNumber
              ? { ...s, attendedAt: r.student.attendedAt }
              : s,
          ),
        );
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setScan(false);
    }
  }
  if (!me) {
    return (
      <main className="loading">
        <div className="spinner-large" />
        <p style={{ marginTop: "12px", fontWeight: 500 }}>
          অ্যাডমিন প্যানেল লোড হচ্ছে…
        </p>
      </main>
    );
  }
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Brand />
        <nav>
          {[
            ["overview", "/admin", "book", "ড্যাশবোর্ড"],
            ["students", "/admin/students", "users", "আবেদনকারীদের তালিকা"],
            ["attendance", "/admin/attendance", "check", "উপস্থিতি / Check-in"],
            ["settings", "/admin/settings", "calendar", "ইভেন্ট সেটিংস"],
            ["account", "/admin/security", "shield", "অ্যাকাউন্ট নিরাপত্তা"],
          ].map(([k, path, i, t]) => (
            <Link
              key={k}
              href={path}
              className={tab === k ? "active" : ""}
              onClick={() => {
                setError("");
                setMessage("");
              }}
            >
              <Icon name={i} size={19} />
              {t}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/">ওয়েবসাইট দেখুন ↗</Link>
          <button
            onClick={async () => {
              await api("auth/logout", {});
              router.push("/login");
            }}
          >
            লগআউট
          </button>
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-header">
          <span>
            সুবর্ণজয়ন্তী ও পুনর্মিলনী <b>2027</b>
          </span>
          <span className="admin-person">
            <span className="avatar">
              {me?.name?.slice(0, 1)?.toUpperCase() || "A"}
            </span>
            {me?.name}
          </span>
        </header>
        <main className="admin-main">
          <div className="admin-title">
            <div>
              <div className="eyebrow">আসসালামু আলাইকুম, {me.name}</div>
              <h1>
                {
                  {
                    overview: "ড্যাশবোর্ড",
                    students: "আবেদনকারীদের তালিকা",
                    attendance: "ইভেন্ট Check-in",
                    settings: "ইভেন্ট সেটিংস",
                    account: "অ্যাকাউন্ট নিরাপত্তা",
                  }[tab]
                }
              </h1>
              <p>প্রতিটি আবেদন, প্রতিটি উপস্থিতি — এক জায়গায়।</p>
            </div>
            <span
              className={"badge " + (isFormOpen ? "verified" : "rejected")}
            >
              {isFormOpen ? "ফর্ম চালু" : "ফর্ম বন্ধ"}
            </span>
          </div>
          <Alert>{error}</Alert>
          <Alert success>{message}</Alert>
          {tab === "overview" && (
            <>
              <section
                className="collections-card"
                aria-label="মোট নিশ্চিত টাকা"
              >
                <div>
                  <span>মোট নিশ্চিত টাকা</span>
                  <strong>
                    ৳ {Number(stats.collections || 0).toLocaleString("en-US")}
                  </strong>
                  <p>
                    {Number(stats.verified || 0).toLocaleString("en-US")} জনের
                    পেমেন্ট নিশ্চিত · জনপ্রতি ৳ 200
                  </p>
                </div>
                <span className="collections-icon">
                  <Icon name="shield" size={32} />
                </span>
              </section>
              <div className="stat-grid">
                {[
                  ["মোট আবেদন", stats.total, "users"],
                  ["অপেক্ষমান", stats.pending, "clock"],
                  ["উপস্থিত", stats.attended, "calendar"],
                  ["পেমেন্ট যাচাই বাকি", stats.paymentPending, "clock"],
                  ["যাচাইকৃত পেমেন্ট", stats.verified, "shield"],
                  ["বাতিল আবেদন", stats.rejected, "users"],
                ].map(([label, n, i]) => (
                  <article className="stat-card" key={label}>
                    <div>
                      <span>{label}</span>
                      <Icon name={i} size={20} />
                    </div>
                    <strong>{Number(n || 0).toLocaleString("en-US")}</strong>
                    <small>
                      {label === "যাচাইকৃত সংগ্রহ"
                        ? "শুধু Verified পেমেন্ট"
                        : "সর্বমোট হিসাব"}
                    </small>
                  </article>
                ))}
              </div>
              <div className="panel admin-summary">
                <div>
                  <h2>সর্বশেষ আবেদনসমূহ</h2>
                  <p>
                    আসল লেনদেন মিলিয়ে পেমেন্ট যাচাই করুন—আবেদন সঙ্গে সঙ্গে
                    অনুমোদিত হবে।
                  </p>
                </div>
                <Link
                  className="button small"
                  href="/admin/students"
                >
                  সব আবেদন দেখুন <Icon name="arrow" size={16} />
                </Link>
              </div>
              <StudentTable
                rows={list.rows.slice(0, 5)}
                loading={tableLoading}
                onSelect={(s) => {
                  openStudent(s);
                  router.push("/admin/students");
                }}
              />
            </>
          )}
          {tab === "students" && (
            <>
              <div className="panel student-search-bar">
                <form className="search-form-row" onSubmit={handleSearchSubmit}>
                  <div className="search-input-group">
                    <input
                      ref={searchInputRef}
                      value={searchTerm}
                      onChange={handleSearchChange}
                      aria-label="সার্চ"
                      name="q"
                      placeholder="নাম, মোবাইল, রেজিস্ট্রেশন নং, TrxID…"
                    />
                    <button
                      className="button small search-submit-btn"
                      type="submit"
                      disabled={tableLoading}
                    >
                      {tableLoading ? (
                        <span className="btn-spinner" aria-hidden="true" />
                      ) : (
                        <Icon name="search" size={16} />
                      )}
                      <span>{tableLoading ? "খোঁজা হচ্ছে…" : "খুঁজুন"}</span>
                    </button>
                  </div>
                  <div className="search-actions-group">
                    <button
                      type="button"
                      className={
                        "button small " +
                        (filterCount > 0 ? "btn-filter-active" : "outline")
                      }
                      onClick={() => setFilterModalOpen(true)}
                    >
                      ফিল্টার {filterCount > 0 ? `(${filterCount})` : ""}
                    </button>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        className="button outline small btn-clear-filters"
                        onClick={clearFilters}
                        style={{ color: "#b33a3a", borderColor: "#f0b8b8" }}
                      >
                        ✕ মুছুন
                      </button>
                    )}
                    <a
                      className="button outline small btn-export-csv"
                      href={"/api/admin/export?" + params}
                    >
                      CSV Export ↓
                    </a>
                  </div>
                </form>

                {hasActiveFilters && (
                  <div className="active-filter-chips">
                    <small style={{ color: "#687a6c", fontWeight: 600 }}>
                      সক্রিয় ফিল্টার:
                    </small>
                    {query.q && (
                      <span className="filter-chip">
                        সার্চ: &quot;{query.q}&quot;
                        <button type="button" onClick={() => removeFilter("q")}>
                          ✕
                        </button>
                      </span>
                    )}
                    {query.batchYear && (
                      <span className="filter-chip">
                        ব্যাচ: {query.batchYear}
                        <button
                          type="button"
                          onClick={() => removeFilter("batchYear")}
                        >
                          ✕
                        </button>
                      </span>
                    )}
                    {query.applicationStatus && (
                      <span className="filter-chip">
                        আবেদন:{" "}
                        {appStatusLabels[query.applicationStatus] ||
                          query.applicationStatus}
                        <button
                          type="button"
                          onClick={() => removeFilter("applicationStatus")}
                        >
                          ✕
                        </button>
                      </span>
                    )}
                    {query.paymentStatus && (
                      <span className="filter-chip">
                        পেমেন্ট:{" "}
                        {payStatusLabels[query.paymentStatus] ||
                          query.paymentStatus}
                        <button
                          type="button"
                          onClick={() => removeFilter("paymentStatus")}
                        >
                          ✕
                        </button>
                      </span>
                    )}
                    {query.method && (
                      <span className="filter-chip">
                        মেথড: {query.method === "nagad" ? "Nagad" : "Rocket"}
                        <button
                          type="button"
                          onClick={() => removeFilter("method")}
                        >
                          ✕
                        </button>
                      </span>
                    )}
                    {query.attended && (
                      <span className="filter-chip">
                        উপস্থিতি:{" "}
                        {query.attended === "yes" ? "উপস্থিত" : "অনুপস্থিত"}
                        <button
                          type="button"
                          onClick={() => removeFilter("attended")}
                        >
                          ✕
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      className="text-link"
                      onClick={clearFilters}
                      style={{
                        fontSize: "13px",
                        color: "#b33a3a",
                        minHeight: "auto",
                        padding: "0 4px",
                      }}
                    >
                      সব মুছুন
                    </button>
                  </div>
                )}
              </div>
              <StudentTable
                rows={list.rows}
                loading={tableLoading}
                onSelect={openStudent}
              />
              <div className="pagination">
                <span>
                  মোট {list.total || 0} আবেদন · পৃষ্ঠা {page} /{" "}
                  {list.pages || 1}
                </span>
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                  ← পূর্ববর্তী
                </button>
                <button
                  disabled={page >= list.pages}
                  onClick={() => setPage(page + 1)}
                >
                  পরবর্তী →
                </button>
              </div>
            </>
          )}
          {tab === "attendance" && (
            <section className="panel checkin-panel">
              <span className="icon-box">
                <Icon name="check" size={32} />
              </span>
              <h2>উপস্থিতি নিশ্চিত করুন</h2>
              <p>
                রেজিস্ট্রেশন নম্বর বা মোবাইল নম্বর লিখুন অথবা ক্যামেরায় QR কোড স্ক্যান করুন।
              </p>
              <button className="button outline" onClick={() => setScan(!scan)}>
                {scan ? "ক্যামেরা বন্ধ করুন" : "ক্যামেরায় QR স্ক্যান করুন"}
              </button>
              {scan && <Scanner onScan={(token) => check({ token })} />}
              <form
                className="check-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (attendanceQuery.trim()) {
                    check({ identifier: attendanceQuery.trim() });
                  }
                }}
              >
                <div className="attendance-input-wrap">
                  <Field
                    label="রেজিস্ট্রেশন নম্বর অথবা মোবাইল নম্বর"
                    name="identifier"
                    value={attendanceQuery}
                    onChange={handleAttendanceSearchChange}
                    placeholder="যেমন: 500 অথবা 01812945767"
                    required
                  />
                  {attendanceQuery && (
                    <button
                      type="button"
                      className="attendance-clear-btn"
                      onClick={() => {
                        setAttendanceQuery("");
                        setAttendanceResults([]);
                        setError("");
                      }}
                      title="মুছে ফেলুন"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  className="button"
                  disabled={busy || !attendanceQuery.trim()}
                >
                  {busy && <span className="btn-spinner" aria-hidden="true" />}
                  {busy ? "যাচাই হচ্ছে…" : "Mark as Attended"}
                </button>
              </form>

              {attendanceSearching && (
                <div
                  className="table-inline-loader"
                  style={{ borderRadius: 10, marginTop: 18 }}
                >
                  <span className="btn-spinner" aria-hidden="true" />
                  <span>আবেদনকারীর তথ্য খোঁজা হচ্ছে…</span>
                </div>
              )}

              {attendanceQuery.trim() &&
                !attendanceSearching &&
                attendanceResults.length === 0 && (
                  <p className="attendance-search-hint">
                    এই নম্বর বা তথ্যে কোনো আবেদনকারী পাওয়া যায়নি।
                  </p>
                )}

              {attendanceResults.length > 0 && (
                <div className="attendance-results">
                  {attendanceResults.map((s) => {
                    const isAttended = Boolean(s.attendedAt);
                    const isEligible =
                      s.applicationStatus === "approved" &&
                      s.paymentStatus === "verified";
                    return (
                      <article className="attendance-result-card" key={s._id}>
                        <div className="attendance-user-info">
                          {s.photoUrl ? (
                            <Image
                              src={s.photoUrl}
                              alt=""
                              width={44}
                              height={44}
                              unoptimized
                            />
                          ) : (
                            <span className="avatar">
                              {s.name.slice(0, 1)}
                            </span>
                          )}
                          <div className="attendance-meta">
                            <strong>{s.name}</strong>
                            <div className="attendance-meta-sub">
                              <span>{s.mobile}</span>
                              <span>·</span>
                              <span>ব্যাচ: {s.batchYear}</span>
                              <span>·</span>
                              <span className="mono">
                                ID: {s.registrationNumber}
                              </span>
                              <Badge value={s.paymentStatus} />
                            </div>
                          </div>
                        </div>
                        <div className="attendance-action">
                          {isAttended ? (
                            <span className="attendance-attended-pill">
                              <Icon name="check" size={16} />
                              উপস্থিত সম্পন্ন
                            </span>
                          ) : isEligible ? (
                            <button
                              type="button"
                              className="button small"
                              disabled={markingId === s._id || busy}
                              onClick={() => handleMarkAttendance(s)}
                            >
                              {markingId === s._id && (
                                <span
                                  className="btn-spinner"
                                  aria-hidden="true"
                                />
                              )}
                              {markingId === s._id
                                ? "যাচাই হচ্ছে…"
                                : "উপস্থিতি নিশ্চিত করুন ✓"}
                            </button>
                          ) : (
                            <span
                              className="badge pending"
                              style={{ fontSize: 12, padding: "5px 10px" }}
                            >
                              পেমেন্ট অপূর্ণ
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {checkResult && (
                <div className="notice" style={{ marginTop: 22 }}>
                  <Icon name="check" />
                  <p>
                    <strong>{checkResult.student.name}</strong> ·{" "}
                    রেজিস্ট্রেশন: {checkResult.student.registrationNumber} · মোবাইল: {checkResult.student.mobile}
                    <br />
                    <span style={{ color: "#1b5e39", fontWeight: 600 }}>
                      {checkResult.message}
                    </span>
                    <br />
                    উপস্থিতির সময়: {date(checkResult.student.attendedAt)}
                    {checkResult.student.attendedByName && (
                      <> · গ্রহণকারী: {checkResult.student.attendedByName}</>
                    )}
                  </p>
                </div>
              )}
            </section>
          )}
          {tab === "settings" && settings && (
            <form
              key={settings.updatedAt}
              className="panel settings-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const form = new FormData(e.target);
                  await api(
                    "admin/settings",
                    {
                      eventTitle: form.get("eventTitle"),
                      eventHijriDate: form.get("eventHijriDate"),
                      eventDateTime: form.get("eventDateTime") + ":00+06:00",
                      registrationOpen: form.has("registrationOpen"),
                      overrideDeadline: form.has("overrideDeadline"),
                    },
                    "PATCH",
                  );
                  setMessage("ইভেন্ট সেটিংস সংরক্ষিত হয়েছে।");
                  await load();
                } catch (x) {
                  setError(x.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>ইভেন্ট ও রেজিস্ট্রেশন</h2>
              <Field
                label="ইভেন্টের নাম"
                name="eventTitle"
                defaultValue={settings.eventTitle}
                required
              />
              <Field
                label="ইভেন্টের তারিখ ও সময় (Asia/Dhaka)"
                name="eventDateTime"
                type="datetime-local"
                defaultValue={new Date(
                  new Date(settings.eventDateTime).getTime() + 21600000,
                )
                  .toISOString()
                  .slice(0, 16)}
                required
              />
              <Field
                label="প্রদর্শিত হিজরি তারিখ"
                name="eventHijriDate"
                defaultValue={settings.eventHijriDate}
                required
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="registrationOpen"
                  defaultChecked={settings.registrationOpen}
                />{" "}
                রেজিস্ট্রেশন ফর্ম চালু রাখুন
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="overrideDeadline"
                  defaultChecked={settings.overrideDeadline}
                />{" "}
                স্পষ্ট Override: ইভেন্টের দিন বা পরেও রেজিস্ট্রেশন চালু রাখুন
              </label>
              <div className="notice">
                <p>
                  ইভেন্টের আগের দিন রাত 12:00 AM (00:00, বাংলাদেশ সময়) ফর্ম
                  স্বয়ংক্রিয়ভাবে বন্ধ হয়। তারিখ বদলালে এই সময়সীমাও বদলাবে। হিজরি
                  তারিখটি প্রকাশের আগে যাচাই করুন।
                </p>
              </div>
              <button className="button" disabled={busy}>
                {busy && <span className="btn-spinner" aria-hidden="true" />}
                {busy ? "সংরক্ষণ হচ্ছে…" : "সেটিংস সংরক্ষণ করুন"}
              </button>
            </form>
          )}
          {tab === "account" && (
            <form
              className="panel settings-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const form = e.target;
                  await api(
                    "auth/password",
                    Object.fromEntries(new FormData(form)),
                  );
                  form.reset();
                  setMe({ ...me, mustChangePassword: false });
                  setMessage(
                    "পাসওয়ার্ড পরিবর্তিত হয়েছে। অন্য সেশনগুলো বাতিল করা হয়েছে।",
                  );
                } catch (x) {
                  setError(x.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>পাসওয়ার্ড পরিবর্তন</h2>
              <Field
                label="বর্তমান পাসওয়ার্ড"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <Field
                label="নতুন পাসওয়ার্ড (কমপক্ষে 12 অক্ষর)"
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
              <button className="button" disabled={busy}>
                {busy && <span className="btn-spinner" aria-hidden="true" />}
                {busy ? "পরিবর্তন হচ্ছে…" : "পাসওয়ার্ড পরিবর্তন করুন"}
              </button>
            </form>
          )}
        </main>
      </div>
      <nav className="mobile-admin-nav" aria-label="অ্যাডমিন নেভিগেশন">
        {[
          ["overview", "/admin", "book", "ড্যাশবোর্ড"],
          ["students", "/admin/students", "users", "আবেদন"],
          ["attendance", "/admin/attendance", "check", "Check-in"],
        ].map(([key, path, icon, label]) => (
          <Link
            key={key}
            href={path}
            className={tab === key ? "active" : ""}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => {
              setMoreOpen(false);
              setError("");
              setMessage("");
            }}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </Link>
        ))}
        <button
          className={
            moreOpen || ["settings", "account"].includes(tab) ? "active" : ""
          }
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(!moreOpen)}
        >
          <span className="more-icon">•••</span>
          <span>আরও</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="mobile-more">
          <Link
            href="/admin/settings"
            onClick={() => {
              setMoreOpen(false);
              setError("");
              setMessage("");
            }}
          >
            <Icon name="calendar" size={18} />
            <span>ইভেন্ট সেটিংস</span>
          </Link>
          <Link
            href="/admin/security"
            onClick={() => {
              setMoreOpen(false);
              setError("");
              setMessage("");
            }}
          >
            <Icon name="shield" size={18} />
            <span>অ্যাকাউন্ট নিরাপত্তা</span>
          </Link>
          <Link href="/">ওয়েবসাইট দেখুন ↗</Link>
          <button
            onClick={async () => {
              await api("auth/logout", {});
              router.push("/login");
            }}
          >
            লগআউট
          </button>
        </div>
      )}
      {filterModalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFilterModalOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setFilterModalOpen(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="ফিল্টার অপশন"
          >
            <div className="modal-head">
              <div>
                <h2>ফিল্টার অপশন</h2>
                <p>নির্দিষ্ট তথ্য অনুযায়ী আবেদন ফিল্টার করুন</p>
              </div>
              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                aria-label="বন্ধ করুন"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleFilterApply} className="review-form">
              <Field label="দাখিল ব্যাচ" optional>
                <input
                  name="batchYear"
                  type="number"
                  placeholder="যেমন: 2023"
                  defaultValue={query.batchYear || ""}
                />
              </Field>

              <Field label="আবেদনের অবস্থা" optional>
                <select
                  name="applicationStatus"
                  defaultValue={query.applicationStatus || ""}
                >
                  <option value="">সব আবেদন</option>
                  <option value="pending">অপেক্ষমান</option>
                  <option value="approved">অনুমোদিত</option>
                  <option value="rejected">বাতিল</option>
                </select>
              </Field>

              <Field label="পেমেন্ট স্ট্যাটাস" optional>
                <select
                  name="paymentStatus"
                  defaultValue={query.paymentStatus || ""}
                >
                  <option value="">সব পেমেন্ট</option>
                  <option value="pending">Pending (অপেক্ষমান)</option>
                  <option value="verified">Verified (যাচাইকৃত)</option>
                  <option value="rejected">Rejected (বাতিল)</option>
                  <option value="correction_required">
                    Correction Required (সংশোধন প্রয়োজন)
                  </option>
                </select>
              </Field>

              <Field label="পেমেন্ট মেথড" optional>
                <select name="method" defaultValue={query.method || ""}>
                  <option value="">সব মেথড</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                </select>
              </Field>

              <Field label="উপস্থিতি" optional>
                <select name="attended" defaultValue={query.attended || ""}>
                  <option value="">সব উপস্থিতি</option>
                  <option value="yes">উপস্থিত</option>
                  <option value="no">অনুপস্থিত</option>
                </select>
              </Field>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "16px",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="button outline"
                  onClick={handleModalReset}
                  style={{ color: "#7a3e3e", borderColor: "#e4baba" }}
                >
                  ফিল্টার রিসেট করুন
                </button>
                <button type="submit" className="button">
                  ফিল্টার প্রয়োগ করুন
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {selected && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              select(null);
              setModalError("");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) {
              select(null);
              setModalError("");
            }
          }}
        >
          <section
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="আবেদন পর্যালোচনা"
          >
            <div className="modal-head">
              <div>
                <h2>{selected.name}</h2>
                <p>{selected.registrationNumber}</p>
              </div>
              <button
                disabled={busy}
                onClick={() => {
                  select(null);
                  setModalError("");
                }}
                aria-label="বন্ধ করুন"
              >
                ✕
              </button>
            </div>
            <Alert success>{message}</Alert>
            <div className="detail-grid">
              {[
                ["মোবাইল", selected.mobile],
                ["ব্যাচ", selected.batchYear],
                ["আবেদন", <Badge key="a" value={selected.applicationStatus} />],
                ["পেমেন্ট", <Badge key="p" value={selected.paymentStatus} />],
                ["মেথড", selected.method],
                ["TrxID", selected.transactionId],
                ["প্রেরক", selected.senderMobileNumber || "দেওয়া হয়নি"],
                ["ফি", `৳ ${(selected.amount || 200).toLocaleString("en-US")}`],
                ["জমার তারিখ", date(selected.createdAt)],
                ...(selected.verifiedAt
                  ? [
                      ["পেমেন্ট যাচাইয়ের সময়", date(selected.verifiedAt)],
                      [
                        "পেমেন্ট যাচাইকারী",
                        selected.verifiedByName ||
                          selected.approvedByName ||
                          "অ্যাডমিন",
                      ],
                    ]
                  : []),
                ...(selected.attendedAt
                  ? [
                      ["উপস্থিতির সময়", date(selected.attendedAt)],
                      [
                        "উপস্থিতি গ্রহণকারী",
                        selected.attendedByName || "অ্যাডমিন",
                      ],
                    ]
                  : [["উপস্থিতি", "এখনও উপস্থিত হননি"]]),
              ].map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <div className="notice">
              <Icon name="search" />
              <p>
                একই নাম ও ব্যাচের সম্ভাব্য ডুপ্লিকেট খুঁজতে তালিকার সার্চ ও
                ব্যাচ ফিল্টার ব্যবহার করুন।
              </p>
            </div>
            <PaymentReview
              key={selected._id + ":" + selected.revision}
              student={selected}
              busy={busy}
              error={modalError}
              onAction={action}
            />

            <details>
              <summary>আবেদনকারীর তথ্য সম্পাদনা</summary>
              <form
                className="review-form"
                key={selected.revision}
                onSubmit={(e) => {
                  e.preventDefault();
                  action({
                    action: "edit",
                    data: Object.fromEntries(new FormData(e.target)),
                  });
                }}
              >
                {[
                  ["নাম", "name"],
                  ["মোবাইল", "mobile"],
                  ["ব্যাচ", "batchYear"],
                  ["রক্তের গ্রুপ", "bloodGroup"],
                  ["ইমেইল", "email"],
                  ["ঠিকানা", "address"],
                  ["TrxID", "transactionId"],
                  ["প্রেরকের নম্বর", "senderMobileNumber"],
                ].map(([label, k]) => (
                  <Field
                    key={k}
                    label={label}
                    name={k}
                    defaultValue={selected[k] || ""}
                    optional
                  />
                ))}
                <Field label="মেথড">
                  <select name="method" defaultValue={selected.method}>
                    <option value="nagad">Nagad</option>
                    <option value="rocket">Rocket</option>
                  </select>
                </Field>
                <Alert>{modalError}</Alert>
                <button className="button" disabled={busy}>
                  {busy && <span className="btn-spinner" aria-hidden="true" />}
                  {busy ? "সংরক্ষণ হচ্ছে…" : "তথ্য সংরক্ষণ করুন"}
                </button>
              </form>
            </details>
            <Link
              className="text-link"
              href={"/verify/" + selected.verificationToken}
            >
              QR ভেরিফিকেশন পেজ খুলুন ↗
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}
function StudentTable({ rows, onSelect, loading = false }) {
  return (
    <>
      <div className="mobile-student-cards">
        {loading && rows.length > 0 && (
          <div
            className="table-inline-loader"
            style={{ borderRadius: 10, marginBottom: 12 }}
          >
            <span className="btn-spinner" aria-hidden="true" />
            <span>নতুন ফলাফল খোঁজা হচ্ছে…</span>
          </div>
        )}
        {rows.map((s) => (
          <article className="student-card" key={s._id}>
            <div className="student-card-top">
              <span className="avatar">{s.name.slice(0, 1)}</span>
              <div>
                <h3>{s.name}</h3>
                <a href={"tel:" + s.mobile}>{s.mobile}</a>
              </div>
              <Badge value={s.paymentStatus} />
            </div>
            <dl>
              <div>
                <dt>দাখিল ব্যাচ</dt>
                <dd>{s.batchYear}</dd>
              </div>
              <div>
                <dt>রেজিস্ট্রেশন</dt>
                <dd>{s.registrationNumber}</dd>
              </div>
              <div>
                <dt>পেমেন্ট মেথড</dt>
                <dd>
                  {s.method === "nagad" ? "Nagad" : "Rocket"} · ৳{" "}
                  {(s.amount || 200).toLocaleString("en-US")}
                </dd>
              </div>
              <div>
                <dt>TrxID</dt>
                <dd>{s.transactionId}</dd>
              </div>
              <div>
                <dt>জমার তারিখ</dt>
                <dd>{date(s.createdAt)}</dd>
              </div>
            </dl>
            <button className="button outline full" onClick={() => onSelect(s)}>
              আবেদন পর্যালোচনা <Icon name="arrow" size={18} />
            </button>
          </article>
        ))}
      </div>
      <div
        className={
          "table-wrap panel" + (rows.length ? " desktop-student-table" : "")
        }
      >
        {loading && rows.length > 0 && (
          <div className="table-inline-loader">
            <span className="btn-spinner" aria-hidden="true" />
            <span>নতুন ফলাফল খোঁজা হচ্ছে…</span>
          </div>
        )}
        <table>
          <thead>
            <tr>
              {[
                "আবেদনকারী",
                "ব্যাচ",
                "রেজিস্ট্রেশন",
                "আবেদন",
                "পেমেন্ট",
                "মেথড / TrxID",
                "প্রেরক",
                "জমার তারিখ",
                "",
              ].map((s, i) => (
                <th key={i}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s._id}>
                <td>
                  <div className="student-cell">
                    {s.photoUrl ? (
                      <Image
                        src={s.photoUrl}
                        alt=""
                        width={34}
                        height={34}
                        unoptimized
                      />
                    ) : (
                      <span className="avatar">{s.name.slice(0, 1)}</span>
                    )}
                    <div>
                      <strong>{s.name}</strong>
                      <small>{s.mobile}</small>
                    </div>
                  </div>
                </td>
                <td>{s.batchYear}</td>
                <td className="mono">{s.registrationNumber}</td>
                <td>
                  <Badge value={s.applicationStatus} />
                </td>
                <td>
                  <Badge value={s.paymentStatus} />
                </td>
                <td>
                  <strong>{s.method}</strong>
                  <small>{s.transactionId}</small>
                </td>
                <td>{s.senderMobileNumber || "—"}</td>
                <td>{date(s.createdAt)}</td>
                <td>
                  <button className="text-button" onClick={() => onSelect(s)}>
                    পর্যালোচনা ↗
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && !rows.length ? (
          <div
            className="status-loading-box"
            style={{
              margin: "35px 20px",
              border: "none",
              boxShadow: "none",
              background: "transparent",
            }}
          >
            <div className="spinner-large" />
            <p>আবেদনকারীদের তথ্য খোঁজা হচ্ছে…</p>
          </div>
        ) : !rows.length ? (
          <div className="empty-state">
            <Icon name="users" size={38} />
            <h3>কোনো আবেদন পাওয়া যায়নি</h3>
            <p>
              নতুন আবেদন এখানে দেখা যাবে। ফিল্টার থাকলে পরিবর্তন করে দেখুন।
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}

function PaymentReview({ student, busy, error, onAction }) {
  const [decision, setDecision] = useState(
    student.paymentStatus === "pending" ? "verified" : student.paymentStatus,
  );
  const [amount, setAmount] = useState(student.amount || 200);
  const verifying = decision === "verified";
  if (student.attendedAt)
    return (
      <div className="notice">
        <Icon name="shield" />
        <p>
          উপস্থিতি নিশ্চিত হয়েছে। এই আবেদনের পেমেন্টের সিদ্ধান্ত পরিবর্তন করা
          যাবে না।
        </p>
      </div>
    );
  const displayAmount =
    Number(amount) > 0 ? Number(amount).toLocaleString("en-US") : "200";
  return (
    <form
      className="review-form payment-review"
      onSubmit={(e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        onAction({
          action: "payment",
          status: decision,
          amount: Number(d.amount) || Number(amount) || 200,
          confirmed: d.confirmed === "on",
          reason: d.reason,
        });
      }}
    >
      <div className="review-fee">
        <span>নির্ধারিত রেজিস্ট্রেশন ফি</span>
        <strong>৳ 200</strong>
        <Badge value={student.paymentStatus} />
      </div>
      <h3>পেমেন্ট যাচাই ও সিদ্ধান্ত</h3>
      <Field label="পেমেন্টের সিদ্ধান্ত">
        <select
          name="status"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
        >
          <option value="verified">যাচাই ও অনুমোদন</option>
          <option value="rejected">পেমেন্ট ও আবেদন বাতিল</option>
          <option value="correction_required">তথ্য সংশোধন প্রয়োজন</option>
        </select>
      </Field>
      {verifying ? (
        <>
          <Field
            label="আসল লেনদেনে পাওয়া টাকার পরিমাণ"
            name="amount"
            type="number"
            inputMode="numeric"
            min="200"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="200"
            required
          />
          <label className="checkbox">
            <input name="confirmed" type="checkbox" required />
            আসল Nagad/Rocket লেনদেনের TrxID ও {displayAmount} টাকা মিলিয়েছি
          </label>
          <p className="review-hint">
            যাচাই করলেই আবেদন অনুমোদিত হবে এবং PDF স্লিপ পাওয়া যাবে।
          </p>
        </>
      ) : (
        <>
          <Field
            label="কারণ / নির্দেশনা"
            name="reason"
            optional
            maxLength={500}
          />
          <p className="review-hint">
            এই সিদ্ধান্তে অনুমোদন ও PDF বন্ধ হবে; নিশ্চিত টাকার হিসাব থেকেও বাদ
            যাবে।
          </p>
        </>
      )}
      <Alert>{error}</Alert>
      <div className="review-action">
        <button className="button full" disabled={busy}>
          {busy && <span className="btn-spinner" aria-hidden="true" />}
          {busy
            ? "সংরক্ষণ হচ্ছে…"
            : verifying
              ? "পেমেন্ট যাচাই ও অনুমোদন করুন"
              : decision === "rejected"
                ? "পেমেন্ট ও আবেদন বাতিল করুন"
                : "সংশোধনের জন্য ফেরত দিন"}
        </button>
      </div>
    </form>
  );
}
