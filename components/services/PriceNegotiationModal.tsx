"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, CheckCircle2, XCircle, ArrowLeftRight, Send, Clock, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

interface NegotiationMessage {
  id: string
  senderId: string
  senderName: string
  senderRole: "customer" | "provider"
  type: "offer" | "counter" | "accept" | "reject" | "note"
  amount: number | null
  text: string
  createdAt: string
}

interface Negotiation {
  _id: string
  serviceName: string
  basePrice: number
  status: "open" | "agreed" | "rejected" | "expired"
  agreedPrice: number | null
  providerName: string
  messages: NegotiationMessage[]
  expiresAt: string
}

interface PriceNegotiationModalProps {
  serviceId: string
  serviceName: string
  basePrice: number
  open: boolean
  onClose: () => void
  onProceedToBooking?: (agreedPrice: number) => void
}

function fmt(n: number | null | undefined) {
  if (!n) return "—"
  return `₦${Number(n).toLocaleString("en-NG")}`
}

function typeLabel(type: NegotiationMessage["type"]) {
  if (type === "offer") return "Opening offer"
  if (type === "counter") return "Counter-offer"
  if (type === "accept") return "Accepted ✓"
  if (type === "reject") return "Declined"
  return ""
}

function AmountInput({
  value,
  onChange,
  placeholder = "0",
  autoFocus = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <div className="flex rounded-md overflow-hidden border border-input bg-background focus-within:ring-2 focus-within:ring-ring/30 focus-within:border-ring transition-all">
      <span className="flex items-center bg-muted/60 px-3 text-sm font-semibold text-muted-foreground border-r border-input select-none">
        ₦
      </span>
      <input
        type="number"
        min={1}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"
      />
    </div>
  )
}

