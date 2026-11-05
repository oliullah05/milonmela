// A short-lived, one-use handoff in this tab, never in a public URL.
const KEY = "milonmela:registration-status";
const TTL = 15 * 60 * 1000;
export function rememberRegistrationMobile(mobile) {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ mobile, expiresAt: Date.now() + TTL }),
    );
  } catch {
    /* Manual lookup remains available when browser storage is blocked. */
  }
}
export function consumeRegistrationMobile() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return "";
    sessionStorage.removeItem(KEY);
    const value = JSON.parse(raw);
    return typeof value.mobile === "string" &&
      value.mobile.length <= 40 &&
      Number.isFinite(value.expiresAt) &&
      value.expiresAt > Date.now()
      ? value.mobile
      : "";
  } catch {
    return "";
  }
}
