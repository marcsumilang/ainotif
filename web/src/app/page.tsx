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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "alerts" | "analytics" | "simulator">("overview");
  const [userId, setUserId] = useState<string>("user_demo_dev");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<SuspiciousAlert[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Inspector Modal state
  const [inspectedItem, setInspectedItem] = useState<{
    type: "transaction" | "alert";
    item: Transaction | SuspiciousAlert;
  } | null>(null);

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
      const [txRes, alertsRes, statsRes] = await Promise.all([
        fetch(`/api/transactions?userId=${userId}`),
        fetch(`/api/alerts?userId=${userId}`),
        fetch(`/api/stats?userId=${userId}`),
      ]);

      if (txRes.ok) {
        const data = await txRes.json();
        setTransactions(data.transactions || []);
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
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
        if (stats) {
          setStats({ ...stats, activeAlerts: Math.max(0, stats.activeAlerts - 1) });
        }
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
        fetchData();
      }
    } catch (err) {
      console.error("Failed to delete transaction:", err);
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
      // Refresh list to show newly created item
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
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/40">High Risk ({score}%)</span>;
    }
    if (score >= 40) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">Medium Risk ({score}%)</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Low Risk ({score}%)</span>;
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-indigo-500/30">
      {/* Top Universal App Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-xl px-6 py-3.5">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
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
                  AiNotif <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Web Command Center</span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Privacy-first AI Notification Guardian & Financial Ledger</p>
            </div>
          </div>

          {/* System Health Indicators */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Postgres Neon: Connected</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Engine: OpenRouter</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
              <Lock className="w-3.5 h-3.5" />
              <span>OTP Privacy Pre-Filter: ACTIVE</span>
            </div>
          </div>

          {/* User selector & Actions */}
          <div className="flex items-center gap-3">
            {/* User identity dropdown */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline text-slate-400">Active Profile:</span>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="user_demo_dev" className="bg-slate-900 text-white">Demo Admin (user_demo_dev)</option>
                <option value="user_alice" className="bg-slate-900 text-white">Alice (user_alice)</option>
                <option value="user_bob" className="bg-slate-900 text-white">Bob (user_bob)</option>
              </select>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchData}
              disabled={loading}
              title="Refresh Data"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>

            {/* Test Simulator shortcut */}
            <button
              onClick={() => setActiveTab("simulator")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Launch Simulator</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-[1920px] mx-auto w-full p-6 space-y-6 flex-1">
        {/* Big-Screen KPI Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* 1. Total Spent */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Total Outflow</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-white font-mono">
                ${stats ? stats.totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Aggregated Debit Transactions</p>
            </div>
          </div>

          {/* 2. Total Inflow */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Total Inflow</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-white font-mono">
                ${stats ? stats.totalReceived.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Salary & Credit Deposits</p>
            </div>
          </div>

          {/* 3. Net Flow */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Net Balance Flow</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className={`text-2xl font-bold tracking-tight font-mono ${stats && stats.netFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {stats && stats.netFlow >= 0 ? "+" : ""}${stats ? stats.netFlow.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Net Delta Recorded</p>
            </div>
          </div>

          {/* 4. Transactions Count */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Recorded Events</span>
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-white font-mono">
                {stats ? stats.totalTransactions : 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Parsed Push & SMS</p>
            </div>
          </div>

          {/* 5. Active Threats */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Active Phishing Threats</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-rose-400 font-mono">
                {stats ? stats.activeAlerts : 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Pending Review ({stats ? stats.totalAlerts : 0} Total)</p>
            </div>
          </div>

          {/* 6. Threat Index */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Threat Risk Index</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-amber-300 font-mono">
                {stats ? stats.avgRiskScore : 0} / 100
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Heuristic & AI Severity</p>
            </div>
          </div>
        </div>

        {/* Big-Screen Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === "overview"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Command Center</span>
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
              <span>Transactions Explorer</span>
              <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-slate-900/60 border border-slate-700">
                {transactions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("alerts")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === "alerts"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Phishing & Scam Shield</span>
              {stats && stats.activeAlerts > 0 && (
                <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-rose-500 text-white font-bold animate-pulse">
                  {stats.activeAlerts}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === "analytics"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>Analytics & Insights</span>
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
              <span>Notification Lab (Simulator)</span>
            </button>
          </div>
        </div>

        {/* TAB 1: COMMAND CENTER (OVERVIEW) */}
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
                  {transactions.slice(0, 5).map((tx) => (
                    <div
                      key={tx.id}
                      onClick={() => setInspectedItem({ type: "transaction", item: tx })}
                      className="py-3.5 flex items-center justify-between hover:bg-slate-800/30 px-3 rounded-xl cursor-pointer transition"
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
                          <p className="text-xs text-slate-400 truncate max-w-md mt-0.5">
                            {tx.rawNotification}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-mono font-bold text-sm ${
                          tx.type === "CREDIT" ? "text-emerald-400" : "text-slate-100"
                        }`}>
                          {tx.type === "CREDIT" ? "+" : "-"}${tx.amount.toFixed(2)}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="py-12 text-center text-slate-400 text-sm">
                      No transactions recorded yet. Use the Simulator to inject sample transactions!
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column (5 cols): Security Threat Alerts */}
              <div className="xl:col-span-5 glass-panel rounded-2xl p-6 border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">Phishing & Security Feed</h2>
                      <p className="text-xs text-slate-400">High-risk SMS scams and malicious links intercepted</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("alerts")}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium transition"
                  >
                    <span>Shield ({alerts.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {alerts.slice(0, 4).map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => setInspectedItem({ type: "alert", item: alert })}
                      className={`p-4 rounded-xl border cursor-pointer transition ${
                        alert.isDismissed
                          ? "bg-slate-900/40 border-slate-800/40 opacity-60"
                          : "bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getRiskBadge(alert.riskScore)}
                            {alert.isDismissed && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">Dismissed</span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-white leading-snug">
                            {alert.reason}
                          </h4>
                          <p className="text-xs text-slate-400 line-clamp-2 font-mono bg-slate-950/60 p-2 rounded border border-slate-800/60">
                            {alert.rawNotification}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="py-12 text-center text-slate-400 text-sm">
                      <ShieldCheck className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                      All clean! No suspicious notifications or phishing alerts.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Category Breakdown Progress Bar Section */}
            {stats && Object.keys(stats.categoryBreakdown).length > 0 && (
              <div className="glass-panel rounded-2xl p-6 border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-400" />
                      <span>Expenditure Distribution by Category</span>
                    </h3>
                    <p className="text-xs text-slate-400">Live breakdown of tracked spending on your account</p>
                  </div>
                  <span className="font-mono text-xs text-slate-300">
                    Total: ${stats.totalSpent.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(stats.categoryBreakdown).map(([cat, amount]) => {
                    const pct = stats.totalSpent > 0 ? (amount / stats.totalSpent) * 100 : 0;
                    return (
                      <div key={cat} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-200">{cat}</span>
                          <span className="font-mono font-bold text-white">${amount.toFixed(2)} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRANSACTIONS EXPLORER (BIG-SCREEN DATA TABLE) */}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            {/* Search, Filter & Sort Toolbar */}
            <div className="glass-panel rounded-2xl p-4 border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search input */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Search merchant, notification text, or category..."
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  {txSearch && (
                    <button
                      onClick={() => setTxSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
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
                        txTypeFilter === type
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
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
                <span>Sort by:</span>
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

            {/* Dense High-Resolution Data Table for Big Displays */}
            <div className="glass-panel rounded-2xl border-slate-800/80 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Merchant / Counterparty</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Source App</th>
                      <th className="py-3 px-4">Raw Notification Preview</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-normal">
                    {filteredTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-800/40 transition group cursor-pointer"
                        onClick={() => setInspectedItem({ type: "transaction", item: tx })}
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                            tx.type === "CREDIT"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : tx.type === "TRANSFER"
                              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}>
                            {tx.type === "CREDIT" && <ArrowDownLeft className="w-3 h-3" />}
                            {tx.type === "TRANSFER" && <ArrowLeftRight className="w-3 h-3" />}
                            {tx.type === "DEBIT" && <ArrowUpRight className="w-3 h-3" />}
                            <span>{tx.type}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                          {tx.merchant}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/80 font-medium text-[11px]">
                            {tx.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                          {tx.sourcePackage || "manual / unknown"}
                        </td>
                        <td className="py-3 px-4 max-w-md truncate text-slate-400 font-mono text-[11px]">
                          {tx.rawNotification}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                          {new Date(tx.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold text-sm">
                          <span className={tx.type === "CREDIT" ? "text-emerald-400" : "text-white"}>
                            {tx.type === "CREDIT" ? "+" : "-"}${tx.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setInspectedItem({ type: "transaction", item: tx })}
                              title="Inspect Full Payload"
                              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              title="Delete Record"
                              className="p-1.5 rounded hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No matching transactions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PHISHING & SCAM SHIELD */}
        {activeTab === "alerts" && (
          <div className="space-y-4">
            {/* Filter toolbar */}
            <div className="glass-panel rounded-2xl p-4 border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-xl p-1 text-xs">
                  {["ALL", "ACTIVE", "DISMISSED"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setAlertStatusFilter(status)}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        alertStatusFilter === status
                          ? "bg-rose-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <span className="text-xs text-slate-400 font-medium ml-4">Risk Severity:</span>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-xl p-1 text-xs">
                  {["ALL", "CRITICAL", "HIGH", "MEDIUM"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setAlertRiskFilter(r)}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        alertRiskFilter === r
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-400">
                Displaying <span className="text-white font-bold">{filteredAlerts.length}</span> threats
              </div>
            </div>

            {/* Alerts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredAlerts.map((alert) => {
                const cues = parseCues(alert.phishingCues);
                return (
                  <div
                    key={alert.id}
                    className={`glass-panel rounded-2xl p-5 border transition ${
                      alert.isDismissed
                        ? "border-slate-800 opacity-60 bg-slate-950/40"
                        : "border-rose-900/50 bg-rose-950/10 hover:border-rose-700/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getRiskBadge(alert.riskScore)}
                          <span className="text-[11px] font-mono text-slate-400">
                            {new Date(alert.timestamp).toLocaleString()}
                          </span>
                          {alert.sourcePackage && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                              {alert.sourcePackage}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-white">
                          {alert.reason}
                        </h3>

                        {/* Phishing cues tags */}
                        {cues.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {cues.map((cue, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 font-medium"
                              >
                                ⚠️ {cue}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Raw Notification in monospace quote */}
                        <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono text-xs text-slate-300 relative group">
                          <p className="break-all">{alert.rawNotification}</p>
                          <button
                            onClick={() => copyText(alert.rawNotification, alert.id)}
                            className="absolute top-2 right-2 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition"
                            title="Copy text"
                          >
                            {copiedId === alert.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex flex-col gap-2">
                        {!alert.isDismissed && (
                          <button
                            onClick={() => handleDismissAlert(alert.id)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 whitespace-nowrap transition"
                          >
                            Dismiss Threat
                          </button>
                        )}
                        <button
                          onClick={() => setInspectedItem({ type: "alert", item: alert })}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 whitespace-nowrap transition"
                        >
                          Inspect Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredAlerts.length === 0 && (
                <div className="col-span-2 py-16 text-center text-slate-400 glass-panel rounded-2xl">
                  <ShieldCheck className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                  <p className="text-sm font-medium text-white">No Suspicious Alerts in this filter</p>
                  <p className="text-xs text-slate-500 mt-1">AiNotif is continuously guarding your notifications.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ANALYTICS & INSIGHTS */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown Card */}
              <div className="glass-panel rounded-2xl p-6 border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">Expense Distribution</h3>
                    <p className="text-xs text-slate-400">Total spending by categorized financial bucket</p>
                  </div>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    ${stats ? stats.totalSpent.toFixed(2) : "0.00"}
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {stats && Object.entries(stats.categoryBreakdown).map(([cat, val]) => {
                    const pct = stats.totalSpent > 0 ? (val / stats.totalSpent) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-300">{cat}</span>
                          <span className="font-mono text-white font-semibold">${val.toFixed(2)} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Inflow vs Outflow Cash Comparison */}
              <div className="glass-panel rounded-2xl p-6 border-slate-800/80 space-y-4">
                <h3 className="text-base font-semibold text-white">Cash Flow Dynamics</h3>
                <p className="text-xs text-slate-400">Comparison of credits vs debits</p>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <span className="text-xs text-slate-400">Total Inflow</span>
                    <div className="text-2xl font-bold font-mono text-emerald-400">
                      ${stats ? stats.totalReceived.toFixed(2) : "0.00"}
                    </div>
                    <span className="text-[11px] text-slate-500">Credits / Salary deposits</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <span className="text-xs text-slate-400">Total Outflow</span>
                    <div className="text-2xl font-bold font-mono text-rose-400">
                      ${stats ? stats.totalSpent.toFixed(2) : "0.00"}
                    </div>
                    <span className="text-[11px] text-slate-500">Debits / Living expenses</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Net Flow</span>
                    <span className={`text-sm font-mono font-bold ${stats && stats.netFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {stats && stats.netFlow >= 0 ? "+" : ""}${stats ? stats.netFlow.toFixed(2) : "0.00"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: LIVE NOTIFICATION SIMULATOR & AI LAB */}
        {activeTab === "simulator" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (6 cols): Input Bench & Presets */}
              <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border-slate-800/80 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <span>Notification Injection Bench</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Simulate real Android push notifications and watch the AI classifier and OTP pre-filter run live.
                  </p>
                </div>

                {/* Realistic Presets */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300">Quick Test Presets:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSimTitle(preset.title);
                          setSimText(preset.text);
                          setSimPackage(preset.packageName);
                        }}
                        className="text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition group"
                      >
                        <div className="text-xs font-semibold text-white group-hover:text-indigo-300">
                          {preset.label}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {preset.category}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form Inputs */}
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Notification Title / Sender:</label>
                    <input
                      type="text"
                      value={simTitle}
                      onChange={(e) => setSimTitle(e.target.value)}
                      placeholder="e.g. Chase Mobile, SMS: +1 800..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Notification Message Body:</label>
                    <textarea
                      rows={4}
                      value={simText}
                      onChange={(e) => setSimText(e.target.value)}
                      placeholder="Enter raw notification text..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Source Package Name:</label>
                    <input
                      type="text"
                      value={simPackage}
                      onChange={(e) => setSimPackage(e.target.value)}
                      placeholder="e.g. com.chase.sig.android"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    onClick={handleRunSimulator}
                    disabled={simLoading || !simText}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {simLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Analyzing with AI & Checking Security...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Process Notification via Pipeline</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column (6 cols): Real-time AI Output Console */}
              <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border-slate-800/80 space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-cyan-400" />
                    <span>Real-Time AI & Security Output</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Structured classification result, extracted financial entities, and phishing risk scoring.
                  </p>
                </div>

                {simResult ? (
                  <div className="space-y-4 my-auto">
                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Classification:</span>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        simResult.analysis?.classification === "SCAM_PHISHING"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          : simResult.analysis?.classification === "TRANSACTION"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : simResult.analysis?.classification === "IGNORED_OTP"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "bg-slate-800 text-slate-300"
                      }`}>
                        {simResult.analysis?.classification || "UNKNOWN"}
                      </span>
                      {simResult.savedRecordId && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Saved ID: {simResult.savedRecordId.substring(0, 8)}...
                        </span>
                      )}
                    </div>

                    {/* Extracted Details Box */}
                    {simResult.analysis?.transaction && (
                      <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-2">
                        <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Extracted Financial Record</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-slate-400">Merchant:</span> <span className="font-semibold text-white">{simResult.analysis.transaction.merchant}</span></div>
                          <div><span className="text-slate-400">Amount:</span> <span className="font-mono font-bold text-white">${simResult.analysis.transaction.amount.toFixed(2)} {simResult.analysis.transaction.currency}</span></div>
                          <div><span className="text-slate-400">Category:</span> <span className="text-indigo-300">{simResult.analysis.transaction.category}</span></div>
                          <div><span className="text-slate-400">Type:</span> <span className="text-cyan-300">{simResult.analysis.transaction.type}</span></div>
                        </div>
                      </div>
                    )}

                    {simResult.analysis?.classification === "SCAM_PHISHING" && (
                      <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-2">
                        <div className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Threat Analysis (Risk: {simResult.analysis.riskScore}/100)</span>
                        </div>
                        <p className="text-xs text-slate-200">{simResult.analysis.scamReason}</p>
                        {simResult.analysis.scamIndicators?.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {simResult.analysis.scamIndicators.map((cue: string, i: number) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                                {cue}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {simResult.analysis?.droppedOtp && (
                      <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-2">
                        <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                          <Lock className="w-4 h-4" />
                          <span>Privacy Shield: One-Time Password Discarded</span>
                        </div>
                        <p className="text-xs text-slate-300">
                          The notification matched privacy regex for 2FA/OTP codes. It was discarded on-device and will never be forwarded or stored.
                        </p>
                      </div>
                    )}

                    {/* Monospace JSON Output */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-48">
                      <pre>{JSON.stringify(simResult, null, 2)}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center text-slate-500 text-xs my-auto">
                    <Sparkles className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    Select a preset or enter notification text and click "Process Notification" to inspect live response.
                  </div>
                )}

                <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-3 flex items-center justify-between">
                  <span>Engine: OpenRouter Free Models & Regex Pre-Filter</span>
                  <span>Database: Neon PostgreSQL</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Inspector Drawer / Modal for Any Selected Transaction or Alert */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${
                  inspectedItem.type === "transaction" ? "bg-indigo-500/10 text-indigo-400" : "bg-rose-500/10 text-rose-400"
                }`}>
                  {inspectedItem.type === "transaction" ? <CreditCard className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {inspectedItem.type === "transaction" ? "Transaction Inspector" : "Threat Alert Inspector"}
                  </h3>
                  <p className="text-xs text-slate-400">Record ID: {inspectedItem.item.id}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectedItem(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {inspectedItem.type === "transaction" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400">Amount</span>
                    <div className="text-lg font-bold font-mono text-white">
                      ${(inspectedItem.item as Transaction).amount.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400">Type</span>
                    <div className="text-sm font-semibold text-indigo-300">
                      {(inspectedItem.item as Transaction).type}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400">Category</span>
                    <div className="text-sm font-semibold text-cyan-300">
                      {(inspectedItem.item as Transaction).category}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400">Merchant</span>
                    <div className="text-sm font-semibold text-white truncate">
                      {(inspectedItem.item as Transaction).merchant}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Exact Raw Notification Captured from Phone:</label>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-slate-200 break-all select-all">
                    {inspectedItem.item.rawNotification}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Android App Package:</span>
                    <p className="font-mono text-slate-200 mt-0.5">{inspectedItem.item.sourcePackage || "None"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Event Timestamp:</span>
                    <p className="text-slate-200 mt-0.5">{new Date(inspectedItem.item.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {getRiskBadge((inspectedItem.item as SuspiciousAlert).riskScore)}
                  <span className="text-xs text-slate-400">Score: {(inspectedItem.item as SuspiciousAlert).riskScore} / 100</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Detection Reason:</label>
                  <p className="text-sm text-white font-medium">{(inspectedItem.item as SuspiciousAlert).reason}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Phishing Cues Identified:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {parseCues((inspectedItem.item as SuspiciousAlert).phishingCues).map((cue, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {cue}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Raw Phishing SMS / Push Body:</label>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-rose-200 break-all select-all">
                    {inspectedItem.item.rawNotification}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
              <button
                onClick={() => copyText(inspectedItem.item.rawNotification, "modal")}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition"
              >
                {copiedId === "modal" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Raw Text</span>
              </button>

              <button
                onClick={() => setInspectedItem(null)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
