import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { applyNegotiationAction } from '@/lib/negotiation-service'

// POST /api/services/negotiate/[id]/action
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, amount, text } = body
  const { id } = await params

  const result = await applyNegotiationAction({
    negotiationId: id,
    actorId: user.id,
    actorName: user.name,
    type,
    amount: amount != null ? Number(amount) : null,
    text,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, ...(result.negotiation ? { negotiation: result.negotiation } : {}) },
      { status: result.status }
    )
  }

  return NextResponse.json({ negotiation: result.negotiation })
}
