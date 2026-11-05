"use client";
import { useRef, useState } from "react";
export default function StatusLink({ url }) {
  const input = useRef(null);
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("লিংক কপি হয়েছে");
    } catch {
      input.current?.focus();
      input.current?.select();
      setMessage("লিংকটি নির্বাচন করা হয়েছে। কপি করে সংরক্ষণ করুন।");
    }
  }
  return (
    <div className="saved-status-link">
      <p>
        স্ট্যাটাস দেখতে ও স্লিপ ডাউনলোড করতে লিংকটি সংরক্ষণ করুন।
      </p>
      <div className="status-link-controls">
        <input
          ref={input}
          aria-label="আপনার ব্যক্তিগত স্ট্যাটাস লিংক"
          value={url}
          readOnly
          onClick={(e) => e.currentTarget.select()}
          spellCheck={false}
        />
        <button type="button" className="button" onClick={copy} aria-live="polite">
          {message === "লিংক কপি হয়েছে" ? "কপি হয়েছে ✓" : "কপি করুন"}
        </button>
      </div>
      <span className="copy-feedback" role="status" aria-live="polite">{message && message !== "লিংক কপি হয়েছে" ? message : ""}</span>
    </div>
  );
}
