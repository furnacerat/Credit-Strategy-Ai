'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  FileText,
  Filter,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';

type Analysis = {
  personal_info?: Record<string, any>;
  credit_summary?: {
    estimated_score_range?: string | null;
    total_accounts?: number | null;
    negative_accounts_count?: number | null;
    on_time_payment_ratio?: number | null;
    oldest_account_age?: string | null;
    score?: number | null;
  };
  utilization?: {
    total_credit_limit?: number | null;
    total_balance?: number | null;
    utilization_percentage?: number | null;
    per_account?:
      | Array<{
          creditor_name?: string | null;
          utilization_percentage?: number | null;
          balance?: number | null;
          credit_limit?: number | null;
        }>
      | null;
  };
  accounts?:
    | Array<{
        creditor_name?: string | null;
        bureau?: string | null;
        account_type?: string | null;
        status?: string | null;
        payment_status?: string | null;
        balance?: number | null;
        credit_limit?: number | null;
        high_balance?: number | null;
        past_due_amount?: number | null;
        late_payments?:
          | {
              '30'?: number | null;
              '60'?: number | null;
              '90'?: number | null;
              '120'?: number | null;
            }
          | null;
        derogatory_flag?: boolean | null;
        charge_off_flag?: boolean | null;
        collection_flag?: boolean | null;
        date_opened?: string | null;
        last_activity_date?: string | null;
      }>
    | null;
  negative_items?:
    | Array<{
        creditor_name?: string | null;
        type?: string | null;
        severity_score?: number | null;
        estimated_score_impact?: string | null;
        dispute_recommendation?: string | null;
      }>
    | null;
  priority_issues?:
    | Array<{
        reason?: string | null;
        impact_level?: 'HIGH' | 'MEDIUM' | 'LOW' | string | null;
        recommended_action?: string | null;
      }>
    | null;
  dispute_letters?:
    | Array<{
        creditor_name?: string | null;
        subject?: string | null;
        body?: string | null;
      }>
    | null;
};

const demoAnalysis: Analysis = {
  credit_summary: {
    score: 612,
    estimated_score_range: '590–640',
    total_accounts: 14,
    negative_accounts_count: 4,
    on_time_payment_ratio: 0.91,
    oldest_account_age: '7y 3m'
  },
  utilization: {
    total_credit_limit: 16500,
    total_balance: 7920,
    utilization_percentage: 48,
    per_account: [
      { creditor_name: 'Capital One', utilization_percentage: 78, balance: 1560, credit_limit: 2000 },
      { creditor_name: 'Discover', utilization_percentage: 52, balance: 1040, credit_limit: 2000 },
      { creditor_name: 'Chase', utilization_percentage: 31, balance: 930, credit_limit: 3000 }
    ]
  },
  negative_items: [
    {
      creditor_name: 'LVNV Funding',
      type: 'collection',
      severity_score: 9,
      estimated_score_impact: 'High',
      dispute_recommendation: 'Request validation + verify dates/balance; dispute if inaccurate.'
    },
    {
      creditor_name: 'Auto Lender X',
      type: 'late payment',
      severity_score: 6,
      estimated_score_impact: 'Medium',
      dispute_recommendation: 'Goodwill request if isolated; verify reporting dates.'
    }
  ],
  priority_issues: [
    {
      reason: 'Utilization is above 30% on multiple revolving accounts.',
      impact_level: 'HIGH',
      recommended_action: 'Target 9–29% utilization; pay down highest-util accounts first.'
    },
    {
      reason: 'One active collection reporting with high severity.',
      impact_level: 'HIGH',
      recommended_action: 'Start validation process; dispute inaccuracies; consider pay-for-delete if eligible.'
    },
    {
      reason: 'Late payment cluster in last 24 months.',
      impact_level: 'MEDIUM',
      recommended_action: 'Confirm dates; pursue goodwill letters for isolated lates.'
    }
  ],
  accounts: [
    {
      creditor_name: 'Capital One',
      bureau: 'EXPERIAN',
      account_type: 'Credit Card',
      status: 'Open',
      payment_status: 'Current',
      balance: 1560,
      credit_limit: 2000,
      derogatory_flag: false,
      charge_off_flag: false,
      collection_flag: false,
      date_opened: '2019-04-12',
      last_activity_date: '2026-02-18'
    },
    {
      creditor_name: 'LVNV Funding',
      bureau: 'TRANSUNION',
      account_type: 'Collection',
      status: 'Collection',
      payment_status: 'Past Due',
      balance: 812,
      credit_limit: null,
      past_due_amount: 812,
      derogatory_flag: true,
      charge_off_flag: false,
      collection_flag: true,
      date_opened: '2024-11-03',
      last_activity_date: '2026-01-22'
    }
  ],
  dispute_letters: [
    {
      creditor_name: 'LVNV Funding',
      subject: 'Request for Validation / Dispute of Inaccurate Reporting',
      body:
        'To whom it may concern,\n\nI am writing to dispute the accuracy of the account reported under your company. Please provide validation and documentation supporting the reported balance, dates, and ownership...\n\nSincerely,\n[Your Name]'
    }
  ]
};

