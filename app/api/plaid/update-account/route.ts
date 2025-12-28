import { type NextRequest, NextResponse } from "next/server"

export async function PUT(request: NextRequest) {
  try {
    const { account_id, name } = await request.json()

    // In production, you would update the account name in your database
    // Note: Plaid doesn't allow updating account names on their end,
    // this is just for your local display purposes

    /*
    await updateAccountInDatabase(account_id, {
      display_name: name,
      updated_at: new Date().toISOString()
    })
    */

    // Mock successful update
    await new Promise((resolve) => setTimeout(resolve, 300)) // Simulate database delay

    return NextResponse.json({
      success: true,
      account_id,
      updated_name: name,
      message: "Account name updated successfully",
    })
  } catch (error) {
    console.error("Error updating account:", error)
    return NextResponse.json(
      {
        error: "Failed to update account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
