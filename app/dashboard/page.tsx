"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Receipt,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Demo data — will be replaced with Supabase queries
const DEMO_STATS = {
  total_income: 74444.84,
  total_expenses: 53277.07,
  net_profit: 21167.77,
  uncategorized_count: 12,
  total_transactions: 847,
  tax_savings_found: 4250,
  monthly_breakdown: [
    { month: "Jan", income: 5200, expenses: 3800, profit: 1400 },
    { month: "Feb", income: 6100, expenses: 4200, profit: 1900 },
    { month: "Mar", income: 6698, expenses: 6705, profit: -7 },
    { month: "Apr", income: 5800, expenses: 4100, profit: 1700 },
    { month: "May", income: 7200, expenses: 4900, profit: 2300 },
    { month: "Jun", income: 6400, expenses: 4300, profit: 2100 },
    { month: "Jul", income: 5900, expenses: 4600, profit: 1300 },
    { month: "Aug", income: 6800, expenses: 4400, profit: 2400 },
    { month: "Sep", income: 7100, expenses: 5200, profit: 1900 },
    { month: "Oct", income: 5600, expenses: 3900, profit: 1700 },
    { month: "Nov", income: 6200, expenses: 4100, profit: 2100 },
    { month: "Dec", income: 5444, expenses: 3077, profit: 2367 },
  ],
  top_expense_categories: [
    { category: "Software & Subscriptions", amount: 12840, percentage: 24.1 },
    { category: "Phone & Internet", amount: 6420, percentage: 12.1 },
    { category: "Interest & Bank Fees", amount: 5180, percentage: 9.7 },
    { category: "Business Meals", amount: 4920, percentage: 9.2 },
    { category: "Advertising", amount: 4200, percentage: 7.9 },
    { category: "Other", amount: 19717, percentage: 37.0 },
  ],
};

const COLORS = [
  "hsl(152 68% 46%)",
  "hsl(190 80% 50%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 55%)",
  "hsl(0 84% 60%)",
  "hsl(220 14% 30%)",
];

export default function DashboardPage() {
  const stats = DEMO_STATS;

  const statCards = [
    {
      label: "Gross Income",
      value: stats.total_income,
      icon: TrendingUp,
      trend: "+12.3%",
      trendUp: true,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "Total Expenses",
      value: stats.total_expenses,
      icon: TrendingDown,
      trend: "-3.1%",
      trendUp: false,
      color: "text-rose-400",
      bg: "bg-rose-400/10",
    },
    {
      label: "Net Profit",
      value: stats.net_profit,
      icon: DollarSign,
      trend: "+8.7%",
      trendUp: true,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Tax Savings Found",
      value: stats.tax_savings_found,
      icon: PiggyBank,
      trend: null,
      trendUp: true,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          2025 Tax Year — Ranking SB (CARPEFUKENDIEM, LLC)
        </p>
      </div>

      {/* Alerts */}
      {stats.uncategorized_count > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-200">
              {stats.uncategorized_count} transactions need categorization
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Review and categorize to maximize your deductions
            </p>
          </div>
          <a
            href="/transactions?filter=uncategorized"
            className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            Review →
          </a>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className={`p-5 rounded-xl border border-border bg-card/80 animate-fade-in stagger-${i + 1}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              {card.trend && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    card.trendUp ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {card.trendUp ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {card.trend}
                </span>
              )}
            </div>
            <p className="text-2xl font-semibold tracking-tight">
              {formatCurrency(card.value)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue & Expenses */}
        <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-card/80">
          <h3 className="text-sm font-medium mb-4">Monthly Income vs Expenses</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthly_breakdown} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 15%)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "hsl(215 15% 52%)", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(220 13% 15%)" }}
                />
                <YAxis
                  tick={{ fill: "hsl(215 15% 52%)", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(220 13% 15%)" }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220 18% 10%)",
                    border: "1px solid hsl(220 13% 20%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="income" fill="hsl(152 68% 46%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(0 84% 60% / 0.6)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="p-6 rounded-xl border border-border bg-card/80">
          <h3 className="text-sm font-medium mb-4">Expense Breakdown</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.top_expense_categories}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="amount"
                  stroke="none"
                >
                  {stats.top_expense_categories.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(220 18% 10%)",
                    border: "1px solid hsl(220 13% 20%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {stats.top_expense_categories.slice(0, 5).map((cat, i) => (
              <div key={cat.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: COLORS[i] }}
                  />
                  <span className="text-muted-foreground">{cat.category}</span>
                </div>
                <span className="font-medium">{cat.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card/50 text-center">
          <Receipt className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-xl font-semibold">{stats.total_transactions}</p>
          <p className="text-xs text-muted-foreground">Total Transactions</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/50 text-center">
          <AlertCircle className="w-5 h-5 text-amber-400 mx-auto mb-2" />
          <p className="text-xl font-semibold">{stats.uncategorized_count}</p>
          <p className="text-xs text-muted-foreground">Uncategorized</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/50 text-center">
          <p className="text-xl font-semibold mt-5">
            {formatCurrency(stats.net_profit * 0.153)}
          </p>
          <p className="text-xs text-muted-foreground">Est. SE Tax</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/50 text-center">
          <p className="text-xl font-semibold mt-5">7</p>
          <p className="text-xs text-muted-foreground">Statements Uploaded</p>
        </div>
      </div>
    </div>
  );
}