function money(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function pct(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${Math.round(n)}%`;
}
function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}
function impactBadge(impact?: string | null) {
  const v = (impact || '').toUpperCase();
  if (v.includes('HIGH')) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  if (v.includes('MED')) return 'border-lime-400/30 bg-lime-400/10 text-lime-200';
  return 'border-white/15 bg-white/5 text-white/70';
}
function riskPill(flags: { derog?: boolean | null; coll?: boolean | null; co?: boolean | null }) {
  const anyBad = !!(flags.derog || flags.coll || flags.co);
  return anyBad
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
    : 'border-white/10 bg-white/5 text-white/70';
}

function Card({
  title,
  icon,
  right,
  children
}: {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background:repeating-linear-gradient(180deg,rgba(0,255,140,0.12)_0px,rgba(0,255,140,0.12)_1px,transparent_1px,transparent_5px)]" />
      <div className="relative p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
              {icon ?? <Sparkles className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-white">{title}</div>
              <div className="text-[11px] text-white/50">Credit Strategy AI • Matrix Console</div>
            </div>
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs text-white/60">{label}</div>
        <div className="text-white/60">{icon}</div>
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      {sub ? <div className="mt-1 text-xs text-white/50">{sub}</div> : null}
    </div>
  );
}

export default function CreditDashboardMatrix({
  analysis,
  onOpenDisputeCenter,
  onOpenAccounts,
  onExportLetters
}: {
  analysis?: Analysis | null;
  onOpenDisputeCenter?: () => void;
  onOpenAccounts?: () => void;
  onExportLetters?: () => void;
}) {
  const isDev = process.env.NODE_ENV === 'development';
  const data: Analysis = analysis ?? (isDev ? demoAnalysis : {});

  const score = data.credit_summary?.score ?? null;
  const util = data.utilization?.utilization_percentage ?? null;
  const negCount = data.credit_summary?.negative_accounts_count ?? data.negative_items?.length ?? 0;

  const onTime = data.credit_summary?.on_time_payment_ratio ?? null;
  const onTimePct = onTime === null || onTime === undefined ? null : Math.round(clamp01(onTime) * 100);

  const [query, setQuery] = useState('');
  const [onlyNegative, setOnlyNegative] = useState(false);

  const accounts = (data.accounts ?? []).filter((a) => {
    const q = query.trim().toLowerCase();
    const matches =
      !q ||
      (a.creditor_name ?? '').toLowerCase().includes(q) ||
      (a.account_type ?? '').toLowerCase().includes(q) ||
      (a.status ?? '').toLowerCase().includes(q);

    const isNeg = !!(a.derogatory_flag || a.charge_off_flag || a.collection_flag || (a.past_due_amount ?? 0) > 0);

    return matches && (!onlyNegative || isNeg);
  });

  const scoreSeries = useMemo(() => {
    const base = score ?? 610;
    return Array.from({ length: 10 }).map((_, i) => ({
      name: `W${i + 1}`,
      value: Math.max(300, Math.min(850, base - 25 + i * 3 + (i % 2 === 0 ? 4 : -2)))
    }));
  }, [score]);

  const utilParts = useMemo(() => {
    const u = util ?? 0;
    return [
      { name: 'Used', value: Math.max(0, Math.min(100, u)) },
      { name: 'Available', value: Math.max(0, 100 - Math.max(0, Math.min(100, u))) }
    ];
  }, [util]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[520px] w-[520px] rounded-full bg-emerald-400/[0.08] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 shadow-[0_0_30px_rgba(16,185,129,0.15)]" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Matrix Dashboard</h1>
                <div className="text-xs text-white/55">
                  Real-time report intelligence • UI hydrated from{' '}
                  <span className="text-emerald-200/90">analysis_json</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenDisputeCenter}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.12)] hover:bg-emerald-400/15"
            >
              <FileText className="h-4 w-4" />
              Dispute Center
              <ArrowUpRight className="h-4 w-4 opacity-70" />
            </button>
            <button
              onClick={onExportLetters}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              <BadgeCheck className="h-4 w-4" />
              Export Letters
            </button>
            <button
              onClick={onOpenAccounts}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              <Wallet className="h-4 w-4" />
              View Accounts
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="grid grid-cols-1 gap-3 md:grid-cols-4"
        >
          <Stat
            label="Credit Score"
            value={score === null ? '—' : `${score}`}
            sub={data.credit_summary?.estimated_score_range ?? 'Score range unavailable'}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <Stat
            label="Utilization"
            value={pct(util)}
            sub={`${money(data.utilization?.total_balance)} / ${money(data.utilization?.total_credit_limit)}`}
            icon={<Banknote className="h-4 w-4" />}
          />
          <Stat
            label="Negative Items"
            value={`${negCount ?? 0}`}
            sub="Charge-offs • Collections • Lates"
            icon={<ShieldAlert className="h-4 w-4" />}
          />
          <Stat
            label="On-time Rate"
            value={onTimePct === null ? '—' : `${onTimePct}%`}
            sub={`Oldest: ${data.credit_summary?.oldest_account_age ?? '—'}`}
            icon={<BadgeCheck className="h-4 w-4" />}
          />
        </motion.div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="lg:col-span-6"
          >
            <Card
              title="Score Momentum"
              icon={<TrendingUp className="h-5 w-5" />}
              right={<div className="text-xs text-white/55">Last 10 weeks (demo)</div>}
            >
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={scoreSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      stroke="rgba(255,255,255,0.22)"
                      tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.22)"
                      tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                      domain={[300, 850]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(0,0,0,0.85)',
                        border: '1px solid rgba(16,185,129,0.25)',
                        borderRadius: 12,
                        color: 'white'
                      }}
                      labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      strokeWidth={2}
                      stroke="rgba(16,185,129,0.9)"
                      fill="rgba(16,185,129,0.12)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                <span className="text-emerald-200/90">Tip:</span> Your UI should display “Fast Wins” when
                utilization &gt; 30% or when collections exist.
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="lg:col-span-3"
          >
            <Card title="Utilization Split" icon={<Banknote className="h-5 w-5" />}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={utilParts} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                      {utilParts.map((_, idx) => (
                        <Cell key={idx} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(0,0,0,0.85)',
                        border: '1px solid rgba(16,185,129,0.25)',
                        borderRadius: 12,
                        color: 'white'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-white/55">Used</div>
                  <div className="mt-1 text-base font-semibold text-white">{pct(util)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-white/55">Target</div>
                  <div className="mt-1 text-base font-semibold text-white">9–29%</div>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="lg:col-span-3"
          >
            <Card title="Priority Fixes" icon={<AlertTriangle className="h-5 w-5" />}>
              <div className="space-y-2">
                {(data.priority_issues ?? []).slice(0, 4).map((p, idx) => (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-white/90">Issue #{idx + 1}</div>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${impactBadge(p.impact_level ?? '')}`}>
                        {p.impact_level ?? '—'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-white/60">{p.reason ?? '—'}</div>
                    <div className="mt-2 text-xs text-emerald-200/90">
                      Action: <span className="text-white/70">{p.recommended_action ?? '—'}</span>
                    </div>
                  </div>
                ))}
                {(!data.priority_issues || data.priority_issues.length === 0) && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
                    No priority issues found (or analysis not yet hydrated).
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.14 }}
            className="lg:col-span-8"
          >
            <Card
              title="Accounts"
              icon={<Wallet className="h-5 w-5" />}
              right={
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search creditor, type, status..."
                      className="w-64 rounded-2xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-emerald-400/30"
                    />
                  </div>

                  <button
                    onClick={() => setOnlyNegative((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm ${
                      onlyNegative
                        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                        : 'border-white/10 bg-white/5 text-white/80'
                    }`}
                  >
                    <Filter className="h-4 w-4" />
                    Negative only
                  </button>
                </div>
              }
            >
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-12 bg-white/5 px-3 py-2 text-[11px] text-white/60">
                  <div className="col-span-4">Creditor</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Balance</div>
                  <div className="col-span-2 text-right">Limit</div>
                </div>

                <div className="max-h-[340px] overflow-auto">
                  {accounts.map((a, idx) => {
                    const isNeg = !!(
                      a.derogatory_flag || a.charge_off_flag || a.collection_flag || (a.past_due_amount ?? 0) > 0
                    );
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-12 items-center border-t border-white/10 px-3 py-3 text-sm hover:bg-white/5"
                      >
                        <div className="col-span-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] ${riskPill({
                                derog: a.derogatory_flag,
                                coll: a.collection_flag,
                                co: a.charge_off_flag
                              })}`}
                            >
                              {isNeg ? 'FLAGGED' : 'OK'}
                            </span>
                            <div className="font-semibold text-white">{a.creditor_name ?? 'Unknown Creditor'}</div>
                          </div>
                          <div className="mt-1 text-[11px] text-white/50">
                            {(a.bureau ?? '—').toUpperCase()} • Opened {a.date_opened ?? '—'} • Activity{' '}
                            {a.last_activity_date ?? '—'}
                          </div>
                        </div>
                        <div className="col-span-2 text-white/75">{a.account_type ?? '—'}</div>
                        <div className="col-span-2 text-white/75">{a.status ?? a.payment_status ?? '—'}</div>
                        <div className="col-span-2 text-right font-semibold text-white">{money(a.balance)}</div>
                        <div className="col-span-2 text-right text-white/75">{money(a.credit_limit)}</div>
                      </div>
                    );
                  })}

                  {accounts.length === 0 && (
                    <div className="p-6 text-sm text-white/60">
                      No accounts to show. If this happens after upload, your backend likely isn't storing or
                      returning <span className="text-emerald-200/90">analysis_json.accounts</span>.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.16 }}
            className="lg:col-span-4"
          >
            <Card title="Dispute Queue" icon={<FileText className="h-5 w-5" />}>
              <div className="space-y-2">
                {(data.dispute_letters ?? []).slice(0, 3).map((l, idx) => (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-white">{l.creditor_name ?? 'Unknown Creditor'}</div>
                        <div className="text-[11px] text-white/55">{l.subject ?? 'Dispute Letter'}</div>
                      </div>
                      <button
                        className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-400/15"
                        onClick={onOpenDisputeCenter}
                      >
                        Open
                      </button>
                    </div>
                    <div className="mt-2 line-clamp-4 whitespace-pre-line text-xs text-white/60">
                      {l.body ?? '—'}
                    </div>
                  </div>
                ))}

                {(!data.dispute_letters || data.dispute_letters.length === 0) && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
                    No letters generated yet.
                    <div className="mt-2 text-white/55">
                      Make sure your AI output includes{' '}
                      <span className="text-emerald-200/90">dispute_letters[]</span> and your UI reads it.
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-100">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4" />
                  <div>
                    <div className="font-semibold">Premium Feel Trigger</div>
                    <div className="text-emerald-100/80">
                      Show “1-click generate letters” + “Export PDF” right here.
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="mt-6 text-center text-xs text-white/40">
          Tip: If the dashboard looks perfect but shows no data after upload, your issue is almost always
          <span className="text-emerald-200/80"> (1) no structured JSON stored</span> or
          <span className="text-emerald-200/80"> (2) UI not hydrating from analysis_json keys</span>.
        </div>
      </div>
    </div>
  );
}