export default function PriceNegotiationModal({
  serviceId,
  serviceName,
  basePrice,
  open,
  onClose,
  onProceedToBooking,
}: PriceNegotiationModalProps) {
  const { toast } = useToast()
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [negotiation, setNegotiation] = useState<Negotiation | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [offerAmount, setOfferAmount] = useState("")
  const [offerNote, setOfferNote] = useState("")
  const [counterAmount, setCounterAmount] = useState("")
  const [counterNote, setCounterNote] = useState("")
  const [showCounterForm, setShowCounterForm] = useState(false)

  // Fetch existing negotiation when modal opens
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/services/negotiate?serviceId=${serviceId}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setNegotiation(data.negotiation || null)
        }
      } catch {}
      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [open, serviceId])

  // Poll every 8 s while negotiation is open
  useEffect(() => {
    if (!open || !negotiation || negotiation.status !== "open") return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/services/negotiate/${negotiation._id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.negotiation) setNegotiation(data.negotiation)
        }
      } catch {}
    }, 8000)

    return () => clearInterval(interval)
  }, [open, negotiation])

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [negotiation?.messages?.length])

  async function startNegotiation() {
    const amt = parseFloat(offerAmount.replace(/[^0-9.]/g, ""))
    if (!amt || amt <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/services/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, amount: amt, text: offerNote.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.negotiationId) {
          const r2 = await fetch(`/api/services/negotiate/${data.negotiationId}`)
          const d2 = await r2.json()
          setNegotiation(d2.negotiation)
        } else {
          toast({ title: data.error || "Failed to send offer", variant: "destructive" })
        }
        return
      }
      setNegotiation(data.negotiation)
      setOfferAmount("")
      setOfferNote("")
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function sendAction(type: "accept" | "reject" | "counter", amount?: number, text?: string) {
    if (!negotiation) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/services/negotiate/${negotiation._id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount, text }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Action failed", variant: "destructive" })
        return
      }
      setNegotiation(data.negotiation)
      setCounterAmount("")
      setCounterNote("")
      setShowCounterForm(false)
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const messages = negotiation?.messages || []
  const lastMsg = messages[messages.length - 1]
  const isAwaitingProvider = lastMsg?.senderRole === "customer"
  const providerJustMoved =
    lastMsg?.senderRole === "provider" &&
    (lastMsg.type === "offer" || lastMsg.type === "counter")

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg w-full p-0 gap-0 overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold leading-tight">Negotiate Price</DialogTitle>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{serviceName}</p>
            </div>
            <div className="ml-auto text-right shrink-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Listed at</p>
              <p className="text-sm font-bold text-foreground">{fmt(basePrice)}</p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        )}

        {/* ── No active negotiation: opening offer form ── */}
        {!loading && !negotiation && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="flex gap-2.5 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 leading-relaxed">
                Propose a price directly to the provider. They'll be notified and can accept, counter, or decline. Negotiations expire after 48 hours.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Your proposed price</label>
              <AmountInput
                value={offerAmount}
                onChange={setOfferAmount}
                placeholder="e.g. 45000"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Provider's listed price: {fmt(basePrice)}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Message <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                rows={3}
                placeholder="e.g. I have a budget of ₦45,000 for this project..."
                value={offerNote}
                onChange={(e) => setOfferNote(e.target.value)}
                className="resize-none text-sm"
              />
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={startNegotiation}
              disabled={submitting || !offerAmount}
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Send className="h-4 w-4 mr-2" />}
              Send Offer
            </Button>
          </div>
        )}

        {/* ── Active negotiation: chat view ── */}
        {!loading && negotiation && (
          <>
            {/* Status banner */}
            {negotiation.status === "agreed" && (
              <div className="flex items-center gap-2.5 bg-green-50 border-b border-green-200 px-5 py-3 shrink-0">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Price agreed!</p>
                  <p className="text-xs text-green-700">Both parties agreed on {fmt(negotiation.agreedPrice)}</p>
                </div>
              </div>
            )}
            {negotiation.status === "rejected" && (
              <div className="flex items-center gap-2.5 bg-red-50 border-b border-red-200 px-5 py-3 shrink-0">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Negotiation ended</p>
                  <p className="text-xs text-red-600">This negotiation was declined</p>
                </div>
              </div>
            )}
            {negotiation.status === "expired" && (
              <div className="flex items-center gap-2.5 bg-amber-50 border-b border-amber-200 px-5 py-3 shrink-0">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Negotiation expired</p>
                  <p className="text-xs text-amber-700">The 48-hour window has passed</p>
                </div>
              </div>
            )}

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto min-h-0 bg-muted/30 px-4 py-4 space-y-2.5">
              {/* Service context pill */}
              <div className="flex justify-center mb-1">
                <span className="text-[11px] text-muted-foreground bg-background border rounded-full px-3 py-1">
                  Started negotiation · Listed at {fmt(negotiation.basePrice)}
                </span>
              </div>

              {messages.map((msg) => {
                const isMe = msg.senderRole === "customer"
                const isStatus = msg.type === "accept" || msg.type === "reject"

                if (isStatus) {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <span className={`text-[11px] rounded-full px-3 py-1 ${
                        msg.type === "accept"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {msg.senderName} {msg.type === "accept" ? `accepted ${fmt(msg.amount)}` : "declined"} · {format(new Date(msg.createdAt), "d MMM, h:mm a")}
                      </span>
                    </div>
                  )
                }

                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    {!isMe && (
                      <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center text-[11px] font-semibold text-accent mr-1.5 shrink-0 self-end mb-1">
                        {msg.senderName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-xs ${
                        isMe
                          ? "bg-accent text-white rounded-br-sm"
                          : "bg-white border border-border/60 rounded-bl-sm"
                      }`}
                    >
                      {msg.type !== "note" && (
                        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                          isMe ? "text-white/60" : "text-muted-foreground"
                        }`}>
                          {typeLabel(msg.type)}
                        </p>
                      )}
                      {msg.amount != null && (
                        <p className={`text-xl font-bold leading-tight ${isMe ? "text-white" : "text-foreground"}`}>
                          {fmt(msg.amount)}
                        </p>
                      )}
                      {msg.text && (
                        <p className={`text-sm mt-1 leading-snug ${isMe ? "text-white/90" : "text-foreground/80"}`}>
                          {msg.text}
                        </p>
                      )}
                      <p className={`text-[10px] mt-1.5 ${isMe ? "text-white/50" : "text-muted-foreground"}`}>
                        {format(new Date(msg.createdAt), "d MMM, h:mm a")}
                      </p>
                    </div>
                  </div>
                )
              })}

              {/* Typing / waiting indicator */}
              {negotiation.status === "open" && isAwaitingProvider && (
                <div className="flex justify-start pl-8">
                  <div className="bg-white border border-border/60 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                    <span className="text-[11px] text-muted-foreground ml-1">Waiting for {negotiation.providerName}…</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Footer */}
            <div className="border-t bg-background px-5 py-4 space-y-3 shrink-0">

              {/* Agreed: proceed to booking */}
              {negotiation.status === "agreed" && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                  onClick={() => onProceedToBooking?.(negotiation.agreedPrice!)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Book at Agreed Price · {fmt(negotiation.agreedPrice)}
                </Button>
              )}

              {/* Ended / expired: start fresh */}
              {(negotiation.status === "rejected" || negotiation.status === "expired") && (
                <Button variant="outline" className="w-full" onClick={() => setNegotiation(null)}>
                  Start a New Negotiation
                </Button>
              )}

              {/* Open, provider moved: accept / decline / counter */}
              {negotiation.status === "open" && providerJustMoved && !showCounterForm && (
                <div className="space-y-2.5">
                  <p className="text-xs text-center text-muted-foreground">
                    {negotiation.providerName} is offering <strong className="text-foreground">{fmt(lastMsg.amount)}</strong>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={submitting}
                      onClick={() => sendAction("accept", lastMsg.amount ?? undefined)}
                    >
                      {submitting
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                      Accept {fmt(lastMsg.amount)}
                    </Button>
                    <Button
                      variant="outline"
                      className="border-destructive/60 text-destructive hover:bg-destructive/5"
                      disabled={submitting}
                      onClick={() => sendAction("reject")}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Decline
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-foreground text-xs"
                    onClick={() => setShowCounterForm(true)}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
                    Send a counter-offer instead
                  </Button>
                </div>
              )}

              {/* Counter form */}
              {negotiation.status === "open" && providerJustMoved && showCounterForm && (
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-muted-foreground">Your counter-offer</p>
                  <AmountInput
                    value={counterAmount}
                    onChange={setCounterAmount}
                    placeholder="Your counter amount"
                    autoFocus
                  />
                  <Textarea
                    rows={2}
                    placeholder="Add a note (optional)"
                    value={counterNote}
                    onChange={(e) => setCounterNote(e.target.value)}
                    className="resize-none text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={submitting || !counterAmount}
                      onClick={() => {
                        const amt = parseFloat(counterAmount.replace(/[^0-9.]/g, ""))
                        if (!amt) return
                        sendAction("counter", amt, counterNote.trim() || undefined)
                      }}
                    >
                      {submitting
                        ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        : <Send className="h-4 w-4 mr-2" />}
                      Send Counter-offer
                    </Button>
                    <Button variant="ghost" onClick={() => setShowCounterForm(false)} disabled={submitting}>
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
