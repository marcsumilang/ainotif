"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  RefreshCw,
  Search,
  Trash2,
  Eye,
  Play,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  X,
  Copy,
  Check,
  Smartphone,
  Sparkles,
  PieChart,
  BarChart3,
  Cpu,
  Lock,
  Radio,
  Edit2,
  Layers,
} from "lucide-react";

interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  type: "DEBIT" | "CREDIT" | "TRANSFER";
  rawNotification: string;
  sourcePackage: string | null;
  timestamp: string | Date;
  createdAt: string | Date;
}

interface SuspiciousAlert {
  id: string;
  userId: string;
  rawNotification: string;
  sourcePackage: string | null;
  riskScore: number;
  reason: string;
  phishingCues: string | null;
  timestamp: string | Date;
  isDismissed: boolean;
  createdAt: string | Date;
}

interface Stats {
  totalTransactions: number;
  totalSpent: number;
  totalReceived: number;
  netFlow: number;
  categoryBreakdown: Record<string, number>;
  totalAlerts: number;
  activeAlerts: number;
  avgRiskScore: number;
}

const PRESETS = [
  {
    label: "🛒 Chase Grocery Spend",
    title: "Chase Mobile",
    text: "You spent $84.20 at Trader Joe's Market on card ending in 8832.",
    packageName: "com.chase.sig.android",
    category: "Financial / Debit",
  },
  {
    label: "☕ Starbucks Coffee",
    title: "Citi Alerts",
    text: "Authorized charge of $5.75 at Starbucks Coffee store #1042.",
    packageName: "com.citibank.mobile.citibankmobile",
    category: "Financial / Debit",
  },
  {
    label: "💼 Salary Direct Deposit",
    title: "Bank of America",
    text: "Direct Deposit of $3,450.00 from TECHCORP GLOBAL INC has arrived.",
    packageName: "com.infonow.bofa",
    category: "Financial / Credit",
  },
  {
    label: "🚨 Urgent Phishing Scam SMS",
    title: "SMS: +1 (800) 555-0199",
    text: "URGENT SECURITY NOTICE: Your Wells Fargo debit card has been suspended. Tap http://bit.ly/wf-auth-sec within 15 mins to restore access.",
    packageName: "com.google.android.apps.messaging",
    category: "Threat / Scam",
  },
  {
    label: "🛡️ Sensitive OTP Code (Privacy Drop)",
    title: "Google Auth",
    text: "Your verification code is 492019. Do NOT share this code with anyone.",
    packageName: "com.google.android.apps.messaging",
    category: "Privacy / Dropped",
  },
];

const RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.28,
  PHP: 0.0175,
  CAD: 0.73,
  AUD: 0.65,
  JPY: 0.0065,
  INR: 0.012,
  SGD: 0.75,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  PHP: "₱",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
  INR: "₹",
  SGD: "S$",
};

