"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, ArrowLeftRight, Send, Clock } from "lucide-react"
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

function fmt(n: number | null) {
  if (!n) return "—"
  return `₦${Number(n).toLocaleString("en-NG")}`
}

function typeLabel(type: NegotiationMessage["type"]) {
  return type === "offer" ? "Opening offer" :
    type === "counter" ? "Counter-offer" :
    type === "accept" ? "Accepted" :
    type === "reject" ? "Declined" : ""
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

  // Form state
  const [offerAmount, setOfferAmount] = useState("")
  const [offerNote, setOfferNote] = useState("")
  const [counterAmount, setCounterAmount] = useState("")
  const [counterNote, setCounterNote] = useState("")
  const [showCounterForm, setShowCounterForm] = useState(false)

  // Fetch existing negotiation on open
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

  // Poll every 8s when negotiation is open
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

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [negotiation?.messages])

  async function startNegotiation() {
    const amt = parseFloat(offerAmount.replace(/[^0-9.]/g, ""))
    if (!amt || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
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
          // Already has open negotiation — load it
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

  async function sendAction(type: "accept" | "reject" | "counter" | "note", amount?: number, text?: string) {
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

  // Determine context from the perspective of the currently logged-in user (customer)
  const messages = negotiation?.messages || []
  const lastMsg = messages[messages.length - 1]
  const isAwaitingProvider = lastMsg?.senderRole === "customer"
  const providerJustMoved =
    lastMsg?.senderRole === "provider" &&
    (lastMsg.type === "offer" || lastMsg.type === "counter")

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg w-full p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">Negotiate Price</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
            {serviceName}
            {" · "}
            <span className="font-medium text-foreground">Listed: {fmt(basePrice)}</span>
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !negotiation ? (
          /* ── No active negotiation: show opening offer form ── */
          <div className="p-5 space-y-4 flex-1 overflow-y-auto">
            <div className="rounded-lg bg-accent/5 border border-accent/20 p-4 text-sm text-muted-foreground leading-relaxed">
              Propose a price to the provider. They'll receive a notification and can accept, counter, or decline.
              Negotiations expire after 48 hours.
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Your proposed price</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">₦</span>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 45000"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="flex-1"
                />
              </div>

              <label className="text-sm font-medium">Message to provider <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Textarea
                rows={3}
                placeholder="e.g. I can only budget this amount for now..."
                value={offerNote}
                onChange={(e) => setOfferNote(e.target.value)}
                className="resize-none"
              />
            </div>

            <Button
              className="w-full"
              onClick={startNegotiation}
              disabled={submitting || !offerAmount}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Offer
            </Button>
          </div>
        ) : (
          /* ── Active negotiation: chat view ── */
          <>
            {/* Status banner */}
            {negotiation.status === "agreed" && (
              <div className="flex items-center gap-2 bg-green-50 border-b border-green-200 px-5 py-3 shrink-0">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-sm font-semibold text-green-800">
                  Price agreed at <span className="text-green-700">{fmt(negotiation.agreedPrice)}</span>
                </p>
              </div>
            )}
            {negotiation.status === "rejected" && (
              <div className="flex items-center gap-2 bg-red-50 border-b border-red-200 px-5 py-3 shrink-0">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm font-semibold text-red-700">Negotiation ended</p>
              </div>
            )}
            {negotiation.status === "expired" && (
              <div className="flex items-center gap-2 bg-yellow-50 border-b border-yellow-200 px-5 py-3 shrink-0">
                <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
                <p className="text-sm font-semibold text-yellow-800">This negotiation has expired</p>
              </div>
            )}

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
              {messages.map((msg) => {
                const isMe = msg.senderRole === "customer"
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${
                        isMe
                          ? "bg-accent text-white rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      }`}
                    >
                      {msg.type !== "note" && (
                        <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
                          {typeLabel(msg.type)}
                        </p>
                      )}
                      {msg.amount != null && (
                        <p className={`text-lg font-bold leading-tight ${isMe ? "text-white" : "text-foreground"}`}>
                          {fmt(msg.amount)}
                        </p>
                      )}
                      {msg.text && (
                        <p className={`text-sm mt-0.5 leading-snug ${isMe ? "text-white/90" : "text-foreground/80"}`}>
                          {msg.text}
                        </p>
                      )}
                      <p className={`text-[10px] mt-1.5 ${isMe ? "text-white/50" : "text-muted-foreground"}`}>
                        {msg.senderName} · {format(new Date(msg.createdAt), "d MMM, h:mm a")}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Footer actions */}
            <div className="border-t px-5 py-4 space-y-3 shrink-0">
              {negotiation.status === "agreed" && (
                <Button
                  className="w-full"
                  onClick={() => onProceedToBooking?.(negotiation.agreedPrice!)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Proceed to Booking at {fmt(negotiation.agreedPrice)}
                </Button>
              )}

              {negotiation.status === "rejected" && (
                <Button variant="outline" className="w-full" onClick={() => setNegotiation(null)}>
                  Start a New Negotiation
                </Button>
              )}

              {negotiation.status === "expired" && (
                <Button variant="outline" className="w-full" onClick={() => setNegotiation(null)}>
                  Start a New Negotiation
                </Button>
              )}

              {negotiation.status === "open" && isAwaitingProvider && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  Waiting for {negotiation.providerName} to respond…
                </div>
              )}

              {negotiation.status === "open" && providerJustMoved && !showCounterForm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {negotiation.providerName} offered <strong>{fmt(lastMsg.amount)}</strong>. How would you like to respond?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      disabled={submitting}
                      onClick={() => sendAction("accept", lastMsg.amount ?? undefined)}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      Accept {fmt(lastMsg.amount)}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                      disabled={submitting}
                      onClick={() => sendAction("reject")}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setShowCounterForm(true)}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
                    Send a counter-offer instead
                  </Button>
                </div>
              )}

              {negotiation.status === "open" && (providerJustMoved && showCounterForm || isAwaitingProvider) && (
                <div className="space-y-2">
                  {showCounterForm && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground shrink-0">₦</span>
                        <Input
                          type="number"
                          min={1}
                          placeholder="Your counter amount"
                          value={counterAmount}
                          onChange={(e) => setCounterAmount(e.target.value)}
                        />
                      </div>
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
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                          Send Counter-offer
                        </Button>
                        <Button variant="ghost" onClick={() => setShowCounterForm(false)} disabled={submitting}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
