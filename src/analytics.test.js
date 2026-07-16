import { initializeAnalytics, sendWebVital, trackPageView } from "./analytics";

const originalMeasurementId = process.env.REACT_APP_GA_MEASUREMENT_ID;

function dataLayerEntries() {
  return window.dataLayer.map((entry) => Array.from(entry));
}

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
  expect(dataLayerEntries()[1]).toEqual([
    "config",
    "G-TEST123",
    { send_page_view: false },
  ]);
  expect(dataLayerEntries()[2]).toEqual([
    "event",
    "page_view",
    {
      page_title: "",
      page_location: "http://localhost/?region=europe",
      page_path: "/?region=europe",
      send_to: "G-TEST123",
    },
  ]);
});

test("does nothing without a measurement id", () => {
  delete process.env.REACT_APP_GA_MEASUREMENT_ID;

  initializeAnalytics();

  expect(document.getElementById("google-analytics-script")).toBeNull();
  expect(window.gtag).toBeUndefined();
});

test("initializes analytics when the google script tag already exists", () => {
  const script = document.createElement("script");
  script.id = "google-analytics-script";
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=G-TEST123";
  document.head.appendChild(script);

  initializeAnalytics();

  expect(document.querySelectorAll("#google-analytics-script")).toHaveLength(1);
  expect(typeof window.gtag).toBe("function");
  expect(dataLayerEntries()[1]).toEqual([
    "config",
    "G-TEST123",
    { send_page_view: false },
  ]);
  expect(dataLayerEntries()[2][0]).toBe("event");
  expect(dataLayerEntries()[2][1]).toBe("page_view");
});

test("tracks route changes after analytics has initialized", () => {
  initializeAnalytics();
  window.dataLayer.length = 0;

  trackPageView("/?region=china");

  expect(dataLayerEntries()).toEqual([
    [
      "event",
      "page_view",
      {
        page_title: "",
        page_location: "http://localhost/?region=china",
        page_path: "/?region=china",
        send_to: "G-TEST123",
      },
    ],
  ]);
});

test("sends web vitals as non-interaction events", () => {
  initializeAnalytics();
  window.dataLayer.length = 0;

  sendWebVital({ name: "CLS", id: "metric-id", value: 0.1234 });

  expect(dataLayerEntries()).toEqual([
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
