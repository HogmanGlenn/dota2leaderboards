const GA_SCRIPT_ID = "google-analytics-script";

function measurementId() {
  return process.env.REACT_APP_GA_MEASUREMENT_ID || "";
}

function currentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

export function initializeAnalytics() {
  const id = measurementId();
  if (!id) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };

  if (!document.getElementById(GA_SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }

  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false });
  trackPageView();
}

export function trackPageView(path = currentPath()) {
  const id = measurementId();
  if (!id || typeof window.gtag !== "function") return;

  window.gtag("event", "page_view", {
    page_title: document.title,
    page_location: `${window.location.origin}${path}`,
    page_path: path,
    send_to: id,
  });
}

export function sendWebVital({ name, id, value }) {
  if (typeof window.gtag !== "function") return;

  const roundedValue = name === "CLS" ? Math.round(value * 1000) : Math.round(value);
  window.gtag("event", name, {
    event_category: "Web Vitals",
    event_label: id,
    non_interaction: true,
    value: roundedValue,
  });
}
