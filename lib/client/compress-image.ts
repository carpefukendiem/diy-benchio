"use client"

/** Shrink very large JPEG/PNG before storing in localStorage (keeps under typical limits). */
export async function compressImageIfNeeded(file: File, maxBytes = 3_500_000): Promise<File> {
  if (file.size <= maxBytes || !file.type.startsWith("image/")) return file
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement("canvas")
      let w = img.naturalWidth
      let h = img.naturalHeight
      const maxDim = 2200
      if (w > maxDim || h > maxDim) {
        const s = Math.min(maxDim / w, maxDim / h)
        w = Math.round(w * s)
        h = Math.round(h * s)
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const out = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" })
          resolve(out.size < file.size ? out : file)
        },
        "image/jpeg",
        0.82,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}
