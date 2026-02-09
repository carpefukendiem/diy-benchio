"use client";

import { useState } from "react";
import { Building2, CreditCard, Key, Bell, Save } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("business");

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your businesses, accounts, and preferences</p>
      </div>

      <div className="flex gap-2">
        {[
          { id: "business", label: "Businesses", icon: Building2 },
          { id: "accounts", label: "Accounts", icon: CreditCard },
          { id: "api", label: "API Keys", icon: Key },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "business" && (
        <div className="space-y-4">
          <div className="p-6 rounded-xl border border-border bg-card/80">
            <h3 className="text-sm font-semibold mb-4">Ranking SB</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Business Name</label>
                <input type="text" defaultValue="CARPEFUKENDIEM, LLC DBA Ranking SB" className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Business Type</label>
                <input type="text" defaultValue="Digital Marketing Agency" className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs" disabled />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Entity Type</label>
                <select className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/50">
                  <option>LLC</option>
                  <option>Sole Proprietorship</option>
                  <option>S-Corp</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">EIN</label>
                <input type="text" placeholder="XX-XXXXXXX" className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card/80">
            <h3 className="text-sm font-semibold mb-4">Hair Styling Business</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Business Name</label>
                <input type="text" defaultValue="Janice Nail-Ruiz Hair Styling" className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Business Type</label>
                <input type="text" defaultValue="Hair Stylist / Salon Professional" className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs" disabled />
              </div>
            </div>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">
            <Save className="w-3.5 h-3.5" />
            Save Changes
          </button>
        </div>
      )}

      {activeTab === "api" && (
        <div className="p-6 rounded-xl border border-border bg-card/80 space-y-4">
          <h3 className="text-sm font-semibold">API Configuration</h3>
          <div>
            <label className="text-xs text-muted-foreground">Anthropic API Key (for AI categorization)</label>
            <input type="password" placeholder="sk-ant-..." className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50" />
            <p className="text-[10px] text-muted-foreground mt-1">Used to categorize transactions that can't be matched by rules. Get your key at console.anthropic.com</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      )}

      {activeTab === "accounts" && (
        <div className="space-y-4">
          {[
            { name: "Business Checking", institution: "Wells Fargo", lastFour: "9898", type: "Checking", primary: true },
            { name: "Business Savings", institution: "Wells Fargo", lastFour: "7004", type: "Savings", primary: false },
            { name: "Personal Checking", institution: "Wells Fargo", lastFour: "0928", type: "Checking", primary: false },
            { name: "Chase Credit Card", institution: "Chase", lastFour: "1899", type: "Credit Card", primary: false },
            { name: "Barclaycard", institution: "Barclays", lastFour: "2163", type: "Credit Card", primary: false },
          ].map((account) => (
            <div key={account.lastFour} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/80">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-muted-foreground">{account.institution} •••• {account.lastFour}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{account.type}</span>
                {account.primary && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Primary</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
