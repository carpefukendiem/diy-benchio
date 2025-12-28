import { type NextRequest, NextResponse } from "next/server"
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from "plaid"

export async function POST(request: NextRequest) {
  try {
    const { public_token } = await request.json()

    if (!public_token) {
      return NextResponse.json({ error: "Public token is required" }, { status: 400 })
    }

    const clientId = process.env.PLAID_CLIENT_ID
    const secret = process.env.PLAID_SECRET

    if (!clientId || !secret) {
      console.error("Plaid credentials not configured")
      return NextResponse.json(
        {
          error: "Plaid not configured",
          details: "PLAID_CLIENT_ID and PLAID_SECRET environment variables are required",
        },
        { status: 500 },
      )
    }

    const configuration = new Configuration({
      basePath: PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    })

    const client = new PlaidApi(configuration)

    const tokenResponse = await client.itemPublicTokenExchange({
      public_token,
    })

    const accessToken = tokenResponse.data.access_token
    const itemId = tokenResponse.data.item_id

    console.log("[v0] Exchanged public token for access token, item_id:", itemId)

    const accountsResponse = await client.accountsGet({
      access_token: accessToken,
    })

    const accounts = accountsResponse.data.accounts.map((account) => ({
      account_id: account.account_id,
      name: account.name,
      official_name: account.official_name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      balance: account.balances.current || 0,
      available_balance: account.balances.available,
      currency_code: account.balances.iso_currency_code || "USD",
    }))

    const item = accountsResponse.data.item
    const institutionResponse = await client.institutionsGetById({
      institution_id: item.institution_id!,
      country_codes: [CountryCode.Us],
    })

    console.log("[v0] Retrieved accounts and institution data")

    return NextResponse.json({
      access_token: accessToken,
      item_id: itemId,
      accounts,
      institution: {
        institution_id: institutionResponse.data.institution.institution_id,
        name: institutionResponse.data.institution.name,
      },
    })
  } catch (error) {
    console.error("[v0] Error exchanging public token:", error)
    return NextResponse.json(
      {
        error: "Failed to exchange token",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
