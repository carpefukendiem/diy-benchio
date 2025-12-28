"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Building2,
  CreditCard,
  Wallet,
  Trash2,
  Edit3,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  DollarSign,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PlaidAccount {
  account_id: string
  name: string
  official_name?: string
  type: string
  subtype: string
  balance: number
  available_balance?: number
  currency_code: string
  institution_name: string
  institution_id: string
  item_id: string
  access_token: string
  last_sync: string
  status: "active" | "error" | "disconnected"
  error_message?: string
  mask?: string
}

interface AccountManagementProps {
  accounts: PlaidAccount[]
  onAccountUpdate: (accounts: PlaidAccount[]) => void
  onRefreshAccount: (accountId: string) => Promise<void>
  onRemoveAccount: (accountId: string) => Promise<void>
}

export function AccountManagement({
  accounts,
  onAccountUpdate,
  onRefreshAccount,
  onRemoveAccount,
}: AccountManagementProps) {
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null)
  const [editingAccount, setEditingAccount] = useState<PlaidAccount | null>(null)
  const [accountName, setAccountName] = useState("")
  const { toast } = useToast()

  const getAccountIcon = (type: string, subtype: string) => {
    if (type === "depository") {
      return subtype === "savings" ? <Wallet className="h-5 w-5" /> : <Building2 className="h-5 w-5" />
    }
    if (type === "credit") {
      return <CreditCard className="h-5 w-5" />
    }
    return <Building2 className="h-5 w-5" />
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />
      case "disconnected":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "default"
      case "error":
        return "destructive"
      case "disconnected":
        return "secondary"
      default:
        return "outline"
    }
  }

  const handleRefreshAccount = async (accountId: string) => {
    setIsRefreshing(accountId)
    try {
      await onRefreshAccount(accountId)
      toast({
        title: "Account Refreshed",
        description: "Account data has been updated successfully",
      })
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh account data",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(null)
    }
  }

  const handleRemoveAccount = async (accountId: string, institutionName: string) => {
    try {
      await onRemoveAccount(accountId)
      toast({
        title: "Account Removed",
        description: `${institutionName} account has been disconnected`,
      })
    } catch (error) {
      toast({
        title: "Removal Failed",
        description: "Failed to remove account",
        variant: "destructive",
      })
    }
  }

  const handleUpdateAccountName = async () => {
    if (!editingAccount || !accountName.trim()) return

    try {
      const response = await fetch("/api/plaid/update-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: editingAccount.account_id,
          name: accountName.trim(),
        }),
      })

      if (response.ok) {
        const updatedAccounts = accounts.map((acc) =>
          acc.account_id === editingAccount.account_id ? { ...acc, name: accountName.trim() } : acc,
        )
        onAccountUpdate(updatedAccounts)
        setEditingAccount(null)
        setAccountName("")
        toast({
          title: "Account Updated",
          description: "Account name has been updated successfully",
        })
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update account name",
        variant: "destructive",
      })
    }
  }

  const refreshAllAccounts = async () => {
    for (const account of accounts) {
      if (account.status === "active") {
        await handleRefreshAccount(account.account_id)
      }
    }
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Connected Accounts</h3>
          <p className="text-muted-foreground text-center mb-4">
            Connect your bank accounts, credit cards, and other financial accounts to get started.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Accounts</p>
                <p className="text-2xl font-bold">{accounts.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {accounts.filter((acc) => acc.status === "active").length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-600">
                  {accounts.filter((acc) => acc.status === "error").length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Balance</p>
                <p className="text-2xl font-bold">
                  ${accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0).toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Manage your connected financial accounts</CardDescription>
            </div>
            <Button variant="outline" onClick={refreshAllAccounts} disabled={isRefreshing !== null}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {accounts.map((account) => (
              <div key={account.account_id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  {getAccountIcon(account.type, account.subtype)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{account.name}</h3>
                      {account.mask && <Badge variant="outline">•••• {account.mask}</Badge>}
                      <Badge variant={getStatusColor(account.status) as any}>{account.status}</Badge>
                      {getStatusIcon(account.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {account.institution_name} • {account.subtype}
                    </p>
                    {account.official_name && account.official_name !== account.name && (
                      <p className="text-xs text-muted-foreground">Official: {account.official_name}</p>
                    )}
                    {account.error_message && (
                      <p className="text-xs text-red-600 mt-1">Error: {account.error_message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Last sync: {account.last_sync}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold">${account.balance?.toLocaleString() || "0.00"}</div>
                    {account.available_balance !== undefined && account.available_balance !== account.balance && (
                      <div className="text-sm text-muted-foreground">
                        Available: ${account.available_balance.toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefreshAccount(account.account_id)}
                      disabled={isRefreshing === account.account_id}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing === account.account_id ? "animate-spin" : ""}`} />
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingAccount(account)
                            setAccountName(account.name)
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Account</DialogTitle>
                          <DialogDescription>Update the display name for this account</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="account-name">Account Name</Label>
                            <Input
                              id="account-name"
                              value={accountName}
                              onChange={(e) => setAccountName(e.target.value)}
                              placeholder="Enter account name"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditingAccount(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleUpdateAccountName}>Save Changes</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Account</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to disconnect "{account.name}" from {account.institution_name}? This
                            will stop syncing transactions from this account.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveAccount(account.account_id, account.institution_name)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Remove Account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
