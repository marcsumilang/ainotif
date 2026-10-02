"use client";

import { useCallback, useEffect, useState } from "react";

interface Review {
  id: string; rawNotification: string; timestamp: string;
  analysis: { explanation: string; diagnostics: { engine: string }; transaction: { amount: number; currency: string; merchant: string } | null };
}

export default function NotificationReviewQueue({ authToken, refreshKey }: { authToken: string | null; refreshKey: boolean }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/notification-reviews", {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Couldn’t load notifications for review.");
      const data = await response.json();
      setReviews(data.reviews);
    } catch {
      setError("Couldn’t load notifications for review.");
    } finally { setLoading(false); }
  }, [authToken]);
  useEffect(() => { if (!refreshKey) void load(); }, [load, refreshKey]);

  return (
    <details className="mb-6 rounded-2xl border border-[#d9dfd5] bg-white p-5">
      <summary className="cursor-pointer font-semibold text-[#163300]">Notifications to review ({reviews.length})</summary>
      <p className="mt-3 text-sm text-[#454745]">Uncertain financial messages and warnings stay here for inspection. Financial messages in this list haven’t been added to your ledger automatically. Original notifications stay visible.</p>
      <button onClick={() => void load()} disabled={loading} className="mt-3 rounded-full border border-[#163300] px-4 py-1.5 text-sm font-semibold disabled:opacity-50">{loading ? "Loading…" : "Refresh reviews"}</button>
      {error && <p role="alert" className="mt-3 text-sm text-[#cb272f]">{error} Use Refresh reviews to retry.</p>}
      {!loading && !error && reviews.length === 0 && <p className="mt-3 text-sm text-[#454745]">No notifications need review.</p>}
      <ul className="mt-4 space-y-4">
        {reviews.map((review) => (
          <li key={review.id} className="border-t border-[#e8ebe6] pt-3">
            <p className="text-xs text-[#454745]">{new Date(review.timestamp).toLocaleString()} · {review.analysis.diagnostics.engine === "heuristic" ? "Rule-based fallback" : "Jev analysis"}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#163300]">{review.rawNotification}</p>
            <p className="mt-1 text-sm text-[#454745]">{review.analysis.explanation}</p>
            {review.analysis.transaction && <p className="mt-1 text-sm">Suggested amount: {review.analysis.transaction.currency} {review.analysis.transaction.amount.toFixed(2)} · {review.analysis.transaction.merchant}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}
