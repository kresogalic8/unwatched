"use client";

export default function AnalyticsPreferences() {
  return <button type="button" className="mt-4 min-h-11 cursor-pointer underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4" onClick={() => window.dispatchEvent(new Event("unwatched:analytics-preferences"))}>
    Change analytics preferences
  </button>;
}
