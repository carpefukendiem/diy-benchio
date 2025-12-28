import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json()

    // Check if Plaid credentials are configured
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

    // In production, you would use the actual Plaid client:
    /*
    import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
    
    const configuration = new Configuration({
      basePath: PlaidEnvironments.sandbox, // or development/production
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    })
    
    const client = new PlaidApi(configuration)
    
    const response = await client.linkTokenCreate({
      user: {
        client_user_id: user_id,
      },
      client_name: 'Personal Tax Organizer',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      webhook: 'https://your-domain.com/api/plaid/webhook',
      account_filters: {
        depository: {
          account_subtypes: ['checking', 'savings'],
        },
        credit: {
          account_subtypes: ['credit card'],
        },
      },
    })
    
    return NextResponse.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    })
    */

    // For demo purposes, return a mock link token
    const mockLinkToken = `link-sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    console.log("Created mock link token:", mockLinkToken, "for user:", user_id)

    return NextResponse.json({
      link_token: mockLinkToken,
      expiration: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
    })
  } catch (error) {
    console.error("Error creating link token:", error)
    return NextResponse.json(
      {
        error: "Failed to create link token",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
