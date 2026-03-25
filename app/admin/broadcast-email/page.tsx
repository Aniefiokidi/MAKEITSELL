"use client"

import { useEffect, useRef, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Mail, Send, Search, AlertTriangle, Upload } from "lucide-react"
import { uploadToCloudinary } from "@/lib/cloudinary"

type PreviewResponse = {
  success: boolean
  totalMatching: number
  selected: number
  skip: number
  limit: number
  hasMore: boolean
  sample?: Array<{
    id: string
    email: string
    name: string
    role: string
    isEmailVerified: boolean
  }>
  error?: string
}

type SendResponse = {
  success: boolean
  processed: number
  sent: number
  failed: number
  totalMatching: number
  skip: number
  limit: number
  hasMore: boolean
  nextSkip: number
  failedEmails?: string[]
  error?: string
}

type MessagePreviewResponse = {
  success: boolean
  subject: string
  html: string
  text: string
  error?: string
}

const DEFAULT_SUBJECT = "Important: registration link issue update"
const DEFAULT_BODY =
  "Some users recently experienced delays or failures receiving registration and verification links. We sincerely apologize for the inconvenience.\n\nThe issue has been fixed. If you were affected, please try signing in again or request a new verification link.\n\nIf you still do not receive your link, contact us and we will assist immediately."
const DEFAULT_LOGIN_BUTTON = "Sign in"
const DEFAULT_SIGNUP_BUTTON = "Create account"
const DEFAULT_ESIGNATURE_TEXT = ""
const DEFAULT_SIGNATURE_IMAGE_URL = ""
const DEFAULT_SENDER_NAME = "Make It Sell Team"
const DEFAULT_SENDER_TITLE = ""
const DEFAULT_SENDER_COMPANY = "Make It Sell"
const DEFAULT_SIGNATURE_WIDTH = 180
const DEFAULT_SIGNATURE_X = 0
const DEFAULT_SIGNATURE_Y = 0
const SIGNATURE_STAGE_WIDTH = 520
const SIGNATURE_STAGE_HEIGHT = 180
const MAX_SIGNATURE_FILE_SIZE_MB = 2
const MAX_SIGNATURE_FILE_SIZE_BYTES = MAX_SIGNATURE_FILE_SIZE_MB * 1024 * 1024

async function compressSignatureImage(file: File): Promise<File> {
  // Keep signatures lightweight for faster upload and better email loading.
  const imageBitmap = await createImageBitmap(file)
  const maxDimension = 1200
  const scale = Math.min(1, maxDimension / Math.max(imageBitmap.width, imageBitmap.height))
  const targetWidth = Math.max(1, Math.round(imageBitmap.width * scale))
  const targetHeight = Math.max(1, Math.round(imageBitmap.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return file
  }

  ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight)

  const preferredMime = file.type === "image/png" ? "image/png" : "image/webp"
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, preferredMime, 0.82)
  })

  if (!blob) {
    return file
  }

  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "img"
  const compressedName = file.name.replace(/\.[^/.]+$/, `.${ext}`)
  const compressed = new File([blob], compressedName, { type: blob.type })

  return compressed.size < file.size ? compressed : file
}

