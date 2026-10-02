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
  Building2,
  ShoppingBag,
  Coffee,
  HelpCircle,
  QrCode,
  Download,
} from "lucide-react";
import { useUser, useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import QRCode from "qrcode";
import { BillingTab } from "@/components/BillingTab";
import { UpgradeModal } from "@/components/UpgradeModal";
import { PlanType, PLAN_LIMITS, checkClerkIsPro } from "@/lib/billing";

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

function formatCurrency(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || currency + " ";
  return `${sym}${Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "alerts" | "analytics" | "simulator" | "billing">("overview");
  const { isLoaded: isClerkLoaded, isSignedIn, user } = useUser();
  const { getToken, has } = useAuth();
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Billing & Plan State
  const [userPlan, setUserPlanState] = useState<PlanType>("free");
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [upgradeReason, setUpgradeReason] = useState<string>("");

  // Dynamic userId derived from Clerk session or demo fallback
  const userId = useMemo(() => {
    if (isSignedIn && user?.id) return user.id;
    return "user_demo_dev";
  }, [isSignedIn, user]);

  const userEmail = useMemo(() => {
    if (isSignedIn && user?.primaryEmailAddress?.emailAddress) {
      return user.primaryEmailAddress.emailAddress;
    }
    return "demo@ainotif.local";
  }, [isSignedIn, user]);

  useEffect(() => {
    async function loadToken() {
      if (isSignedIn) {
        try {
          const t = await getToken();
          setAuthToken(t);
        } catch (e) {
          console.warn("Could not retrieve Clerk JWT:", e);
        }
      } else {
        setAuthToken(null);
      }
    }
    loadToken();
  }, [isSignedIn, getToken]);

  // Mobile pairing modal state
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (showLinkModal) {
      const callbackLink = `notifai://oauth/callback?token=${encodeURIComponent(authToken || "mock_clerk_token")}&userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(userEmail)}`;
      QRCode.toDataURL(callbackLink, {
        width: 280,
        margin: 1.5,
        color: { dark: "#163300", light: "#ffffff" },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error("QR Code generation error:", err));
    }
  }, [showLinkModal, authToken, userId, userEmail]);

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
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const [txRes, alertsRes, billingRes] = await Promise.all([
        fetch(`/api/transactions?userId=${userId}`, { headers }),
        fetch(`/api/alerts?userId=${userId}`, { headers }),
        fetch(`/api/billing/status?userId=${userId}`, { headers }),
      ]);

      if (txRes.ok) {
        const data = await txRes.json();
        setTransactions(data.transactions || []);
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
      if (billingRes.ok) {
        const bData = await billingRes.json();
        const clerkPro = checkClerkIsPro(has, user?.publicMetadata);
        setUserPlanState(clerkPro ? "pro" : bData.plan || "free");
        setNotificationCount(bData.usage?.notificationsUsed || 0);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId, authToken]);

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
      avgRiskScore:
        alerts.length > 0
          ? Math.round(alerts.reduce((acc, a) => acc + a.riskScore, 0) / alerts.length)
          : 0,
    };
  }, [transactions, alerts, baseCurrency]);

  const getAuthHeaders = () => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) {
      h["Authorization"] = `Bearer ${authToken}`;
    }
    return h;
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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

  const handleExportData = (format: "csv" | "json") => {
    if (userPlan !== "pro") {
      setUpgradeReason("Exporting financial transaction data is a Pro feature. Upgrade to Pro Guardian ($10/month) for unlimited CSV and JSON exports.");
      setShowUpgradeModal(true);
      return;
    }

    if (transactions.length === 0) {
      alert("No transactions available to export.");
      return;
    }

    if (format === "csv") {
      const headers = ["ID", "Date", "Merchant", "Category", "Amount", "Currency", "Type", "Raw Notification"];
      const rows = transactions.map((t) => [
        t.id,
        new Date(t.timestamp).toISOString(),
        `"${(t.merchant || "").replace(/"/g, '""')}"`,
        `"${(t.category || "").replace(/"/g, '""')}"`,
        t.amount,
        t.currency,
        t.type,
        `"${(t.rawNotification || "").replace(/"/g, '""')}"`,
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `ainotif-ledger-${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions, null, 2));
      const link = document.createElement("a");
      link.setAttribute("href", dataStr);
      link.setAttribute("download", `ainotif-ledger-${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleBulkDelete = async () => {
    if (userPlan !== "pro") {
      setUpgradeReason("Bulk operations (mass deletion and cleanup) require the Pro Guardian plan ($10/month).");
      setShowUpgradeModal(true);
      return;
    }
    if (selectedTxIds.size === 0) return;
    if (!confirm(`Delete ${selectedTxIds.size} selected transaction(s)?`)) return;
    try {
      const ids = Array.from(selectedTxIds).join(",");
      const res = await fetch(`/api/transactions?ids=${ids}&userId=${userId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
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
    if (userPlan !== "pro") {
      setUpgradeReason("Bulk category assignment is a Pro feature. Upgrade to Pro Guardian ($10/month) to organize transactions at scale.");
      setShowUpgradeModal(true);
      return;
    }
    if (selectedTxIds.size === 0) return;
    try {
      const ids = Array.from(selectedTxIds);
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
    if (userPlan !== "pro" && notificationCount >= 20) {
      setUpgradeReason("You have reached the monthly limit of 20 notifications on the Free Plan. Upgrade to Pro Guardian ($10/month) for unlimited AI simulations.");
      setShowUpgradeModal(true);
      return;
    }

    setSimLoading(true);
    setSimResult(null);
    try {
      const res = await fetch("/api/process-notification", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: simTitle,
          text: simText,
          packageName: simPackage,
          userId,
          timestamp: Date.now(),
        }),
      });
      const data = await res.json();
      if (res.status === 403 && data.error === "PLAN_LIMIT_REACHED") {
        setUpgradeReason(data.message || "Monthly limit of 20 notifications reached on Free plan.");
        setShowUpgradeModal(true);
      }
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
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#cb272f]/10 text-[#cb272f] border border-[#cb272f]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#cb272f] animate-pulse" />
          Critical ({score}%)
        </span>
      );
    } else if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#e8ebe6] text-[#163300] border border-[#868685]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Moderate ({score}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#e2f6d5] text-[#054d28] border border-[#9fe870]/40">
        <span className="w-1.5 h-1.5 rounded-full bg-[#054d28]" />
        Low Risk ({score}%)
      </span>
    );
  };

  const getMerchantIcon = (merchant: string, category: string) => {
    const m = merchant.toLowerCase();
    const c = category.toLowerCase();
    if (m.includes("starbucks") || m.includes("coffee")) return <Coffee className="w-4 h-4 text-[#163300]" />;
    if (m.includes("trader") || m.includes("market") || m.includes("grocer") || c.includes("food"))
      return <ShoppingBag className="w-4 h-4 text-[#163300]" />;
    if (m.includes("bank") || m.includes("chase") || m.includes("citi") || m.includes("deposit") || c.includes("salary"))
      return <Building2 className="w-4 h-4 text-[#163300]" />;
    return <CreditCard className="w-4 h-4 text-[#163300]" />;
  };

  return (
    <div className="min-h-screen bg-[#f7f9f6] text-[#454745] font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e8ebe6] px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-[#163300] flex items-center justify-center text-[#9fe870] shadow-sm group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5 text-[#9fe870]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-tighter text-[#163300]">
                    Notif<span className="text-[#054d28]">Ai</span>
                  </span>
                  <span className="bg-[#e2f6d5] text-[#163300] text-[11px] font-bold px-2 py-0.5 rounded-full border border-[#9fe870]/50 uppercase tracking-wider">
                    Console
                  </span>
                </div>
                <p className="text-[11px] text-[#868685] font-medium hidden sm:block">
                  Intelligent Financial & Threat Interceptor
                </p>
              </div>
            </a>

            {/* Pill Navigation Segments */}
            <nav className="hidden md:flex items-center bg-[#e8ebe6] p-1 rounded-full">
              {[
                { id: "overview", label: "Overview" },
                { id: "transactions", label: "Transactions" },
                { id: "alerts", label: "Scam Radar", badge: normalizedStats.activeAlerts },
                { id: "analytics", label: "Insights" },
                { id: "simulator", label: "Simulator" },
                { id: "billing", label: "Plans & Billing", badge: userPlan === "pro" ? "PRO" : undefined },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[#163300] text-white shadow-sm"
                        : "text-[#454745] hover:text-[#163300] hover:bg-white/50"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {Boolean(tab.badge && (typeof tab.badge === "number" ? tab.badge > 0 : true)) && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        tab.badge === "PRO"
                          ? "bg-[#9fe870] text-[#163300]"
                          : isActive ? "bg-[#9fe870] text-[#163300]" : "bg-[#cb272f] text-white"
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-3">
            {/* Live SSE Stream Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e8ebe6] text-xs font-semibold text-[#163300]">
              <span className={`w-2.5 h-2.5 rounded-full ${isLiveStreamActive ? "bg-[#9fe870] ring-4 ring-[#9fe870]/30 animate-pulse" : "bg-[#868685]"}`} />
              <span>{isLiveStreamActive ? "Live Guard Active" : "Syncing Feed"}</span>
            </div>

            {/* Base Currency Pill Selector */}
            <div className="flex items-center bg-white border border-[#e8ebe6] rounded-full px-3 py-1 text-xs font-bold text-[#163300]">
              <span className="text-[#868685] mr-1.5 font-medium">Base:</span>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="bg-transparent font-bold focus:outline-none cursor-pointer pr-1"
              >
                {Object.keys(RATES_TO_USD).map((cur) => (
                  <option key={cur} value={cur}>
                    {cur} ({CURRENCY_SYMBOLS[cur] || ""})
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchData}
              title="Refresh Feed"
              className="w-9 h-9 rounded-full bg-white border border-[#e8ebe6] flex items-center justify-center text-[#163300] hover:bg-[#e8ebe6] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* Sync Mobile Device Button */}
            <button
              onClick={() => setShowLinkModal(true)}
              className="flex items-center gap-1.5 bg-[#163300] hover:bg-[#204505] text-[#9fe870] border border-[#9fe870]/30 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Sync with Android App"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sync Mobile</span>
            </button>

            {/* Current Plan Indicator & Upgrade Button */}
            {userPlan === "pro" ? (
              <button
                onClick={() => setActiveTab("billing")}
                className="flex items-center gap-1.5 bg-[#163300] hover:bg-[#204505] text-[#9fe870] border border-[#9fe870]/40 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
                title="Pro Guardian active ($10/mo)"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#9fe870]" />
                <span className="hidden sm:inline">Pro Active</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setUpgradeReason("Upgrade to Pro Guardian ($10/month) for unlimited AI notifications, unlimited history, and CSV exports.");
                  setShowUpgradeModal(true);
                }}
                className="flex items-center gap-1.5 bg-[#9fe870] hover:bg-[#8ed662] text-[#163300] rounded-full px-3.5 py-1.5 text-xs font-black shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Upgrade to Pro Plan ($10/mo)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrade ($10)</span>
              </button>
            )}

            {/* User Profile / Clerk Auth */}
            {isClerkLoaded && (
              isSignedIn ? (
                <div className="flex items-center gap-2 bg-[#e2f6d5] border border-[#9fe870]/50 rounded-full pl-3 pr-1 py-1 text-xs font-bold text-[#163300]">
                  <span className="truncate max-w-[120px] hidden md:inline">{userEmail}</span>
                  <UserButton />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <SignInButton mode="modal">
                    <button className="bg-[#9fe870] hover:bg-[#8ed662] text-[#163300] font-bold rounded-full px-3.5 py-1.5 text-xs shadow-sm transition-all active:scale-95 cursor-pointer">
                      Sign In
                    </button>
                  </SignInButton>
                </div>
              )
            )}
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden items-center justify-between overflow-x-auto gap-1 mt-2.5 pt-2 border-t border-[#e8ebe6] scrollbar-none">
          {[
            { id: "overview", label: "Overview" },
            { id: "transactions", label: "Ledger" },
            { id: "alerts", label: "Scam Radar", badge: normalizedStats.activeAlerts },
            { id: "analytics", label: "Insights" },
            { id: "simulator", label: "Simulator" },
            { id: "billing", label: "Billing", badge: userPlan === "pro" ? "PRO" : undefined },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  isActive ? "bg-[#163300] text-white" : "text-[#454745] hover:bg-[#e8ebe6]"
                }`}
              >
                <span>{tab.label}</span>
                {Boolean(tab.badge && (typeof tab.badge === "number" ? tab.badge > 0 : true)) && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    tab.badge === "PRO" ? "bg-[#9fe870] text-[#163300] font-black" : "bg-[#cb272f] text-white"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* Clerk Sign-in Notice Banner (when not signed in) */}
        {!isSignedIn && isClerkLoaded && (
          <div className="mb-8 bg-gradient-to-r from-[#163300] to-[#204505] text-white p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl border border-[#9fe870]/20 animate-fadeIn">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#9fe870]/20 flex items-center justify-center text-[#9fe870] shrink-0 border border-[#9fe870]/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-white">
                    Clerk Cloud Sync Active
                  </h4>
                  <span className="bg-[#9fe870]/20 text-[#9fe870] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#9fe870]/30 uppercase">
                    Previewing Demo
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-0.5 max-w-xl">
                  Sign in with your Clerk account to link your Android phone, auto-synchronize live banking SMS notifications, and track financial scams across devices.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SignInButton mode="modal">
                <button className="bg-[#9fe870] hover:bg-[#8ed662] text-[#163300] font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer">
                  Sign In with Clerk
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs py-2.5 px-4 rounded-xl border border-white/20 transition-all cursor-pointer">
                  Create Account
                </button>
              </SignUpButton>
            </div>
          </div>
        )}

        {/* ======================= OVERVIEW TAB ======================= */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Hero Balance Card */}
            <div className="an-hero-dark p-6 sm:p-10 relative overflow-hidden shadow-float">
              {/* Background ambient pattern */}
              <div className="absolute -right-12 -bottom-12 w-80 h-80 rounded-full bg-[#9fe870]/10 blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold mb-4 backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-[#9fe870]" />
                  <span>Verified Financial Stream • {baseCurrency}</span>
                </div>

                <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-1">
                  Total Outflow Tracked
                </p>
                <h1 className="text-4xl sm:text-6xl font-black text-[#9fe870] tracking-tight mb-4">
                  {formatCurrency(normalizedStats.totalSpent, baseCurrency)}
                </h1>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/15">
                  <div>
                    <span className="text-white/60 text-xs font-medium block">Total Inflow</span>
                    <span className="text-lg sm:text-xl font-bold text-white flex items-center gap-1 mt-0.5">
                      <ArrowDownLeft className="w-4 h-4 text-[#9fe870]" />
                      {formatCurrency(normalizedStats.totalReceived, baseCurrency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/60 text-xs font-medium block">Net Cash Flow</span>
                    <span className={`text-lg sm:text-xl font-bold flex items-center gap-1 mt-0.5 ${
                      normalizedStats.netFlow >= 0 ? "text-[#9fe870]" : "text-[#cb272f]"
                    }`}>
                      {normalizedStats.netFlow >= 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-[#9fe870]" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 text-[#cb272f]" />
                      )}
                      {formatCurrency(normalizedStats.netFlow, baseCurrency)}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-white/60 text-xs font-medium block">Intercepted Alerts</span>
                    <span className="text-lg sm:text-xl font-bold text-white flex items-center gap-1 mt-0.5">
                      <ShieldAlert className="w-4 h-4 text-[#cb272f]" />
                      {normalizedStats.activeAlerts} Active Threats
                    </span>
                  </div>
                </div>

                {/* Pill Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 mt-8">
                  <button
                    onClick={() => setActiveTab("simulator")}
                    className="an-btn-primary gap-2 shadow-sm text-sm"
                  >
                    <Play className="w-4 h-4 fill-[#163300]" />
                    <span>Simulate Notification</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("transactions")}
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-5 py-2 rounded-full transition-all inline-flex items-center gap-2 backdrop-blur-sm"
                  >
                    <span>View Full Ledger</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab("alerts")}
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-5 py-2 rounded-full transition-all inline-flex items-center gap-2 backdrop-blur-sm"
                  >
                    <Shield className="w-4 h-4 text-[#9fe870]" />
                    <span>Security Radar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Phishing Interception Card */}
              <div className="an-card p-6 bg-gradient-to-br from-[#ffffff] to-[#f4f7f2]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#868685]">
                    Threat Radar
                  </span>
                  <span className="p-2 rounded-full bg-[#cb272f]/10 text-[#cb272f]">
                    <ShieldAlert className="w-5 h-5" />
                  </span>
                </div>
                <div className="text-3xl font-black text-[#163300] mb-1">
                  {normalizedStats.activeAlerts} Active
                </div>
                <p className="text-xs text-[#868685] mb-4">
                  {alerts.length} total scam notifications analyzed & quarantined
                </p>
                <div className="bg-white border border-[#e8ebe6] rounded-xl p-3 flex items-center justify-between text-xs font-bold">
                  <span className="text-[#454745]">Mean Threat Risk</span>
                  <span className="text-[#cb272f]">{normalizedStats.avgRiskScore}/100</span>
                </div>
              </div>

              {/* Transactions Recorded */}
              <div className="an-card p-6 bg-gradient-to-br from-[#ffffff] to-[#f4f7f2]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#868685]">
                    Activity Volume
                  </span>
                  <span className="p-2 rounded-full bg-[#e2f6d5] text-[#163300]">
                    <CreditCard className="w-5 h-5" />
                  </span>
                </div>
                <div className="text-3xl font-black text-[#163300] mb-1">
                  {normalizedStats.totalTransactions} Records
                </div>
                <p className="text-xs text-[#868685] mb-4">
                  Multi-currency parsed from SMS & banking notifications
                </p>
                <div className="bg-white border border-[#e8ebe6] rounded-xl p-3 flex items-center justify-between text-xs font-bold">
                  <span className="text-[#454745]">Active Categories</span>
                  <span className="text-[#163300]">{Object.keys(normalizedStats.categoryBreakdown).length} labels</span>
                </div>
              </div>

              {/* Privacy Guardian Status */}
              <div className="an-card p-6 bg-gradient-to-br from-[#ffffff] to-[#eaf5e4]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#054d28]">
                    Zero-Knowledge Shield
                  </span>
                  <span className="p-2 rounded-full bg-[#9fe870]/40 text-[#163300]">
                    <Lock className="w-5 h-5" />
                  </span>
                </div>
                <div className="text-3xl font-black text-[#163300] mb-1">
                  100% On-Device
                </div>
                <p className="text-xs text-[#054d28] mb-4">
                  Local regex pre-filter drops OTPs & passwords before cloud sync
                </p>
                <div className="bg-white border border-[#e8ebe6] rounded-xl p-3 flex items-center justify-between text-xs font-bold">
                  <span className="text-[#454745]">Credentials Dropped</span>
                  <span className="text-[#054d28]">Zero Transmitted</span>
                </div>
              </div>
            </div>

            {/* Recent Transactions & Alerts Side-by-Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Activity */}
              <div className="an-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-black text-[#163300]">Recent Spending</h3>
                    <p className="text-xs text-[#868685]">Live notification feed</p>
                  </div>
                  <button
                    onClick={() => setActiveTab("transactions")}
                    className="an-btn-secondary text-xs py-1.5 px-3.5"
                  >
                    View All
                  </button>
                </div>

                <div className="divide-y divide-[#e8ebe6]">
                  {transactions.slice(0, 5).map((t) => {
                    const isNew = newlyAddedIds.has(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          setInspectedItem({ type: "transaction", item: t });
                          setEditMerchant(t.merchant);
                          setEditCategory(t.category);
                          setEditAmount(t.amount.toString());
                        }}
                        className={`py-3.5 flex items-center justify-between group cursor-pointer hover:bg-[#f7f9f6] px-2 rounded-xl transition-all ${
                          isNew ? "bg-[#e2f6d5]/40 animate-pulse" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-full bg-[#e8ebe6] group-hover:bg-[#e2f6d5] flex items-center justify-center transition-colors">
                            {getMerchantIcon(t.merchant, t.category)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#163300] group-hover:underline">
                              {t.merchant}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#e8ebe6] text-[#454745]">
                                {t.category}
                              </span>
                              <span className="text-[11px] text-[#868685]">
                                {new Date(t.timestamp).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`text-sm font-black ${
                            t.type === "CREDIT" ? "text-[#054d28]" : "text-[#163300]"
                          }`}>
                            {t.type === "CREDIT" ? "+" : "-"}{CURRENCY_SYMBOLS[t.currency] || ""}{t.amount.toFixed(2)}
                          </div>
                          <span className="text-[10px] font-semibold text-[#868685] uppercase">
                            {t.currency}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {transactions.length === 0 && (
                    <div className="text-center py-8 text-xs text-[#868685]">
                      No transactions recorded yet. Run a simulator preset to get started!
                    </div>
                  )}
                </div>
              </div>

              {/* Threat Interceptor Feed */}
              <div className="an-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-black text-[#163300]">Threat Quarantine</h3>
                    <p className="text-xs text-[#868685]">Phishing cues & scam detection</p>
                  </div>
                  <button
                    onClick={() => setActiveTab("alerts")}
                    className="an-btn-secondary text-xs py-1.5 px-3.5"
                  >
                    View Radar
                  </button>
                </div>

                <div className="space-y-3">
                  {alerts.slice(0, 4).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border transition-all ${
                        alert.isDismissed
                          ? "bg-[#f7f9f6] border-[#e8ebe6] opacity-60"
                          : "bg-white border-[#cb272f]/30 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getRiskBadge(alert.riskScore)}
                          {alert.isDismissed && (
                            <span className="text-[11px] font-bold text-[#868685]">
                              Dismissed
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#868685]">
                          {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-[#163300] mb-2">
                        {alert.reason}
                      </p>

                      <p className="text-[11px] text-[#454745] font-mono bg-[#f7f9f6] p-2 rounded-lg border border-[#e8ebe6] truncate">
                        "{alert.rawNotification}"
                      </p>

                      {!alert.isDismissed && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => handleDismissAlert(alert.id)}
                            className="text-[11px] font-bold text-[#163300] hover:text-[#cb272f] underline"
                          >
                            Dismiss Threat
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="text-center py-8 text-xs text-[#868685]">
                      <ShieldCheck className="w-8 h-8 text-[#054d28] mx-auto mb-2" />
                      No threats detected. Radar is all clear!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TRANSACTIONS TAB ======================= */}
        {activeTab === "transactions" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Filter and Search Bar */}
            <div className="an-card p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#868685] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Search merchant, notification content, or category..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#d4d8cf] focus:border-[#163300] focus:ring-1 focus:ring-[#163300] text-sm bg-white text-[#163300] placeholder-[#868685] outline-none"
                  />
                  {txSearch && (
                    <button
                      onClick={() => setTxSearch("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#868685] hover:text-[#163300]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Sort & Quick Filter Selectors */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={txSort}
                    onChange={(e) => setTxSort(e.target.value)}
                    className="px-3.5 py-2 rounded-full border border-[#d4d8cf] text-xs font-bold text-[#163300] bg-white outline-none cursor-pointer"
                  >
                    <option value="date_desc">Newest First</option>
                    <option value="date_asc">Oldest First</option>
                    <option value="amount_desc">Highest Amount</option>
                    <option value="amount_asc">Lowest Amount</option>
                  </select>

                  <button
                    onClick={() => {
                      setTxTypeFilter("ALL");
                      setTxCategoryFilter("ALL");
                      setTxSearch("");
                    }}
                    className="an-btn-secondary text-xs py-2 px-4"
                  >
                    Reset Filters
                  </button>

                  <button
                    onClick={() => handleExportData("csv")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#d4d8cf] text-xs font-bold text-[#163300] bg-white hover:bg-[#f7f9f6] transition-colors cursor-pointer"
                    title={userPlan === "pro" ? "Export transactions as CSV" : "Export CSV (Pro Feature)"}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                    {userPlan !== "pro" && (
                      <span className="bg-[#163300] text-[#9fe870] text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        PRO
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleExportData("json")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#d4d8cf] text-xs font-bold text-[#163300] bg-white hover:bg-[#f7f9f6] transition-colors cursor-pointer"
                    title={userPlan === "pro" ? "Export transactions as JSON" : "Export JSON (Pro Feature)"}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON</span>
                    {userPlan !== "pro" && (
                      <span className="bg-[#163300] text-[#9fe870] text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        PRO
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Pill Filter Chips Row */}
              <div className="flex items-center gap-2 overflow-x-auto pt-4 mt-4 border-t border-[#e8ebe6] scrollbar-none">
                <span className="text-xs font-bold text-[#868685] mr-1">Type:</span>
                {[
                  { id: "ALL", label: "All Types" },
                  { id: "DEBIT", label: "Debit / Outflow" },
                  { id: "CREDIT", label: "Credit / Inflow" },
                  { id: "TRANSFER", label: "Transfer" },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setTxTypeFilter(type.id)}
                    className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                      txTypeFilter === type.id
                        ? "bg-[#163300] text-white"
                        : "bg-[#e8ebe6] text-[#454745] hover:bg-[#d4d8cf]"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}

                <span className="text-xs font-bold text-[#868685] ml-4 mr-1">Category:</span>
                <button
                  onClick={() => setTxCategoryFilter("ALL")}
                  className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    txCategoryFilter === "ALL"
                      ? "bg-[#9fe870] text-[#163300] font-black"
                      : "bg-[#e8ebe6] text-[#454745] hover:bg-[#d4d8cf]"
                  }`}
                >
                  All
                </button>
                {uniqueCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setTxCategoryFilter(cat)}
                    className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                      txCategoryFilter === cat
                        ? "bg-[#9fe870] text-[#163300] font-black"
                        : "bg-[#e8ebe6] text-[#454745] hover:bg-[#d4d8cf]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Free Plan Transactions Limit Warning */}
            {userPlan === "free" && (
              <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-bold text-[#163300]">Free Tier View Limit:</span>
                  <span className="text-[#868685]">
                    Displaying recent 15 transactions. Upgrade to Pro Guardian ($10/mo) for unlimited history and search across all time.
                  </span>
                </div>
                <button
                  onClick={() => {
                    setUpgradeReason("Upgrade to Pro Guardian ($10/month) for unlimited transaction records, full history search, and CSV/JSON export.");
                    setShowUpgradeModal(true);
                  }}
                  className="font-bold text-[#163300] hover:text-[#054d28] hover:underline shrink-0 cursor-pointer"
                >
                  Upgrade to Pro ($10/mo) →
                </button>
              </div>
            )}

            {/* Bulk Action Pill Bar (Shown when items selected) */}
            {selectedTxIds.size > 0 && (
              <div className="bg-[#163300] text-white p-4 rounded-2xl shadow-float flex flex-wrap items-center justify-between gap-4 animate-slideDown">
                <div className="flex items-center gap-3">
                  <span className="bg-[#9fe870] text-[#163300] text-xs font-black px-2.5 py-1 rounded-full">
                    {selectedTxIds.size} Selected
                  </span>
                  <span className="text-xs text-white/80">Perform bulk operations:</span>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30 outline-none cursor-pointer"
                  >
                    <option value="Groceries" className="text-black">Groceries</option>
                    <option value="Dining & Coffee" className="text-black">Dining & Coffee</option>
                    <option value="Salary & Income" className="text-black">Salary & Income</option>
                    <option value="Utilities" className="text-black">Utilities</option>
                    <option value="Shopping" className="text-black">Shopping</option>
                    <option value="Subscriptions" className="text-black">Subscriptions</option>
                  </select>
                  <button
                    onClick={() => handleBulkCategorize(bulkCategory)}
                    className="an-btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5"
                  >
                    <span>Set Category</span>
                    {userPlan !== "pro" && (
                      <span className="bg-[#163300] text-[#9fe870] text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        PRO
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="bg-[#cb272f] hover:bg-red-700 text-white font-bold text-xs px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                    {userPlan !== "pro" && (
                      <span className="bg-black/40 text-[#9fe870] text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        PRO
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedTxIds(new Set())}
                    className="text-white/60 hover:text-white text-xs underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* High Density Ledger Table */}
            <div className="an-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#f4f7f2] border-b border-[#e8ebe6] text-[11px] font-black uppercase tracking-wider text-[#868685]">
                      <th className="p-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredTransactions.length > 0 &&
                            selectedTxIds.size === filteredTransactions.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)));
                            } else {
                              setSelectedTxIds(new Set());
                            }
                          }}
                          className="rounded border-[#d4d8cf] text-[#163300] focus:ring-[#163300] cursor-pointer"
                        />
                      </th>
                      <th className="p-4">Merchant / Entity</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Origin App</th>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8ebe6]">
                    {filteredTransactions.map((tx) => {
                      const isSelected = selectedTxIds.has(tx.id);
                      const isNew = newlyAddedIds.has(tx.id);

                      return (
                        <tr
                          key={tx.id}
                          className={`hover:bg-[#f7f9f6] transition-colors ${
                            isSelected ? "bg-[#e2f6d5]/40" : ""
                          } ${isNew ? "bg-[#e2f6d5]/60 animate-pulse" : ""}`}
                        >
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedTxIds);
                                if (e.target.checked) next.add(tx.id);
                                else next.delete(tx.id);
                                setSelectedTxIds(next);
                              }}
                              className="rounded border-[#d4d8cf] text-[#163300] focus:ring-[#163300] cursor-pointer"
                            />
                          </td>

                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#e8ebe6] flex items-center justify-center shrink-0">
                                {getMerchantIcon(tx.merchant, tx.category)}
                              </div>
                              <div>
                                <span className="font-bold text-[#163300] block">
                                  {tx.merchant}
                                </span>
                                <span className="text-[11px] text-[#868685] font-mono truncate max-w-[240px] block">
                                  {tx.rawNotification}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="p-4">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#e8ebe6] text-[#163300] border border-[#d4d8cf]">
                              {tx.category}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-white border border-[#e8ebe6] text-[#454745]">
                              {tx.sourcePackage ? tx.sourcePackage.split(".").pop() : "system"}
                            </span>
                          </td>

                          <td className="p-4 text-xs text-[#868685]">
                            {new Date(tx.timestamp).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>

                          <td className="p-4 text-right">
                            <div className={`text-base font-black ${
                              tx.type === "CREDIT" ? "text-[#054d28]" : "text-[#163300]"
                            }`}>
                              {tx.type === "CREDIT" ? "+" : "-"}{CURRENCY_SYMBOLS[tx.currency] || ""}{tx.amount.toFixed(2)}
                            </div>
                            <span className="text-[10px] text-[#868685] font-bold uppercase">
                              {tx.currency}
                            </span>
                          </td>

                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setInspectedItem({ type: "transaction", item: tx });
                                  setEditMerchant(tx.merchant);
                                  setEditCategory(tx.category);
                                  setEditAmount(tx.amount.toString());
                                }}
                                title="Inspect & Edit"
                                className="p-1.5 rounded-full hover:bg-[#e8ebe6] text-[#163300] transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                title="Delete Record"
                                className="p-1.5 rounded-full hover:bg-[#cb272f]/10 text-[#cb272f] transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-sm text-[#868685]">
                          No transactions found matching the filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================= SCAM RADAR TAB ======================= */}
        {activeTab === "alerts" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Radar Banner */}
            <div className="an-card p-6 bg-gradient-to-r from-white via-[#fff5f5] to-white border-[#cb272f]/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#cb272f]/10 flex items-center justify-center text-[#cb272f]">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-[#163300]">
                      Phishing & Threat Quarantine Radar
                    </h2>
                    <p className="text-xs text-[#868685]">
                      Interception log with AI threat analysis, urgency detection, and URL inspection
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAlertStatusFilter("ALL")}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      alertStatusFilter === "ALL" ? "bg-[#163300] text-white" : "bg-[#e8ebe6] text-[#454745]"
                    }`}
                  >
                    All ({alerts.length})
                  </button>
                  <button
                    onClick={() => setAlertStatusFilter("ACTIVE")}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      alertStatusFilter === "ACTIVE" ? "bg-[#cb272f] text-white" : "bg-[#e8ebe6] text-[#454745]"
                    }`}
                  >
                    Active Only ({normalizedStats.activeAlerts})
                  </button>
                  <button
                    onClick={() => setAlertStatusFilter("DISMISSED")}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      alertStatusFilter === "DISMISSED" ? "bg-[#163300] text-white" : "bg-[#e8ebe6] text-[#454745]"
                    }`}
                  >
                    Dismissed
                  </button>
                </div>
              </div>
            </div>

            {/* Alerts List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredAlerts.map((alert) => {
                const cues = parseCues(alert.phishingCues);

                return (
                  <div
                    key={alert.id}
                    className={`an-card p-6 flex flex-col justify-between transition-all ${
                      alert.isDismissed
                        ? "opacity-60 bg-[#f7f9f6] border-[#e8ebe6]"
                        : "border-[#cb272f]/30 hover:border-[#cb272f] shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getRiskBadge(alert.riskScore)}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#e8ebe6] text-[#454745]">
                            {alert.sourcePackage ? alert.sourcePackage.split(".").pop() : "sms"}
                          </span>
                        </div>
                        <span className="text-xs text-[#868685]">
                          {new Date(alert.timestamp).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-[#163300] mb-2">
                        {alert.reason}
                      </h4>

                      <div className="bg-[#f4f7f2] p-3 rounded-xl border border-[#e8ebe6] mb-4">
                        <span className="text-[10px] uppercase font-bold text-[#868685] block mb-1">
                          Captured Notification
                        </span>
                        <p className="text-xs font-mono text-[#163300] break-words">
                          "{alert.rawNotification}"
                        </p>
                      </div>

                      {/* Phishing Cues */}
                      {cues.length > 0 && (
                        <div className="mb-4">
                          <span className="text-[10px] uppercase font-bold text-[#868685] block mb-1.5">
                            Identified Threat Cues
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {cues.map((cue, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#cb272f]/10 text-[#cb272f] border border-[#cb272f]/20"
                              >
                                {cue}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-[#e8ebe6] flex items-center justify-between">
                      <button
                        onClick={() => copyText(alert.rawNotification, alert.id)}
                        className="text-xs font-bold text-[#454745] hover:text-[#163300] flex items-center gap-1.5"
                      >
                        {copiedId === alert.id ? <Check className="w-3.5 h-3.5 text-[#054d28]" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === alert.id ? "Copied" : "Copy Payload"}</span>
                      </button>

                      {!alert.isDismissed ? (
                        <button
                          onClick={() => handleDismissAlert(alert.id)}
                          className="an-btn-secondary text-xs py-1 px-3.5"
                        >
                          Dismiss Threat
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-[#868685]">Resolved</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredAlerts.length === 0 && (
                <div className="col-span-2 an-card p-12 text-center text-sm text-[#868685]">
                  <ShieldCheck className="w-10 h-10 text-[#054d28] mx-auto mb-2" />
                  No threats found matching current radar filters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================= ANALYTICS TAB ======================= */}
        {activeTab === "analytics" && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="an-card p-6">
                <span className="text-xs font-bold uppercase text-[#868685] block mb-1">
                  Total Flow Analysed
                </span>
                <div className="text-3xl font-black text-[#163300]">
                  {formatCurrency(normalizedStats.totalSpent + normalizedStats.totalReceived, baseCurrency)}
                </div>
                <p className="text-xs text-[#868685] mt-1">Aggregate combined volume in {baseCurrency}</p>
              </div>

              <div className="an-card p-6">
                <span className="text-xs font-bold uppercase text-[#868685] block mb-1">
                  Debit to Inflow Ratio
                </span>
                <div className="text-3xl font-black text-[#163300]">
                  {normalizedStats.totalReceived > 0
                    ? ((normalizedStats.totalSpent / normalizedStats.totalReceived) * 100).toFixed(1) + "%"
                    : "100%"}
                </div>
                <p className="text-xs text-[#868685] mt-1">Outflow as percentage of total received</p>
              </div>

              <div className="an-card p-6">
                <span className="text-xs font-bold uppercase text-[#868685] block mb-1">
                  Threat Ratio
                </span>
                <div className="text-3xl font-black text-[#cb272f]">
                  {normalizedStats.totalTransactions > 0
                    ? ((alerts.length / (normalizedStats.totalTransactions + alerts.length)) * 100).toFixed(1) + "%"
                    : "0%"}
                </div>
                <p className="text-xs text-[#868685] mt-1">Scam messages intercepted vs legit notifications</p>
              </div>
            </div>

            {/* Category Breakdown Progress Bars */}
            <div className="an-card p-8">
              <h3 className="text-xl font-black text-[#163300] mb-6">
                Expense Distribution by Category
              </h3>

              <div className="space-y-6">
                {Object.entries(normalizedStats.categoryBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount], idx) => {
                    const pct = normalizedStats.totalSpent > 0 ? (amount / normalizedStats.totalSpent) * 100 : 0;
                    const colors = ["#163300", "#9fe870", "#054d28", "#0b4c72", "#454745", "#6a6c6a"];
                    const barColor = colors[idx % colors.length];

                    return (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm font-bold">
                          <span className="text-[#163300]">{cat}</span>
                          <span className="text-[#454745]">
                            {formatCurrency(amount, baseCurrency)} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full h-3 rounded-full bg-[#e8ebe6] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: barColor }}
                          />
                        </div>
                      </div>
                    );
                  })}
                {Object.keys(normalizedStats.categoryBreakdown).length === 0 && (
                  <p className="text-center text-xs text-[#868685] py-8">
                    No expense data available to graph.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================= SIMULATOR TAB ======================= */}
        {activeTab === "simulator" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
            {/* Left Control Panel */}
            <div className="lg:col-span-6 space-y-6">
              <div className="an-card p-6">
                <h3 className="text-lg font-black text-[#163300] mb-1">
                  Interactive Notification Simulator
                </h3>
                <p className="text-xs text-[#868685] mb-4">
                  Select a live financial or phishing scenario, or craft custom payload to test AI extraction and local regex OTP drops.
                </p>

                {/* AI Quota Meter */}
                <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-2xl p-4 mb-5">
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-[#163300]">AI Analysis Quota</span>
                    <span className={userPlan === "pro" ? "text-[#054d28]" : notificationCount >= 20 ? "text-[#cb272f]" : "text-[#163300]"}>
                      {userPlan === "pro" ? "Unlimited (Pro Plan)" : `${notificationCount} / 20 used`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#e8ebe6] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        userPlan === "pro"
                          ? "bg-[#054d28] w-full"
                          : notificationCount >= 20
                          ? "bg-[#cb272f] w-full"
                          : "bg-[#9fe870]"
                      }`}
                      style={{ width: userPlan === "pro" ? "100%" : `${Math.min(100, (notificationCount / 20) * 100)}%` }}
                    />
                  </div>
                  {userPlan === "free" && notificationCount >= 20 && (
                    <div className="mt-2 text-[11px] text-[#cb272f] font-semibold flex items-center justify-between">
                      <span>Monthly free limit reached!</span>
                      <button
                        onClick={() => {
                          setUpgradeReason("You have reached the 20 notification limit. Upgrade to Pro ($10/mo) for unlimited AI tests.");
                          setShowUpgradeModal(true);
                        }}
                        className="underline hover:text-red-800 cursor-pointer"
                      >
                        Upgrade to Pro ($10/mo)
                      </button>
                    </div>
                  )}
                </div>

                {/* Presets Pills */}
                <div className="space-y-2 mb-6">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#868685] block">
                    Instant Test Presets
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSimTitle(preset.title);
                          setSimText(preset.text);
                          setSimPackage(preset.packageName);
                        }}
                        className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#f4f7f2] hover:bg-[#e2f6d5] border border-[#d4d8cf] text-[#163300] transition-colors text-left"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#163300] block mb-1">
                      Notification Title / Sender
                    </label>
                    <input
                      type="text"
                      value={simTitle}
                      onChange={(e) => setSimTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#d4d8cf] focus:border-[#163300] text-sm text-[#163300] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#163300] block mb-1">
                      Notification Content
                    </label>
                    <textarea
                      rows={3}
                      value={simText}
                      onChange={(e) => setSimText(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#d4d8cf] focus:border-[#163300] text-sm text-[#163300] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#163300] block mb-1">
                      Source Package Name
                    </label>
                    <input
                      type="text"
                      value={simPackage}
                      onChange={(e) => setSimPackage(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#d4d8cf] focus:border-[#163300] text-xs font-mono text-[#163300] outline-none"
                    />
                  </div>

                  <button
                    onClick={handleRunSimulator}
                    disabled={simLoading}
                    className="w-full an-btn-primary gap-2 py-3 shadow-md mt-4"
                  >
                    {simLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-[#163300]" />
                    ) : (
                      <Play className="w-4 h-4 fill-[#163300]" />
                    )}
                    <span>{simLoading ? "Evaluating AI Guardian..." : "Process Notification Event"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Live Preview / Result */}
            <div className="lg:col-span-6 space-y-6">
              {/* Phone Mock / Notification Preview */}
              <div className="an-card p-6">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#868685] block mb-3">
                  Mobile OS Notification Mock
                </span>
                <div className="bg-white rounded-2xl border-2 border-[#163300] p-4 shadow-sm flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#163300] text-[#9fe870] flex items-center justify-center font-black text-lg shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs text-[#868685] mb-0.5">
                      <span className="font-bold text-[#163300]">{simTitle}</span>
                      <span>Now</span>
                    </div>
                    <p className="text-xs text-[#454745] font-medium leading-relaxed break-words">
                      {simText}
                    </p>
                  </div>
                </div>
              </div>

              {/* Engine Response */}
              {simResult && (
                <div className="an-card p-6 animate-fadeIn">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-black text-[#163300]">
                      AI Guardian Outcome
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2f6d5] text-[#163300]">
                      Status: {simResult.outcome || (simResult.error ? "Error" : "Processed")}
                    </span>
                  </div>

                  <div className="bg-[#163300] text-white p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-80">
                    <pre>{JSON.stringify(simResult, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================= BILLING & PLANS TAB ======================= */}
        {activeTab === "billing" && (
          <BillingTab
            currentPlan={userPlan}
            notificationCount={notificationCount}
            onPlanChanged={(newPlan) => {
              setUserPlanState(newPlan);
              fetchData();
            }}
            userId={userId}
          />
        )}
      </main>

      {/* Slide-over Inspector Modal */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="an-card bg-white max-w-lg w-full p-6 shadow-float relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setInspectedItem(null)}
              className="absolute top-5 right-5 text-[#868685] hover:text-[#163300] p-1 rounded-full hover:bg-[#e8ebe6]"
            >
              <X className="w-5 h-5" />
            </button>

            {inspectedItem.type === "transaction" && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-[#163300] text-white">
                    Edit Record
                  </span>
                  <span className="text-xs text-[#868685] font-mono">
                    ID: {inspectedItem.item.id.slice(0, 8)}...
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#163300] block mb-1">
                      Merchant Name
                    </label>
                    <input
                      type="text"
                      value={editMerchant}
                      onChange={(e) => setEditMerchant(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#d4d8cf] text-sm text-[#163300] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#163300] block mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#d4d8cf] text-sm text-[#163300] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#163300] block mb-1">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#d4d8cf] text-sm text-[#163300] outline-none"
                      />
                    </div>
                  </div>

                  <div className="bg-[#f4f7f2] p-3 rounded-xl border border-[#e8ebe6]">
                    <span className="text-[10px] uppercase font-bold text-[#868685] block mb-1">
                      Original Notification Intercepted
                    </span>
                    <p className="text-xs font-mono text-[#163300] break-words">
                      "{(inspectedItem.item as Transaction).rawNotification}"
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e8ebe6]">
                    <button
                      onClick={() => setInspectedItem(null)}
                      className="an-btn-secondary text-xs py-2 px-4"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveInspectedTransaction}
                      disabled={isSavingEdit}
                      className="an-btn-primary text-xs py-2 px-5"
                    >
                      {isSavingEdit ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link Mobile Device Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#e8ebe6] relative">
            <button
              onClick={() => setShowLinkModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#f7f9f6] flex items-center justify-center text-[#454745] hover:bg-[#e8ebe6] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#163300] flex items-center justify-center text-[#9fe870] shadow-sm">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#163300] tracking-tight">Sync with Android App</h3>
                <p className="text-xs text-[#868685]">Scan with your mobile device or tap to link account</p>
              </div>
            </div>

            <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-2xl p-4 flex flex-col items-center mb-5">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Pairing QR Code" className="w-56 h-56 rounded-xl shadow-sm border border-white" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-[#868685]">
                  Generating QR code...
                </div>
              )}
              <p className="text-[11px] font-semibold text-[#868685] mt-3 text-center">
                Open Camera or NotifAi App on your Android device to scan & pair
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-xl p-3 text-xs">
                <div className="flex items-center justify-between text-[#868685] mb-1">
                  <span className="font-semibold">Clerk User ID:</span>
                  <button
                    onClick={() => copyText(userId, "modal-uid")}
                    className="text-[#163300] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === "modal-uid" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedId === "modal-uid" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="font-mono text-[#163300] text-[11px] break-all">{userId}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={`notifai://oauth/callback?token=${encodeURIComponent(authToken || "mock_clerk_token")}&userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(userEmail)}`}
                  className="flex-1 bg-[#163300] text-[#9fe870] font-bold py-2.5 px-4 rounded-xl text-center text-xs hover:bg-[#204505] transition-colors flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Launch NotifAi App</span>
                </a>
                <button
                  onClick={() => {
                    const url = `notifai://oauth/callback?token=${encodeURIComponent(authToken || "mock_clerk_token")}&userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(userEmail)}`;
                    copyText(url, "modal-link");
                  }}
                  className="bg-[#e8ebe6] text-[#163300] font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-[#d8dbd5] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedId === "modal-link" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === "modal-link" ? "Link Copied" : "Copy Deep Link"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Gating Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeReason}
        onNavigateToBilling={() => setActiveTab("billing")}
        onPlanChanged={(newPlan) => {
          setUserPlanState(newPlan);
          fetchData();
        }}
      />
    </div>
  );
}
