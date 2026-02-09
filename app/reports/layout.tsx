"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  Receipt,
  FileText,
  Settings,
  TrendingUp,
  LogOut,
  Calculator,
  Building2,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Statements", icon: Upload },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/reports/tax", label: "Tax Summary", icon: Calculator },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border bg-card/50 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm gradient-text">DIY Books</span>
            <p className="text-[10px] text-muted-foreground leading-tight">Tax-Optimized Bookkeeping</p>
          </div>
        </div>

        {/* Business Selector */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium truncate">Ranking SB</span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
