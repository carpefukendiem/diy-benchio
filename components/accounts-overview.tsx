"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, Building2, Wallet, RefreshCw } from "lucide-react"

interface AccountsOverviewProps {
  accounts: string[]
}

export function AccountsOverview({ accounts }: AccountsOverviewProps) {
  const mockAccounts = [
    {
      id: "wells_fargo_checking",
      name: "Wells Fargo - Checking - 9898",
      type: "checking",
      balance: 354.22,
      lastSync: "2024-03-15",
      status: "connected",
    },
    {
      id: "wells_fargo_savings",
      name: "Wells Fargo - Savings - 4174",
      type: "savings",
      balance: 29.12,
      lastSync: "2024-03-15",
      status: "connected",
    },
    {
      id: "stripe_account",
      name: "Stripe - Merchant Processor",
      type: "business",
      balance: 498.81,
      lastSync: "2024-03-15",
      status: "connected",
    },
    {
      id: "barclaycard_credit",
      name: "Barclaycard - Credit Card - 2163",
      type: "credit",
      balance: -3999.71,
      lastSync: "2024-03-15",
      status: "connected",
    },
    {
      id: "stripe_capital",
      name: "Stripe Capital - Loan Payable",
      type: "loan",
      balance: -6021.4,
      lastSync: "2024-03-15",
      status: "connected",
    },
  ]

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "checking":
      case "business":
        return <Building2 className="h-4 w-4" />
      case "savings":
        return <Wallet className="h-4 w-4" />
      case "credit":
      case "loan":
        return <CreditCard className="h-4 w-4" />
      default:
        return <Building2 className="h-4 w-4" />
    }
  }

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case "checking":
      case "business":
        return "default"
      case "savings":
        return "secondary"
      case "credit":
      case "loan":
        return "destructive"
      default:
        return "default"
    }
  }

  const totalAssets = mockAccounts
    .filter((account) => account.balance > 0)
    .reduce((sum, account) => sum + account.balance, 0)

  const totalLiabilities = Math.abs(
    mockAccounts.filter((account) => account.balance < 0).reduce((sum, account) => sum + account.balance, 0),
  )

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalAssets.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalLiabilities.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${(totalAssets - totalLiabilities) >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              ${(totalAssets - totalLiabilities).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Your linked bank accounts and credit cards</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getAccountIcon(account.type)}
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground">Last synced: {account.lastSync}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <div className={`font-semibold ${account.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      ${Math.abs(account.balance).toLocaleString()}
                    </div>
                    <Badge variant={getAccountTypeColor(account.type) as any} className="text-xs">
                      {account.type}
                    </Badge>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {account.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