export default function AdminBroadcastEmailPage() {
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingSend, setLoadingSend] = useState(false)
  const [loadingMessagePreview, setLoadingMessagePreview] = useState(false)

  const [adminKey, setAdminKey] = useState("")
  const [emailFilter, setEmailFilter] = useState("")
  const [limit, setLimit] = useState(200)
  const [skip, setSkip] = useState(0)
  const [delayMs, setDelayMs] = useState(350)
  const [onlyUnverified, setOnlyUnverified] = useState(false)
  const [includeAdmins, setIncludeAdmins] = useState(false)
  const [previewName, setPreviewName] = useState("Preview User")
  const [customSubject, setCustomSubject] = useState(DEFAULT_SUBJECT)
  const [customBody, setCustomBody] = useState(DEFAULT_BODY)
  const [loginButtonText, setLoginButtonText] = useState(DEFAULT_LOGIN_BUTTON)
  const [signupButtonText, setSignupButtonText] = useState(DEFAULT_SIGNUP_BUTTON)
  const [eSignatureText, setESignatureText] = useState(DEFAULT_ESIGNATURE_TEXT)
  const [signatureImageUrl, setSignatureImageUrl] = useState(DEFAULT_SIGNATURE_IMAGE_URL)
  const [senderName, setSenderName] = useState(DEFAULT_SENDER_NAME)
  const [senderTitle, setSenderTitle] = useState(DEFAULT_SENDER_TITLE)
  const [senderCompany, setSenderCompany] = useState(DEFAULT_SENDER_COMPANY)
  const [signatureWidthPx, setSignatureWidthPx] = useState(DEFAULT_SIGNATURE_WIDTH)
  const [signatureXOffsetPx, setSignatureXOffsetPx] = useState(DEFAULT_SIGNATURE_X)
  const [signatureYOffsetPx, setSignatureYOffsetPx] = useState(DEFAULT_SIGNATURE_Y)
  const [saveMessage, setSaveMessage] = useState("")

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [result, setResult] = useState<SendResponse | null>(null)
  const [messagePreview, setMessagePreview] = useState<MessagePreviewResponse | null>(null)
  const [loadingTemplateSync, setLoadingTemplateSync] = useState(false)
  const [uploadingSignatureImage, setUploadingSignatureImage] = useState(false)
  const [isDraggingSignature, setIsDraggingSignature] = useState(false)
  const [isResizingSignature, setIsResizingSignature] = useState(false)

  const dragStateRef = useRef<{
    startMouseX: number
    startMouseY: number
    startX: number
    startY: number
    startWidth: number
    mode: "drag" | "resize"
  } | null>(null)

  useEffect(() => {
    loadServerTemplate()
  }, [])

  const loadServerTemplate = async () => {
    setLoadingTemplateSync(true)
    try {
      const response = await fetch("/api/admin/broadcast-email", {
        method: "POST",
        credentials: "include",
        headers: makeHeaders(),
        body: JSON.stringify({ action: "template-get" }),
      })

      const data = await response.json()
      if (!data.success) {
        setSaveMessage("No shared template loaded")
        return
      }

      const t = data.templateOverrides || {}
      if (typeof t.subject === "string" && t.subject.trim()) setCustomSubject(t.subject)
      if (typeof t.body === "string" && t.body.trim()) setCustomBody(t.body)
      if (typeof t.loginButtonText === "string" && t.loginButtonText.trim()) setLoginButtonText(t.loginButtonText)
      if (typeof t.signupButtonText === "string" && t.signupButtonText.trim()) setSignupButtonText(t.signupButtonText)
      if (typeof t.eSignatureText === "string") setESignatureText(t.eSignatureText)
      if (typeof t.signatureImageUrl === "string") setSignatureImageUrl(t.signatureImageUrl)
      if (typeof t.senderName === "string" && t.senderName.trim()) setSenderName(t.senderName)
      if (typeof t.senderTitle === "string") setSenderTitle(t.senderTitle)
      if (typeof t.senderCompany === "string" && t.senderCompany.trim()) setSenderCompany(t.senderCompany)
      if (typeof t.signatureWidthPx === "number") setSignatureWidthPx(t.signatureWidthPx)
      if (typeof t.signatureXOffsetPx === "number") setSignatureXOffsetPx(t.signatureXOffsetPx)
      if (typeof t.signatureYOffsetPx === "number") setSignatureYOffsetPx(t.signatureYOffsetPx)
      setSaveMessage("Shared template loaded")
    } catch (error) {
      console.error("[admin/broadcast-email] Failed to load shared template:", error)
      setSaveMessage("Could not load shared template")
    } finally {
      setLoadingTemplateSync(false)
    }
  }

  const makeHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (adminKey.trim()) {
      headers.Authorization = `Bearer ${adminKey.trim()}`
    }

    return headers
  }

  const buildPayload = () => ({
    emailFilter: emailFilter.trim() || undefined,
    limit,
    skip,
    delayMs,
    onlyUnverified,
    includeAdmins,
    templateOverrides: {
      subject: customSubject.trim() || undefined,
      body: customBody.trim() || undefined,
      loginButtonText: loginButtonText.trim() || undefined,
      signupButtonText: signupButtonText.trim() || undefined,
      eSignatureText: eSignatureText.trim() || undefined,
      signatureImageUrl: signatureImageUrl.trim() || undefined,
      senderName: senderName.trim() || undefined,
      senderTitle: senderTitle.trim() || undefined,
      senderCompany: senderCompany.trim() || undefined,
      signatureWidthPx,
      signatureXOffsetPx,
      signatureYOffsetPx,
    },
  })

  const runPreview = async () => {
    setLoadingPreview(true)
    setResult(null)

    try {
      const response = await fetch("/api/admin/broadcast-email", {
        method: "POST",
        credentials: "include",
        headers: makeHeaders(),
        body: JSON.stringify({
          action: "preview",
          ...buildPayload(),
        }),
      })

      const data = await response.json()
      setPreview(data)

      if (!data.success) {
        alert(data.error || "Failed to preview recipients")
      }
    } catch (error) {
      console.error("[admin/broadcast-email] Preview error:", error)
      alert("Failed to preview recipients")
    } finally {
      setLoadingPreview(false)
    }
  }

  const runSend = async () => {
    if (!confirm("Send registration-issue announcement to this batch now?")) {
      return
    }

    setLoadingSend(true)

    try {
      const response = await fetch("/api/admin/broadcast-email", {
        method: "POST",
        credentials: "include",
        headers: makeHeaders(),
        body: JSON.stringify({
          action: "send",
          ...buildPayload(),
        }),
      })

      const data = await response.json()
      setResult(data)

      if (!data.success) {
        alert(data.error || "Broadcast failed")
        return
      }

      if (typeof data.nextSkip === "number") {
        setSkip(data.nextSkip)
      }
    } catch (error) {
      console.error("[admin/broadcast-email] Send error:", error)
      alert("Broadcast failed")
    } finally {
      setLoadingSend(false)
    }
  }

  const runMessagePreview = async () => {
    setLoadingMessagePreview(true)

    try {
      const response = await fetch("/api/admin/broadcast-email", {
        method: "POST",
        credentials: "include",
        headers: makeHeaders(),
        body: JSON.stringify({
          action: "message-preview",
          previewName: previewName.trim() || "Preview User",
          templateOverrides: {
            subject: customSubject.trim() || undefined,
            body: customBody.trim() || undefined,
            loginButtonText: loginButtonText.trim() || undefined,
            signupButtonText: signupButtonText.trim() || undefined,
            eSignatureText: eSignatureText.trim() || undefined,
            signatureImageUrl: signatureImageUrl.trim() || undefined,
            senderName: senderName.trim() || undefined,
            senderTitle: senderTitle.trim() || undefined,
            senderCompany: senderCompany.trim() || undefined,
            signatureWidthPx,
            signatureXOffsetPx,
            signatureYOffsetPx,
          },
        }),
      })

      const data = await response.json()
      setMessagePreview(data)

      if (!data.success) {
        alert(data.error || "Failed to preview message")
      }
    } catch (error) {
      console.error("[admin/broadcast-email] Message preview error:", error)
      alert("Failed to preview message")
    } finally {
      setLoadingMessagePreview(false)
    }
  }

  const saveTemplate = () => {
    ;(async () => {
      setLoadingTemplateSync(true)
      try {
        const response = await fetch("/api/admin/broadcast-email", {
          method: "POST",
          credentials: "include",
          headers: makeHeaders(),
          body: JSON.stringify({
            action: "template-save",
            templateOverrides: {
              subject: customSubject,
              body: customBody,
              loginButtonText,
              signupButtonText,
              eSignatureText,
              signatureImageUrl,
              senderName,
              senderTitle,
              senderCompany,
              signatureWidthPx,
              signatureXOffsetPx,
              signatureYOffsetPx,
            },
          }),
        })
        const data = await response.json()
        if (!data.success) {
          setSaveMessage(data.error || "Could not save shared template")
          return
        }
        setSaveMessage("Shared template saved")
      } catch (error) {
        console.error("[admin/broadcast-email] Failed to save shared template:", error)
        setSaveMessage("Could not save shared template")
      } finally {
        setLoadingTemplateSync(false)
      }
    })()
  }

  const resetTemplate = () => {
    ;(async () => {
      setCustomSubject(DEFAULT_SUBJECT)
      setCustomBody(DEFAULT_BODY)
      setLoginButtonText(DEFAULT_LOGIN_BUTTON)
      setSignupButtonText(DEFAULT_SIGNUP_BUTTON)
      setESignatureText(DEFAULT_ESIGNATURE_TEXT)
      setSignatureImageUrl(DEFAULT_SIGNATURE_IMAGE_URL)
      setSenderName(DEFAULT_SENDER_NAME)
      setSenderTitle(DEFAULT_SENDER_TITLE)
      setSenderCompany(DEFAULT_SENDER_COMPANY)
      setSignatureWidthPx(DEFAULT_SIGNATURE_WIDTH)
      setSignatureXOffsetPx(DEFAULT_SIGNATURE_X)
      setSignatureYOffsetPx(DEFAULT_SIGNATURE_Y)

      setLoadingTemplateSync(true)
      try {
        await fetch("/api/admin/broadcast-email", {
          method: "POST",
          credentials: "include",
          headers: makeHeaders(),
          body: JSON.stringify({
            action: "template-save",
            templateOverrides: {
              subject: DEFAULT_SUBJECT,
              body: DEFAULT_BODY,
              loginButtonText: DEFAULT_LOGIN_BUTTON,
              signupButtonText: DEFAULT_SIGNUP_BUTTON,
              eSignatureText: DEFAULT_ESIGNATURE_TEXT,
              signatureImageUrl: DEFAULT_SIGNATURE_IMAGE_URL,
              senderName: DEFAULT_SENDER_NAME,
              senderTitle: DEFAULT_SENDER_TITLE,
              senderCompany: DEFAULT_SENDER_COMPANY,
              signatureWidthPx: DEFAULT_SIGNATURE_WIDTH,
              signatureXOffsetPx: DEFAULT_SIGNATURE_X,
              signatureYOffsetPx: DEFAULT_SIGNATURE_Y,
            },
          }),
        })
        setSaveMessage("Template reset and saved as shared default")
      } catch (error) {
        console.error("[admin/broadcast-email] Failed to reset shared template:", error)
        setSaveMessage("Template reset locally; shared save failed")
      } finally {
        setLoadingTemplateSync(false)
      }
    })()
  }

  const uploadSignatureImageFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file for signature")
      return
    }

    try {
      setUploadingSignatureImage(true)

      let uploadFile = file
      if (uploadFile.size > MAX_SIGNATURE_FILE_SIZE_BYTES) {
        uploadFile = await compressSignatureImage(uploadFile)
      }

      if (uploadFile.size > MAX_SIGNATURE_FILE_SIZE_BYTES) {
        alert(`Signature image is too large even after compression. Maximum size is ${MAX_SIGNATURE_FILE_SIZE_MB}MB.`)
        return
      }

      const url = await uploadToCloudinary(uploadFile)
      if (!url) {
        alert("Upload failed")
        return
      }
      setSignatureImageUrl(String(url))
      const compressedTag = uploadFile.size < file.size ? " (compressed)" : ""
      setSaveMessage(`Signature image uploaded${compressedTag}. Preview and save template when ready`)
    } catch (error) {
      console.error("[admin/broadcast-email] Signature image upload failed:", error)
      alert("Could not upload signature image")
    } finally {
      setUploadingSignatureImage(false)
    }
  }

  const removeSignatureImage = () => {
    setSignatureImageUrl("")
    setSaveMessage("Signature image removed")
  }

  const fitSignatureToBox = () => {
    if (!signatureImageUrl.trim() && !eSignatureText.trim()) {
      setSaveMessage("Add signature text or image first")
      return
    }

    const hasImage = !!signatureImageUrl.trim()
    const baseWidth = hasImage ? 220 : 180
    const fittedWidth = clamp(baseWidth, 80, 340)

    const centeredX = Math.round((SIGNATURE_STAGE_WIDTH - fittedWidth) / 2)
    const defaultY = hasImage ? 14 : 20

    setSignatureWidthPx(fittedWidth)
    setSignatureXOffsetPx(clamp(centeredX, 0, SIGNATURE_STAGE_WIDTH - fittedWidth))
    setSignatureYOffsetPx(clamp(defaultY, 0, SIGNATURE_STAGE_HEIGHT - 20))
    setSaveMessage("Signature fitted and centered")
  }

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

  const handleSignatureMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(signatureImageUrl.trim() || eSignatureText.trim())) return
    e.preventDefault()

    dragStateRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: signatureXOffsetPx,
      startY: signatureYOffsetPx,
      startWidth: signatureWidthPx,
      mode: "drag",
    }
    setIsDraggingSignature(true)
  }

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    dragStateRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: signatureXOffsetPx,
      startY: signatureYOffsetPx,
      startWidth: signatureWidthPx,
      mode: "resize",
    }
    setIsResizingSignature(true)
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const state = dragStateRef.current
      if (!state) return

      const dx = e.clientX - state.startMouseX
      const dy = e.clientY - state.startMouseY

      if (state.mode === "drag") {
        const maxX = Math.max(0, SIGNATURE_STAGE_WIDTH - signatureWidthPx)
        const nextX = clamp(state.startX + dx, 0, maxX)
        const nextY = clamp(state.startY + dy, 0, SIGNATURE_STAGE_HEIGHT - 20)
        setSignatureXOffsetPx(Math.round(nextX))
        setSignatureYOffsetPx(Math.round(nextY))
      } else {
        const nextWidth = clamp(state.startWidth + dx, 80, 340)
        const maxX = Math.max(0, SIGNATURE_STAGE_WIDTH - nextWidth)
        setSignatureWidthPx(Math.round(nextWidth))
        setSignatureXOffsetPx((prev) => clamp(prev, 0, maxX))
      }
    }

    const onMouseUp = () => {
      dragStateRef.current = null
      setIsDraggingSignature(false)
      setIsResizingSignature(false)
    }

    if (isDraggingSignature || isResizingSignature) {
      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [isDraggingSignature, isResizingSignature, signatureWidthPx])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Broadcast Email</h1>
          <p className="text-muted-foreground text-sm lg:text-base">
            Send a platform-wide announcement about the registration link issue in controlled batches.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Broadcast Settings
            </CardTitle>
            <CardDescription>
              Use preview first, then send in batches to avoid SMTP throttling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admin-key">Admin Key (Optional)</Label>
                <Input
                  id="admin-key"
                  type="password"
                  placeholder="Use if not logged in as admin"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-filter">Email Filter (Optional)</Label>
                <Input
                  id="email-filter"
                  placeholder="e.g. @icloud.com"
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="custom-subject">Email Subject</Label>
                <Input
                  id="custom-subject"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="custom-body">Email Body</Label>
                <Textarea
                  id="custom-body"
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  className="min-h-[170px]"
                  placeholder="Write body content. Separate paragraphs with blank lines."
                />
                <p className="text-xs text-muted-foreground">Use blank lines to create separate paragraphs in the email.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-button-text">Login Button Text</Label>
                <Input
                  id="login-button-text"
                  value={loginButtonText}
                  onChange={(e) => setLoginButtonText(e.target.value)}
                  placeholder="Sign in"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-button-text">Signup Button Text</Label>
                <Input
                  id="signup-button-text"
                  value={signupButtonText}
                  onChange={(e) => setSignupButtonText(e.target.value)}
                  placeholder="Create account"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="signature-image-url">Signature Image URL (Optional)</Label>
                <Input
                  id="signature-image-url"
                  value={signatureImageUrl}
                  onChange={(e) => setSignatureImageUrl(e.target.value)}
                  placeholder="https://.../your-signature.png"
                />
                <div className="flex items-center gap-2">
                  <label className="inline-flex">
                    <Input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => uploadSignatureImageFile(e.target.files)}
                    />
                    <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground">
                      {uploadingSignatureImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploadingSignatureImage ? "Uploading..." : "Upload Signature Image"}
                    </span>
                  </label>
                  <Button type="button" variant="outline" onClick={removeSignatureImage} disabled={!signatureImageUrl.trim() || uploadingSignatureImage}>
                    Remove Signature Image
                  </Button>
                  <Button type="button" variant="outline" onClick={fitSignatureToBox}>
                    Fit Signature to Box
                  </Button>
                  <span className="text-xs text-muted-foreground">You can upload from your device or paste a URL above.</span>
                </div>
                {signatureImageUrl.trim() ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Current signature:</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signatureImageUrl.trim()}
                      alt="Current signature"
                      className="h-10 w-auto max-w-40 rounded border bg-white p-1 object-contain"
                    />
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">Allowed: image files only. Max size: {MAX_SIGNATURE_FILE_SIZE_MB}MB.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="e-signature-text">E-Signature Text (Optional)</Label>
                <Input
                  id="e-signature-text"
                  value={eSignatureText}
                  onChange={(e) => setESignatureText(e.target.value)}
                  placeholder="Arnold Idiong"
                />
                <p className="text-xs text-muted-foreground">This appears as a handwritten-style signature above your name.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Signature Placement (Drag and Resize)</Label>
                <div className="border rounded-md p-3 bg-muted/20">
                  <div className="text-xs text-muted-foreground mb-2">Drag the signature block to place it and use the corner handle to resize.</div>
                  <div
                    className="relative bg-white border rounded-md overflow-hidden"
                    style={{ width: `${SIGNATURE_STAGE_WIDTH}px`, maxWidth: "100%", height: `${SIGNATURE_STAGE_HEIGHT}px` }}
                  >
                    <div
                      className="absolute border-2 border-dashed border-orange-400 bg-orange-50/60 p-2 select-none"
                      style={{
                        left: `${signatureXOffsetPx}px`,
                        top: `${signatureYOffsetPx}px`,
                        width: `${signatureWidthPx}px`,
                        cursor: isDraggingSignature ? "grabbing" : "grab",
                      }}
                      onMouseDown={handleSignatureMouseDown}
                    >
                      {signatureImageUrl.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={signatureImageUrl.trim()} alt="Signature preview" style={{ maxWidth: "100%", maxHeight: "70px", objectFit: "contain" }} />
                      ) : null}
                      {eSignatureText.trim() ? (
                        <div style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: "26px", lineHeight: 1.1, color: "#8a2d12" }}>
                          {eSignatureText}
                        </div>
                      ) : null}
                      {!signatureImageUrl.trim() && !eSignatureText.trim() ? (
                        <div className="text-xs text-muted-foreground">Add signature text or image to move it here</div>
                      ) : null}

                      <div
                        className="absolute right-0 bottom-0 w-3 h-3 bg-orange-600 cursor-se-resize"
                        onMouseDown={handleResizeMouseDown}
                        title="Resize"
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    X: {signatureXOffsetPx}px, Y: {signatureYOffsetPx}px, Width: {signatureWidthPx}px
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender-name">Sender Name</Label>
                <Input
                  id="sender-name"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Arnold Idiong"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender-title">Sender Title (Optional)</Label>
                <Input
                  id="sender-title"
                  value={senderTitle}
                  onChange={(e) => setSenderTitle(e.target.value)}
                  placeholder="Chief Executive Officer (CEO)"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="sender-company">Sender Company</Label>
                <Input
                  id="sender-company"
                  value={senderCompany}
                  onChange={(e) => setSenderCompany(e.target.value)}
                  placeholder="Make It Sell"
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={saveTemplate} disabled={loadingTemplateSync}>
                  Save Template
                </Button>
                <Button type="button" variant="outline" onClick={resetTemplate} disabled={loadingTemplateSync}>
                  Reset to Default
                </Button>
                <Button type="button" variant="outline" onClick={loadServerTemplate} disabled={loadingTemplateSync}>
                  {loadingTemplateSync ? "Syncing..." : "Load Shared Template"}
                </Button>
                {saveMessage && <span className="text-xs text-muted-foreground self-center">{saveMessage}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preview-name">Message Preview Name</Label>
                <Input
                  id="preview-name"
                  placeholder="Name used in preview greeting"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={runMessagePreview} disabled={loadingMessagePreview || loadingPreview || loadingSend}>
                  {loadingMessagePreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Preview Message
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limit">Batch Size</Label>
                <Input
                  id="limit"
                  type="number"
                  min={1}
                  max={1000}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value || 200))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skip">Skip</Label>
                <Input
                  id="skip"
                  type="number"
                  min={0}
                  value={skip}
                  onChange={(e) => setSkip(Number(e.target.value || 0))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay">Delay (ms)</Label>
                <Input
                  id="delay"
                  type="number"
                  min={0}
                  max={2000}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value || 350))}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyUnverified}
                  onChange={(e) => setOnlyUnverified(e.target.checked)}
                />
                Only unverified users
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeAdmins}
                  onChange={(e) => setIncludeAdmins(e.target.checked)}
                />
                Include admins
              </label>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={runPreview} disabled={loadingPreview || loadingSend}>
                {loadingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Preview Recipients
              </Button>
              <Button onClick={runSend} disabled={loadingSend || loadingPreview} className="bg-orange-600 hover:bg-orange-700">
                {loadingSend ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send This Batch
              </Button>
            </div>
          </CardContent>
        </Card>

        {preview && (
          <Card>
            <CardHeader>
              <CardTitle>Preview Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">Total matching: {preview.totalMatching}</Badge>
                <Badge variant="outline">Selected batch: {preview.selected}</Badge>
                <Badge variant="outline">Skip: {preview.skip}</Badge>
                <Badge variant="outline">Limit: {preview.limit}</Badge>
                <Badge variant="outline">Has more: {preview.hasMore ? "Yes" : "No"}</Badge>
              </div>

              <div className="space-y-2">
                {(preview.sample || []).map((u) => (
                  <div key={u.id} className="text-sm border rounded-md p-2 flex flex-wrap gap-2 items-center">
                    <Badge variant="outline">{u.email}</Badge>
                    <span>{u.name}</span>
                    <span className="text-muted-foreground">role: {u.role}</span>
                    <span className="text-muted-foreground">verified: {u.isEmailVerified ? "yes" : "no"}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {messagePreview?.success && (
          <Card>
            <CardHeader>
              <CardTitle>Email Message Preview</CardTitle>
              <CardDescription>
                This is the exact subject/body currently used for the registration issue announcement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Subject</Label>
                <div className="mt-1 border rounded-md p-3 text-sm bg-muted/30">{messagePreview.subject}</div>
              </div>

              <div>
                <Label>Plain Text</Label>
                <pre className="mt-1 border rounded-md p-3 text-xs whitespace-pre-wrap bg-muted/30">{messagePreview.text}</pre>
              </div>

              <div>
                <Label>Rendered HTML</Label>
                <div className="mt-1 border rounded-md p-3 bg-white overflow-auto">
                  <div dangerouslySetInnerHTML={{ __html: messagePreview.html }} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Alert className={result.failed > 0 ? "border-yellow-300 bg-yellow-50" : "border-green-300 bg-green-50"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">Batch Completed</div>
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="outline">Processed: {result.processed}</Badge>
                <Badge variant="outline">Sent: {result.sent}</Badge>
                <Badge variant="outline">Failed: {result.failed}</Badge>
                <Badge variant="outline">Next skip: {result.nextSkip}</Badge>
                <Badge variant="outline">Has more: {result.hasMore ? "Yes" : "No"}</Badge>
              </div>
              {!!result.failedEmails?.length && (
                <div className="text-sm">Failed samples: {result.failedEmails.slice(0, 10).join(", ")}</div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AdminLayout>
  )
}
