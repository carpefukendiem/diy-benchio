import { type NextRequest, NextResponse } from "next/server"
import pdfParse from "pdf-parse"
import { extractReceiptWithVision } from "@/lib/receipts/extract-receipt-ai"
import { extractReceiptFromPdfText } from "@/lib/receipts/extract-pdf-heuristic"

export const runtime = "nodejs"
export const maxDuration = 60

function normalizeImageMediaType(mime: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  if (mime === "image/png" || mime === "image/gif" || mime === "image/webp" || mime === "image/jpeg") return mime
  if (mime === "image/jpg") return "image/jpeg"
  return null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const businessId = (formData.get("businessId") as string) || ""
    const merchantNameIn = (formData.get("merchantName") as string) || ""
    const amountIn = (formData.get("amount") as string) || ""
    const dateIn = (formData.get("date") as string) || ""
    const notesIn = (formData.get("notes") as string) || ""
    const transactionId = (formData.get("transactionId") as string) || ""
    const autoExtract = String(formData.get("autoExtract") || "") === "true"

    if (!file) {
      return NextResponse.json({ error: "No file uploaded", success: false }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type || "application/octet-stream"
    const lowerName = file.name.toLowerCase()
    const isPdf = mimeType === "application/pdf" || lowerName.endsWith(".pdf")

    let merchantName = merchantNameIn
    let amount = amountIn ? parseFloat(amountIn) : 0
    let date = dateIn || new Date().toISOString().split("T")[0]
    let notes = notesIn
    let category = ""
    let extractedBy: "ai" | "heuristic" | "manual" = "manual"
    let extractionConfidence: number | undefined
    let processingNote: string | undefined

    if (autoExtract) {
      if (isPdf) {
        try {
          const pdfData = await pdfParse(buffer)
          const extracted = extractReceiptFromPdfText(pdfData.text || "")
          if (extracted) {
            extractedBy = "heuristic"
            extractionConfidence = extracted.confidence
            if (extracted.merchant_name && !merchantName) merchantName = extracted.merchant_name
            if (extracted.total_amount != null && !amountIn) amount = extracted.total_amount
            if (extracted.date && !dateIn) date = extracted.date
            if (extracted.notes) notes = notes ? `${notes} · ${extracted.notes}` : extracted.notes
            processingNote = "Parsed from PDF text — verify amounts."
          } else {
            processingNote = "Could not auto-read PDF; enter details manually."
          }
        } catch (e: any) {
          console.error("[receipts] pdf-parse:", e.message)
          processingNote = "PDF read failed; enter details manually."
        }
      } else {
        const imgType = normalizeImageMediaType(mimeType)
        if (!imgType) {
          return NextResponse.json(
            {
              error: "Unsupported image type. Use JPG, PNG, GIF, or WebP (HEIC not supported in browser upload).",
              success: false,
            },
            { status: 400 },
          )
        }
        const base64 = buffer.toString("base64")
        try {
          const extracted = await extractReceiptWithVision(base64, imgType)
          if (extracted) {
            extractedBy = "ai"
            extractionConfidence = extracted.confidence
            if (extracted.merchant_name && !merchantName) merchantName = extracted.merchant_name
            if (extracted.total_amount != null && !amountIn) amount = extracted.total_amount
            if (extracted.date && !dateIn) date = extracted.date
            if (extracted.category_hint) category = extracted.category_hint
            if (extracted.notes) notes = notes ? `${notes} · ${extracted.notes}` : extracted.notes
          } else if (!process.env.ANTHROPIC_API_KEY) {
            processingNote = "Add ANTHROPIC_API_KEY for automatic receipt reading."
          } else {
            processingNote = "Could not read receipt image; enter details manually."
          }
        } catch (e: any) {
          console.error("[receipts] vision:", e.message)
          processingNote = e.message || "Vision extraction failed."
        }
      }
    }

    const outMime = isPdf ? "application/pdf" : mimeType.startsWith("image/") ? mimeType : "image/jpeg"
    const base64Store = buffer.toString("base64")
    const dataUrl = `data:${outMime};base64,${base64Store}`

    const receipt = {
      id: `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      businessId: businessId || "",
      transactionId: transactionId || "",
      fileName: file.name,
      fileUrl: dataUrl,
      merchantName,
      amount: Number.isFinite(amount) ? amount : 0,
      date,
      notes,
      category: category || "",
      extractedBy,
      extractionConfidence,
      processingNote,
      includeInLedger: true,
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      receipt,
      message: `Receipt "${file.name}" processed`,
    })
  } catch (e: any) {
    console.error("[receipts] Upload error:", e.message)
    return NextResponse.json({ error: e.message, success: false }, { status: 500 })
  }
}
