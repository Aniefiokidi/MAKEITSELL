import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { BidListing } from '@/lib/models/BidListing'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, context: Params) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, any> = {}

    if (typeof body?.status === 'string' && ['draft', 'live', 'closed'].includes(body.status)) {
      patch.status = body.status
    }
    if (typeof body?.featured === 'boolean') {
      patch.featured = body.featured
    }
    if (body?.endsAt) {
      const parsedEnd = new Date(body.endsAt)
      if (!Number.isNaN(parsedEnd.getTime())) {
        patch.endsAt = parsedEnd
      }
    }

    await connectToDatabase()
    const listing = await BidListing.findByIdAndUpdate(id, { $set: patch }, { new: true })
    if (!listing) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, listing })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update listing' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: Params) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { id } = await context.params
    await connectToDatabase()
    const deleted = await BidListing.findByIdAndDelete(id)
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to delete listing' }, { status: 500 })
  }
}
