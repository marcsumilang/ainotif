"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface HistoryItem {
  id: string;
  rawNotification: string;
  sourcePackage: string | null;
  timestamp: string;
  createdAt: string;
  requiresReview: boolean;
  analysis: {
    classification: string;
    explanation: string;
    transaction: { amount: number; currency: string; merchant: string } | null;
    diagnostics?: { engine: string; model: string | null; error: string | null };
  };
}

interface Cursor {
  createdAt: string;
  id: string;
}

export default function NotificationHistory({ authToken }: { authToken: string | null }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const cursorRef = useRef<Cursor | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async (append = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    setNeedsSignIn(false);
    try {
      const params = new URLSearchParams({ limit: "25" });
      const activeCursor = cursorRef.current;
      if (append && activeCursor) {
        params.set("beforeCreatedAt", activeCursor.createdAt);
        params.set("beforeId", activeCursor.id);
      }
      const response = await fetch(`/api/notification-history?${params}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        cache: "no-store",
      });
      if (response.status === 401) {
        setNeedsSignIn(true);
        setItems([]);
        cursorRef.current = null;
        setCursor(null);
        setHasMore(false);
        return;
      }
      if (!response.ok) throw new Error("Couldn’t load cloud notification history.");
      const data = await response.json();
      const nextItems = data.notifications as HistoryItem[];
      setItems((current) => append ? [...current, ...nextItems] : nextItems);
      cursorRef.current = data.nextCursor ?? null;
      setCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.hasMore));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t load cloud notification history.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      setItems([]);
      cursorRef.current = null;
      setCursor(null);
      setHasMore(false);
      setNeedsSignIn(true);
      return;
    }
    void load(false);
  }, [authToken, load]);

  return (
    <details className="mb-6 rounded-2xl border border-[#d9dfd5] bg-white p-5">
      <summary className="cursor-pointer font-semibold text-[#163300]">Cloud notification history ({items.length}{hasMore ? "+" : ""})</summary>
      <p className="mt-3 text-sm text-[#454745]">
        Notifications from apps enabled on Android are classified and saved here. OTPs, passwords, and reset links filtered on-device are excluded; offline-only device logs stay on the phone.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={() => void load(false)} disabled={loading} className="rounded-full border border-[#163300] px-4 py-1.5 text-sm font-semibold disabled:opacity-50">
          {loading ? "Loading…" : "Refresh history"}
        </button>
        {hasMore && <button onClick={() => void load(true)} disabled={loading || !cursor} className="rounded-full bg-[#163300] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Load older</button>}
      </div>
      {needsSignIn && <p role="alert" className="mt-3 text-sm text-[#454745]">Sign in to view cloud notification history.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-[#cb272f]">{error}</p>}
      {!loading && !needsSignIn && !error && items.length === 0 && <p className="mt-3 text-sm text-[#454745]">No cloud-classified notifications yet.</p>}
      <ul className="mt-4 max-h-[34rem] space-y-4 overflow-y-auto pr-2">
        {items.map((item) => (
          <li key={item.id} className="border-t border-[#e8ebe6] pt-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#454745]">
              <time dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString()}</time>
              <span>·</span>
              <span>{item.sourcePackage || "Unknown source"}</span>
              <span className="rounded-full bg-[#e8ebe6] px-2 py-0.5">{item.analysis.classification}</span>
              <span>{item.analysis.diagnostics?.engine === "openrouter" ? item.analysis.diagnostics.model ?? "OpenRouter" : item.analysis.diagnostics?.engine === "jev" ? "Jev (historical)" : "Rule-based fallback"}</span>
              {item.analysis.diagnostics?.error && <span className="text-amber-800">Provider unavailable</span>}
              {item.requiresReview && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">Needs review</span>}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#163300]">{item.rawNotification}</p>
            <p className="mt-1 text-sm text-[#454745]">{item.analysis.explanation}</p>
            {item.analysis.transaction && <p className="mt-1 text-sm">Suggested: {item.analysis.transaction.currency} {item.analysis.transaction.amount.toFixed(2)} · {item.analysis.transaction.merchant}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}