function convertCurrency(amount: number, from: string, to: string): number {
  if (from.toUpperCase() === to.toUpperCase()) return amount;
  const fromRate = RATES_TO_USD[from.toUpperCase()] || 1.0;
  const toRate = RATES_TO_USD[to.toUpperCase()] || 1.0;
  const inUsd = amount * fromRate;
  return inUsd / toRate;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "alerts" | "analytics" | "simulator">("overview");
  const [userId, setUserId] = useState<string>("user_demo_dev");
  const [baseCurrency, setBaseCurrency] = useState<string>("USD");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<SuspiciousAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // SSE & Live Animation State
  const [isLiveStreamActive, setIsLiveStreamActive] = useState<boolean>(false);
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());

  // Bulk selection state
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>("Groceries");

  // Inspector Modal state
  const [inspectedItem, setInspectedItem] = useState<{
    type: "transaction" | "alert";
    item: Transaction | SuspiciousAlert;
  } | null>(null);

  // Editable transaction state in modal
  const [editMerchant, setEditMerchant] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Filters for Transactions
  const [txSearch, setTxSearch] = useState<string>("");
  const [txTypeFilter, setTxTypeFilter] = useState<string>("ALL");
  const [txCategoryFilter, setTxCategoryFilter] = useState<string>("ALL");
  const [txSort, setTxSort] = useState<string>("date_desc");

  // Filters for Alerts
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>("ALL");
  const [alertRiskFilter, setAlertRiskFilter] = useState<string>("ALL");

  // Simulator state
  const [simTitle, setSimTitle] = useState<string>(PRESETS[0].title);
  const [simText, setSimText] = useState<string>(PRESETS[0].text);
  const [simPackage, setSimPackage] = useState<string>(PRESETS[0].packageName);
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, alertsRes] = await Promise.all([
        fetch(`/api/transactions?userId=${userId}`),
        fetch(`/api/alerts?userId=${userId}`),
      ]);

      if (txRes.ok) {
        const data = await txRes.json();
        setTransactions(data.transactions || []);
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  // Connect to Server-Sent Events (SSE) Stream
  useEffect(() => {
    let evtSource: EventSource | null = null;
    try {
      evtSource = new EventSource("/api/events");
      evtSource.addEventListener("connected", () => {
        setIsLiveStreamActive(true);
      });

      evtSource.addEventListener("transaction_created", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.transaction) {
            const tx: Transaction = payload.transaction;
            setTransactions((prev) => [tx, ...prev.filter((t) => t.id !== tx.id)]);
            setNewlyAddedIds((prev) => new Set(prev).add(tx.id));
            setTimeout(() => {
              setNewlyAddedIds((prev) => {
                const next = new Set(prev);
                next.delete(tx.id);
                return next;
              });
            }, 4000);
          }
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      });

      evtSource.addEventListener("alert_created", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.alert) {
            const alert: SuspiciousAlert = payload.alert;
            setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
          }
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      });

      evtSource.addEventListener("transaction_deleted", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.ids) {
            const ids: string[] = payload.ids;
            setTransactions((prev) => prev.filter((t) => !ids.includes(t.id)));
          }
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      });

      evtSource.addEventListener("transaction_updated", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.transaction) {
            setTransactions((prev) =>
              prev.map((t) => (t.id === payload.transaction.id ? payload.transaction : t))
            );
          } else if (payload?.ids && payload?.category) {
            setTransactions((prev) =>
              prev.map((t) =>
                payload.ids.includes(t.id) ? { ...t, category: payload.category } : t
              )
            );
          }
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      });

      evtSource.onerror = () => {
        setIsLiveStreamActive(false);
      };
    } catch (_: unknown) {
      setIsLiveStreamActive(false);
    }

    return () => {
      evtSource?.close();
    };
  }, []);

  // Multi-currency normalized statistics
  const normalizedStats = useMemo(() => {
    let spent = 0;
    let received = 0;
    const breakdown: Record<string, number> = {};

    for (const t of transactions) {
      const converted = convertCurrency(t.amount, t.currency || "USD", baseCurrency);
      if (t.type === "DEBIT") {
        spent += converted;
        breakdown[t.category] = (breakdown[t.category] || 0) + converted;
      } else if (t.type === "CREDIT") {
        received += converted;
      }
    }

    const net = received - spent;
    return {
      totalSpent: Math.round(spent * 100) / 100,
      totalReceived: Math.round(received * 100) / 100,
      netFlow: Math.round(net * 100) / 100,
      categoryBreakdown: breakdown,
      totalTransactions: transactions.length,
      activeAlerts: alerts.filter((a) => !a.isDismissed).length,
      totalAlerts: alerts.length,
    };
  }, [transactions, alerts, baseCurrency]);

  const handleDismissAlert = async (alertId: string) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alertId, userId }),
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, isDismissed: true } : a))
        );
      }
    } catch (err) {
      console.error("Failed to dismiss alert:", err);
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm("Are you sure you want to delete this transaction record?")) return;
    try {
      const res = await fetch(`/api/transactions?id=${txId}&userId=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTransactions((prev) => prev.filter((t) => t.id !== txId));
        if (inspectedItem?.item.id === txId) {
          setInspectedItem(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete transaction:", err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTxIds.size === 0) return;
    if (!confirm(`Delete ${selectedTxIds.size} selected transaction(s)?`)) return;
    try {
      const ids = Array.from(selectedTxIds).join(",");
      const res = await fetch(`/api/transactions?ids=${ids}&userId=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTransactions((prev) => prev.filter((t) => !selectedTxIds.has(t.id)));
        setSelectedTxIds(new Set());
      }
    } catch (err) {
      console.error("Bulk delete failed:", err);
    }
  };

  const handleBulkCategorize = async (category: string) => {
    if (selectedTxIds.size === 0) return;
    try {
      const ids = Array.from(selectedTxIds);
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, category, userId }),
      });
      if (res.ok) {
        setTransactions((prev) =>
          prev.map((t) => (selectedTxIds.has(t.id) ? { ...t, category } : t))
        );
        setSelectedTxIds(new Set());
      }
    } catch (err) {
      console.error("Bulk categorize failed:", err);
    }
  };

  const handleSaveInspectedTransaction = async () => {
    if (!inspectedItem || inspectedItem.type !== "transaction") return;
    const tx = inspectedItem.item as Transaction;
    setIsSavingEdit(true);
    try {
      const amountNum = parseFloat(editAmount) || tx.amount;
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tx.id,
          merchant: editMerchant,
          category: editCategory,
          amount: amountNum,
          userId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.transaction) {
          setTransactions((prev) =>
            prev.map((t) => (t.id === tx.id ? data.transaction : t))
          );
          setInspectedItem({ type: "transaction", item: data.transaction });
        }
      }
    } catch (err) {
      console.error("Failed to update transaction:", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRunSimulator = async () => {
    setSimLoading(true);
    setSimResult(null);
    try {
      const res = await fetch("/api/process-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: simTitle,
          text: simText,
          packageName: simPackage,
          userId,
          timestamp: Date.now(),
        }),
      });
      const data = await res.json();
      setSimResult(data);
      fetchData();
    } catch (err: any) {
      setSimResult({ error: err.message || "Failed to process simulation" });
    } finally {
      setSimLoading(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (txTypeFilter !== "ALL" && t.type !== txTypeFilter) return false;
        if (txCategoryFilter !== "ALL" && t.category !== txCategoryFilter) return false;
        if (txSearch) {
          const q = txSearch.toLowerCase();
          const matchMerchant = t.merchant.toLowerCase().includes(q);
          const matchRaw = t.rawNotification.toLowerCase().includes(q);
          const matchCat = t.category.toLowerCase().includes(q);
          if (!matchMerchant && !matchRaw && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (txSort === "date_desc") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (txSort === "date_asc") return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (txSort === "amount_desc") return b.amount - a.amount;
        if (txSort === "amount_asc") return a.amount - b.amount;
        return 0;
      });
  }, [transactions, txTypeFilter, txCategoryFilter, txSearch, txSort]);

  // Categories list
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(t.category));
    return Array.from(set);
  }, [transactions]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (alertStatusFilter === "ACTIVE" && a.isDismissed) return false;
      if (alertStatusFilter === "DISMISSED" && !a.isDismissed) return false;
      if (alertRiskFilter === "CRITICAL" && a.riskScore < 80) return false;
      if (alertRiskFilter === "HIGH" && (a.riskScore < 60 || a.riskScore >= 80)) return false;
      if (alertRiskFilter === "MEDIUM" && (a.riskScore < 40 || a.riskScore >= 60)) return false;
      return true;
    });
  }, [alerts, alertStatusFilter, alertRiskFilter]);

  const parseCues = (cues: string | null): string[] => {
    if (!cues) return [];
    try {
      return JSON.parse(cues);
    } catch {
      return [cues];
    }
  };

  const getRiskBadge = (score: number) => {
    if (score >= 80) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">Critical Risk ({score}%)</span>;
    }
    if (score >= 60) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">High Risk ({score}%)</span>;
    }
    if (score >= 40) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">Moderate ({score}%)</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">Low Risk ({score}%)</span>;
  };

  const symbol = CURRENCY_SYMBOLS[baseCurrency] || "$";

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-indigo-500/30">
      {/* Top Universal App Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-xl px-4 md:px-6 py-3.5">
        <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Product Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  AiNotif <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Command Center</span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Privacy-first AI Notification Guardian & Financial Ledger</p>
            </div>
          </div>

          {/* System Health & Live SSE Indicator */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
            {/* Live SSE Stream Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className={`w-2 h-2 rounded-full ${isLiveStreamActive ? "bg-emerald-400 animate-pulse" : "bg-emerald-600"}`}></span>
              <span className="hidden sm:inline">Live SSE Stream: Active</span>
              <span className="sm:hidden">Live</span>
            </div>

            {/* Base Currency Dropdown */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/60 rounded-lg px-2.5 py-1 text-xs text-slate-300">
              <span className="hidden md:inline text-slate-400">Base Currency:</span>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
              >
                {Object.keys(RATES_TO_USD).map((c) => (
                  <option key={c} value={c} className="bg-slate-900 text-white">
                    {c} ({CURRENCY_SYMBOLS[c] || c})
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchData}
              disabled={loading}
              title="Refresh Data"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>

            {/* Simulator shortcut */}
            <button
              onClick={() => setActiveTab("simulator")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Simulator</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-[1920px] mx-auto w-full p-4 md:p-6 space-y-6 flex-1">
        {/* Normalized KPI Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {/* 1. Total Spent */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Total Outflow ({baseCurrency})</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                {symbol}{normalizedStats.totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Normalized Debit Spend</p>
            </div>
          </div>

          {/* 2. Total Inflow */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Total Inflow ({baseCurrency})</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                {symbol}{normalizedStats.totalReceived.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Salary & Credit Deposits</p>
            </div>
          </div>

          {/* 3. Net Flow */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Net Delta</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className={`text-xl sm:text-2xl font-bold tracking-tight font-mono ${normalizedStats.netFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {normalizedStats.netFlow >= 0 ? "+" : ""}{symbol}{normalizedStats.netFlow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Inflow vs Outflow</p>
            </div>
          </div>

          {/* 4. Transactions Count */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Total Events</span>
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                {normalizedStats.totalTransactions}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Parsed Records</p>
            </div>
          </div>

          {/* 5. Blocked Scams */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Threats Blocked</span>
              <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-orange-400 font-mono">
                {normalizedStats.totalAlerts}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{normalizedStats.activeAlerts} Active Threat(s)</p>
            </div>
          </div>

          {/* 6. Privacy Shield */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">OTP Shield</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-lg font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                <ShieldCheck className="w-5 h-5" />
                <span>100% On-Device</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Zero Leakage Guaranteed</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === "overview"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab("transactions")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === "transactions"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Transactions ({transactions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("alerts")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === "alerts"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Security Radar ({alerts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("simulator")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === "simulator"
                  ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Simulator</span>
            </button>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Left Column (7 cols): Recent Financial Transactions */}
              <div className="xl:col-span-7 glass-panel rounded-2xl p-6 border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">Recent Transactions</h2>
                      <p className="text-xs text-slate-400">Latest financial activities captured from mobile notifications</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("transactions")}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition"
                  >
                    <span>View all ({transactions.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {transactions.slice(0, 6).map((tx) => {
                    const isNew = newlyAddedIds.has(tx.id);
                    const converted = convertCurrency(tx.amount, tx.currency || "USD", baseCurrency);
                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          setInspectedItem({ type: "transaction", item: tx });
                          setEditMerchant(tx.merchant);
                          setEditCategory(tx.category);
                          setEditAmount(tx.amount.toString());
                        }}
                        className={`py-3.5 flex items-center justify-between hover:bg-slate-800/30 px-3 rounded-xl cursor-pointer transition ${
                          isNew ? "bg-indigo-500/20 ring-1 ring-indigo-500 animate-pulse" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className={`p-2.5 rounded-xl ${
                            tx.type === "CREDIT"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : tx.type === "TRANSFER"
                              ? "bg-cyan-500/10 text-cyan-400"
                              : "bg-slate-800 text-slate-300"
                          }`}>
                            {tx.type === "CREDIT" ? <ArrowDownLeft className="w-4 h-4" /> : tx.type === "TRANSFER" ? <ArrowLeftRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-white flex items-center gap-2">
                              <span>{tx.merchant}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                {tx.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate max-w-xs md:max-w-md mt-0.5 font-mono">
                              {tx.rawNotification}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold text-sm ${
                            tx.type === "CREDIT" ? "text-emerald-400" : "text-slate-100"
                          }`}>
                            {tx.type === "CREDIT" ? "+" : "-"}{CURRENCY_SYMBOLS[tx.currency] || tx.currency} {tx.amount.toFixed(2)}
                          </div>
                          {tx.currency !== baseCurrency && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              ≈ {symbol}{converted.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column (5 cols): Security Radar */}
              <div className="xl:col-span-5 glass-panel rounded-2xl p-6 border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">Active Scam Radar</h2>
                      <p className="text-xs text-slate-400">Suspicious phishing SMS & unauthorized bank lures</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("alerts")}
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium transition"
                  >
                    <span>View all ({alerts.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {alerts.slice(0, 4).map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => setInspectedItem({ type: "alert", item: alert })}
                      className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        {getRiskBadge(alert.riskScore)}
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-white">{alert.reason}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-2 font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-900">
                        "{alert.rawNotification}"
                      </p>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      No active security threats detected.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TRANSACTIONS TAB (WITH BULK ACTIONS & RESPONSIVE CARDS) */}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            {/* Search, Filter & Bulk Controls Toolbar */}
            <div className="glass-panel rounded-2xl p-4 border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search input */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Search merchant, text, category..."
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  {txSearch && (
                    <button onClick={() => setTxSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Type Filter */}
                <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 text-xs">
                  {["ALL", "DEBIT", "CREDIT", "TRANSFER"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setTxTypeFilter(type)}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        txTypeFilter === type ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Category Dropdown */}
                <select
                  value={txCategoryFilter}
                  onChange={(e) => setTxCategoryFilter(e.target.value)}
                  className="bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Sort:</span>
                <select
                  value={txSort}
                  onChange={(e) => setTxSort(e.target.value)}
                  className="bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="amount_desc">Highest Amount</option>
                  <option value="amount_asc">Lowest Amount</option>
                </select>
              </div>
            </div>

            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden md:block glass-panel rounded-2xl border-slate-800/80 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={filteredTransactions.length > 0 && selectedTxIds.size === filteredTransactions.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)));
                            } else {
                              setSelectedTxIds(new Set());
                            }
                          }}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Merchant</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Notification Preview</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4 text-right">Amount ({baseCurrency})</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-normal">
                    {filteredTransactions.map((tx) => {
                      const isNew = newlyAddedIds.has(tx.id);
                      const isSelected = selectedTxIds.has(tx.id);
                      const converted = convertCurrency(tx.amount, tx.currency || "USD", baseCurrency);

                      return (
                        <tr
                          key={tx.id}
                          className={`hover:bg-slate-800/40 transition group cursor-pointer ${
                            isNew ? "bg-indigo-500/20 ring-1 ring-indigo-500" : ""
                          } ${isSelected ? "bg-indigo-900/20" : ""}`}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedTxIds);
                                if (e.target.checked) next.add(tx.id);
                                else next.delete(tx.id);
                                setSelectedTxIds(next);
                              }}
                              className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap" onClick={() => {
                            setInspectedItem({ type: "transaction", item: tx });
                            setEditMerchant(tx.merchant);
                            setEditCategory(tx.category);
                            setEditAmount(tx.amount.toString());
                          }}>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                              tx.type === "CREDIT"
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : tx.type === "TRANSFER"
                                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                                : "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}>
                              <span>{tx.type}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-white whitespace-nowrap" onClick={() => {
                            setInspectedItem({ type: "transaction", item: tx });
                            setEditMerchant(tx.merchant);
                            setEditCategory(tx.category);
                            setEditAmount(tx.amount.toString());
                          }}>
                            {tx.merchant}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap" onClick={() => {
                            setInspectedItem({ type: "transaction", item: tx });
                            setEditMerchant(tx.merchant);
                            setEditCategory(tx.category);
                            setEditAmount(tx.amount.toString());
                          }}>
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/80 font-medium text-[11px]">
                              {tx.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-sm truncate text-slate-400 font-mono text-[11px]" onClick={() => {
                            setInspectedItem({ type: "transaction", item: tx });
                            setEditMerchant(tx.merchant);
                            setEditCategory(tx.category);
                            setEditAmount(tx.amount.toString());
                          }}>
                            {tx.rawNotification}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                            {new Date(tx.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap font-mono">
                            <span className={`font-bold ${tx.type === "CREDIT" ? "text-emerald-400" : "text-white"}`}>
                              {tx.type === "CREDIT" ? "+" : "-"}{symbol}{converted.toFixed(2)}
                            </span>
                            {tx.currency !== baseCurrency && (
                              <span className="text-[10px] text-slate-400 ml-1">
                                ({CURRENCY_SYMBOLS[tx.currency] || tx.currency}{tx.amount.toFixed(2)})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setInspectedItem({ type: "transaction", item: tx });
                                  setEditMerchant(tx.merchant);
                                  setEditCategory(tx.category);
                                  setEditAmount(tx.amount.toString());
                                }}
                                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile / Tablet Responsive Card View (Visible only on small screens) */}
            <div className="block md:hidden space-y-3">
              {filteredTransactions.map((tx) => {
                const isNew = newlyAddedIds.has(tx.id);
                const isSelected = selectedTxIds.has(tx.id);
                const converted = convertCurrency(tx.amount, tx.currency || "USD", baseCurrency);

                return (
                  <div
                    key={tx.id}
                    onClick={() => {
                      setInspectedItem({ type: "transaction", item: tx });
                      setEditMerchant(tx.merchant);
                      setEditCategory(tx.category);
                      setEditAmount(tx.amount.toString());
                    }}
                    className={`glass-panel rounded-2xl p-4 border-slate-800 space-y-2 cursor-pointer transition ${
                      isNew ? "bg-indigo-500/20 ring-1 ring-indigo-500" : ""
                    } ${isSelected ? "border-indigo-500" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const next = new Set(selectedTxIds);
                            if (e.target.checked) next.add(tx.id);
                            else next.delete(tx.id);
                            setSelectedTxIds(next);
                          }}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span className="font-bold text-white text-sm">{tx.merchant}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {tx.category}
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className={`font-bold text-sm ${tx.type === "CREDIT" ? "text-emerald-400" : "text-white"}`}>
                          {tx.type === "CREDIT" ? "+" : "-"}{symbol}{converted.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 font-mono truncate">{tx.rawNotification}</p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                      <span>{new Date(tx.timestamp).toLocaleDateString()}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTransaction(tx.id);
                        }}
                        className="text-rose-400 hover:text-rose-300 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Floating Bulk Actions Toolbar */}
            {selectedTxIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-panel rounded-2xl p-3 border-indigo-500/50 shadow-2xl bg-slate-900/95 flex items-center gap-4">
                <span className="text-xs font-semibold text-white px-2">
                  {selectedTxIds.size} selected
                </span>

                <div className="flex items-center gap-2">
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    {["Food & Dining", "Groceries", "Shopping", "Transport & Travel", "Bills & Utilities", "Entertainment", "Income", "General"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleBulkCategorize(bulkCategory)}
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                  >
                    Apply Category
                  </button>

                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>

                  <button
                    onClick={() => setSelectedTxIds(new Set())}
                    className="text-xs text-slate-400 hover:text-white px-2"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RADAR (ALERTS) */}
        {activeTab === "alerts" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => setInspectedItem({ type: "alert", item: alert })}
                  className="glass-panel rounded-2xl p-5 border-slate-800/80 hover:border-slate-700 cursor-pointer transition space-y-3"
                >
                  <div className="flex items-center justify-between">
                    {getRiskBadge(alert.riskScore)}
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(alert.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white">{alert.reason}</h3>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-900 text-xs font-mono text-rose-300">
                    "{alert.rawNotification}"
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismissAlert(alert.id);
                      }}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{alert.isDismissed ? "Dismissed" : "Dismiss Alert"}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyText(alert.rawNotification, alert.id);
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      {copiedId === alert.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SIMULATOR */}
        {activeTab === "simulator" && (
          <div className="max-w-2xl mx-auto glass-panel rounded-2xl p-6 border-slate-800/80 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <span>Live Notification Simulator</span>
              </h2>
              <p className="text-xs text-slate-400">Inject mock notifications directly into the processing pipeline.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Select Preset:</label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSimTitle(p.title);
                      setSimText(p.text);
                      setSimPackage(p.packageName);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400">Notification Title / Sender:</label>
                <input
                  type="text"
                  value={simTitle}
                  onChange={(e) => setSimTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400">Notification Content:</label>
                <textarea
                  rows={3}
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1"
                />
              </div>
            </div>

            <button
              onClick={handleRunSimulator}
              disabled={simLoading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
            >
              {simLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              <span>Process Notification</span>
            </button>

            {simResult && (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono space-y-2">
                <span className="font-bold text-slate-300">Pipeline Output:</span>
                <pre className="text-slate-400 overflow-x-auto text-[11px]">
                  {JSON.stringify(simResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* INSPECTOR & TRANSACTION EDIT MODAL */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl max-w-lg w-full p-6 border-slate-800 space-y-5 bg-slate-950">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {inspectedItem.type === "transaction" ? <CreditCard className="w-4 h-4 text-indigo-400" /> : <ShieldAlert className="w-4 h-4 text-orange-400" />}
                <span>{inspectedItem.type === "transaction" ? "Transaction Inspector & Editor" : "Threat Inspector"}</span>
              </h3>
              <button onClick={() => setInspectedItem(null)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {inspectedItem.type === "transaction" ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 font-medium">Merchant:</label>
                  <input
                    type="text"
                    value={editMerchant}
                    onChange={(e) => setEditMerchant(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-medium">Category:</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white mt-1 cursor-pointer"
                    >
                      {["Food & Dining", "Groceries", "Shopping", "Transport & Travel", "Bills & Utilities", "Entertainment", "Income", "Transfers", "General"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 font-medium">Amount ({(inspectedItem.item as Transaction).currency}):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white mt-1 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 font-medium">Original Intercepted Text:</label>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-slate-300 mt-1 break-all">
                    {inspectedItem.item.rawNotification}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => handleDeleteTransaction(inspectedItem.item.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-medium transition"
                  >
                    Delete Transaction
                  </button>

                  <button
                    onClick={handleSaveInspectedTransaction}
                    disabled={isSavingEdit}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
                  >
                    {isSavingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-2">
                  {getRiskBadge((inspectedItem.item as SuspiciousAlert).riskScore)}
                  <span className="text-slate-400 font-mono">Score: {(inspectedItem.item as SuspiciousAlert).riskScore}/100</span>
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Interception Reason:</label>
                  <p className="text-white text-sm font-semibold mt-1">{(inspectedItem.item as SuspiciousAlert).reason}</p>
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Raw Intercepted Text:</label>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-rose-300 mt-1 break-all">
                    {inspectedItem.item.rawNotification}
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setInspectedItem(null)}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
