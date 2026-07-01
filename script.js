/* ============================================================
   Premium IB — Landing page front-end
   ------------------------------------------------------------
   1) Capture first-touch UTM / referrer into sessionStorage
   2) Fade-in reveal on scroll
   3) Form submission → Google Apps Script Web App
      (fetches client IP via ipify, includes tracking metadata)
   ============================================================ */

// REPLACE THIS WITH YOUR DEPLOYED APPS SCRIPT WEB APP URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxSzzDYc-hP7ZFYc7JJ5hvY5etjAYw96k_qad-l-F-Hkv2dlLEH6DKnE4_eXDn0ojPtXw/exec";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

/* ---------- First-touch attribution ---------- */
function captureFirstTouch() {
  try {
    const params = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v && !sessionStorage.getItem("ft_" + k)) {
        sessionStorage.setItem("ft_" + k, v);
      }
    });
    if (!sessionStorage.getItem("ft_referrer")) {
      sessionStorage.setItem("ft_referrer", document.referrer || "");
    }
    if (!sessionStorage.getItem("ft_landing_url")) {
      sessionStorage.setItem("ft_landing_url", window.location.href);
    }
  } catch (e) {
    // sessionStorage may be unavailable in private mode — degrade silently
  }
}

function getTracking() {
  const read = (k) => {
    try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; }
  };
  return {
    referrer:     read("ft_referrer"),
    utm_source:   read("ft_utm_source"),
    utm_medium:   read("ft_utm_medium"),
    utm_campaign: read("ft_utm_campaign"),
    utm_term:     read("ft_utm_term"),
    utm_content:  read("ft_utm_content"),
    landing_url:  read("ft_landing_url") || window.location.href,
    user_agent:   navigator.userAgent || "",
  };
}

/* ---------- Client IP (best-effort) ---------- */
async function fetchIp() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal });
    if (!res.ok) return "";
    const data = await res.json();
    return data.ip || "";
  } catch (e) {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Visit logging (fire-and-forget) ---------- */
async function logVisit() {
  try {
    const ip = await fetchIp();
    const t = getTracking();
    const payload = {
      type:         "visit",
      visited_at:   new Date().toISOString(),
      ip_address:   ip,
      referrer:     t.referrer,
      utm_source:   t.utm_source,
      utm_medium:   t.utm_medium,
      utm_campaign: t.utm_campaign,
      utm_term:     t.utm_term,
      utm_content:  t.utm_content,
      landing_url:  t.landing_url,
    };
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (e) {
    // Silent: visit logging must never affect UX
  }
}

/* ---------- Reveal on scroll ---------- */
function setupReveal() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".section, .promise-card, .qualify-item, .form-card")
      .forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });

  document.querySelectorAll(".section, .promise-card, .qualify-item, .form-card")
    .forEach((el) => io.observe(el));
}

/* ---------- Form ---------- */
function setupForm() {
  const form    = document.getElementById("applyForm");
  const errBox  = document.getElementById("formError");
  const submit  = document.getElementById("submitBtn");
  const success = document.getElementById("formSuccess");
  if (!form) return;

  const showError = (msg) => {
    errBox.textContent = msg;
    errBox.hidden = false;
    errBox.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const clearError = () => {
    errBox.textContent = "";
    errBox.hidden = true;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const fd = new FormData(form);
    const name         = (fd.get("name")         || "").toString().trim();
    const contact      = (fd.get("contact")      || "").toString().trim();
    const university   = (fd.get("university")   || "").toString().trim();
    const ibScoreRaw   = (fd.get("ib_score")     || "").toString().trim();
    const subjects     = (fd.get("subjects")     || "").toString().trim();
    const availability = (fd.get("availability") || "").toString().trim();

    if (!name || !contact || !university || !ibScoreRaw || !subjects || !availability) {
      showError("모든 항목을 입력해 주세요.");
      return;
    }
    const ibScore = Number(ibScoreRaw);
    if (!Number.isFinite(ibScore) || ibScore < 0 || ibScore > 45) {
      showError("IB 점수는 0–45 사이의 숫자로 입력해 주세요.");
      return;
    }

    submit.disabled = true;
    const originalText = submit.textContent;
    submit.textContent = "전송 중…";

    const ip = await fetchIp();

    const payload = {
      submitted_at: new Date().toISOString(),
      name,
      contact,
      university,
      ib_score: ibScore,
      subjects,
      availability,
      ip_address: ip,
      ...getTracking(),
    };

    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        // text/plain avoids a CORS preflight against Apps Script
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);

      // Swap form for success panel
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      submit.disabled = false;
      submit.textContent = originalText;
      showError("전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
  });
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  captureFirstTouch();
  logVisit();
  setupReveal();
  setupForm();
});
