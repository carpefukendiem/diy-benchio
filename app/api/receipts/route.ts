import { type NextRequest, NextResponse } from "next/server"

// Receipt upload — stores receipt data (base64 image + metadata)
// For now stores in app_state alongside businesses
// Later can use Supabase Storage for actual file hosting

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const businessId = formData.get("businessId") as string
    const merchantName = formData.get("merchantName") as string
    const amount = formData.get("amount") as string
    const date = formData.get("date") as string
    const notes = formData.get("notes") as string
    const transactionId = formData.get("transactionId") as string

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Convert to base64 for storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString("base64")
    const mimeType = file.type || "image/jpeg"
    const dataUrl = `data:${mimeType};base64,${base64}`

    const receipt = {
      id: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      businessId: businessId || "",
      transactionId: transactionId || "",
      fileName: file.name,
      fileUrl: dataUrl,
      merchantName: merchantName || "",
      amount: amount ? parseFloat(amount) : 0,
      date: date || new Date().toISOString().split("T")[0],
      notes: notes || "",
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      receipt,
      message: `Receipt "${file.name}" processed`,
    })
  } catch (e: any) {
    console.error("[receipts] Upload error:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
