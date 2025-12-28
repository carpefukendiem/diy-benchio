import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { access_token, start_date, end_date } = await request.json()

    // In production, you would use the actual Plaid client here
    // For now, return enhanced mock data that simulates year-to-date transactions

    const mockYTDTransactions = [
      // January 2024
      {
        id: "ytd_001",
        date: "2024-01-15",
        description: "Stripe Transfer - Q4 Client Payment",
        amount: 3200.0,
        category: "Sales Revenue",
        account: "Wells Fargo Checking",
        isIncome: true,
        plaidTransactionId: "stripe_q4_001",
        merchantName: "Stripe",
      },
      {
        id: "ytd_002",
        date: "2024-01-10",
        description: "Adobe Creative Cloud Annual",
        amount: 599.88,
        category: "Software & Web Hosting Expense",
        account: "Wells Fargo Checking",
        isIncome: false,
        plaidTransactionId: "adobe_annual_001",
        merchantName: "Adobe",
      },
      // February 2024
      {
        id: "ytd_003",
        date: "2024-02-14",
        description: "PayPal Transfer - Valentine's Campaign",
        amount: 1850.0,
        category: "Sales Revenue",
        account: "Wells Fargo Checking",
        isIncome: true,
        plaidTransactionId: "paypal_valentine_001",
        merchantName: "PayPal",
      },
      {
        id: "ytd_004",
        date: "2024-02-20",
        description: "Business Lunch - Client Meeting",
        amount: 89.5,
        category: "Business Meals Expense",
        account: "Barclaycard Credit Card",
        isIncome: false,
        plaidTransactionId: "lunch_client_001",
        merchantName: "The Capital Grille",
      },
      // March 2024 (current transactions)
      {
        id: "ytd_005",
        date: "2024-03-15",
        description: "Stripe Transfer - Customer Payment",
        amount: 2450.0,
        category: "Sales Revenue",
        account: "Wells Fargo Checking",
        isIncome: true,
        plaidTransactionId: "stripe_march_001",
        merchantName: "Stripe",
      },
      {
        id: "ytd_006",
        date: "2024-03-14",
        description: "Adobe Creative Cloud",
        amount: 52.99,
        category: "Software & Web Hosting Expense",
        account: "Wells Fargo Checking",
        isIncome: false,
        plaidTransactionId: "adobe_march_001",
        merchantName: "Adobe",
      },
      {
        id: "ytd_007",
        date: "2024-03-13",
        description: "Shell Gas Station #1234",
        amount: 45.67,
        category: "Gas & Auto Expense",
        account: "Barclaycard Credit Card",
        isIncome: false,
        plaidTransactionId: "shell_march_001",
        merchantName: "Shell",
      },
      {
        id: "ytd_008",
        date: "2024-03-12",
        description: "Twilio Communications",
        amount: 89.5,
        category: "Software & Web Hosting Expense",
        account: "Wells Fargo Checking",
        isIncome: false,
        plaidTransactionId: "twilio_march_001",
        merchantName: "Twilio",
      },
      // Additional YTD transactions
      {
        id: "ytd_009",
        date: "2024-01-25",
        description: "Cox Internet Service",
        amount: 79.99,
        category: "Phone & Internet Expense",
        account: "Wells Fargo Checking",
        isIncome: false,
        plaidTransactionId: "cox_jan_001",
        merchantName: "Cox Communications",
      },
      {
        id: "ytd_010",
        date: "2024-02-28",
        description: "Wells Fargo Monthly Fee",
        amount: 12.0,
        category: "Bank & ATM Fee Expense",
        account: "Wells Fargo Checking",
        isIncome: false,
        plaidTransactionId: "wf_fee_feb_001",
        merchantName: "Wells Fargo",
      },
    ]

    return NextResponse.json({
      transactions: mockYTDTransactions,
      total_transactions: mockYTDTransactions.length,
      accounts: [
        {
          account_id: "wells_fargo_checking",
          name: "Wells Fargo - Checking - 9898",
          balance: 354.22,
        },
        {
          account_id: "barclaycard_credit",
          name: "Barclaycard - Credit Card - 2163",
          balance: -3999.71,
        },
      ],
    })
  } catch (error) {
    console.error("Error fetching YTD transactions:", error)
    return NextResponse.json({ error: "Failed to fetch year-to-date transactions" }, { status: 500 })
  }
}
