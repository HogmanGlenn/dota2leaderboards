import { initializeAnalytics, sendWebVital, trackPageView } from "./analytics";

const originalMeasurementId = process.env.REACT_APP_GA_MEASUREMENT_ID;

beforeEach(() => {
  document.head.innerHTML = "";
  delete window.dataLayer;
  delete window.gtag;
  process.env.REACT_APP_GA_MEASUREMENT_ID = "G-TEST123";
  window.history.replaceState({}, "", "/?region=europe");
});

afterEach(() => {
  if (originalMeasurementId === undefined) {
    delete process.env.REACT_APP_GA_MEASUREMENT_ID;
  } else {
    process.env.REACT_APP_GA_MEASUREMENT_ID = originalMeasurementId;
  }
});

test("initializes google analytics when a measurement id is configured", () => {
  initializeAnalytics();

  const script = document.getElementById("google-analytics-script");
  expect(script).toHaveAttribute(
    "src",
    "https://www.googletagmanager.com/gtag/js?id=G-TEST123"
  );
  expect(window.dataLayer[0][0]).toBe("js");
  expect(window.dataLayer[1]).toEqual([
    "config",
    "G-TEST123",
    { page_path: "/?region=europe" },
  ]);
});

test("does nothing without a measurement id", () => {
  delete process.env.REACT_APP_GA_MEASUREMENT_ID;

  initializeAnalytics();

  expect(document.getElementById("google-analytics-script")).toBeNull();
  expect(window.gtag).toBeUndefined();
});

test("tracks route changes after analytics has initialized", () => {
  initializeAnalytics();
  window.dataLayer.length = 0;

  trackPageView("/?region=china");

  expect(window.dataLayer).toEqual([
    ["config", "G-TEST123", { page_path: "/?region=china" }],
  ]);
});

test("sends web vitals as non-interaction events", () => {
  initializeAnalytics();
  window.dataLayer.length = 0;

  sendWebVital({ name: "CLS", id: "metric-id", value: 0.1234 });

  expect(window.dataLayer).toEqual([
    [
      "event",
      "CLS",
      {
        event_category: "Web Vitals",
        event_label: "metric-id",
        non_interaction: true,
        value: 123,
      },
    ],
  ]);
});
