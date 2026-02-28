import { type NextRequest, NextResponse } from "next/server"

// This route is no longer used — all logic is in /api/statements/upload
// Kept as a fallback in case anything still calls it
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Forward to the upload route by re-calling with the same formData
    const newFormData = new FormData()
    newFormData.append("file", file)
    newFormData.append("accountName", formData.get("accountName") as string || "Unknown")
    newFormData.append("accountType", formData.get("accountType") as string || "bank")

    // Import and call the upload handler directly
    const { POST: uploadHandler } = await import("../upload/route")
    
    // Create a new request
    const newRequest = new NextRequest(request.url, {
      method: "POST",
      body: newFormData,
    })

    return uploadHandler(newRequest)
  } catch (error: any) {
    console.error("[parse] Error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
