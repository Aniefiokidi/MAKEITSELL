import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { SavedAddress } from '@/lib/models/SavedAddress'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { label, firstName, lastName, phoneCountryCode, phone, address, city, state, zipCode, deliveryInstructions, isDefault } = body

  await connectToDatabase()

  if (isDefault === true) {
    // Only one default at a time — clear it on every other address before setting it here.
    await SavedAddress.updateOne(
      { userId: sessionUser.id },
      { $set: { 'addresses.$[].isDefault': false } }
    )
  }

  const setFields: Record<string, any> = {}
  if (label !== undefined) setFields['addresses.$.label'] = String(label).trim()
  if (firstName !== undefined) setFields['addresses.$.firstName'] = firstName
  if (lastName !== undefined) setFields['addresses.$.lastName'] = lastName
  if (phoneCountryCode !== undefined) setFields['addresses.$.phoneCountryCode'] = phoneCountryCode
  if (phone !== undefined) setFields['addresses.$.phone'] = phone
  if (address !== undefined) setFields['addresses.$.address'] = String(address).trim()
  if (city !== undefined) setFields['addresses.$.city'] = String(city).trim()
  if (state !== undefined) setFields['addresses.$.state'] = String(state).trim()
  if (zipCode !== undefined) setFields['addresses.$.zipCode'] = zipCode
  if (deliveryInstructions !== undefined) setFields['addresses.$.deliveryInstructions'] = deliveryInstructions
  if (isDefault !== undefined) setFields['addresses.$.isDefault'] = Boolean(isDefault)

  const result = await SavedAddress.updateOne(
    { userId: sessionUser.id, 'addresses._id': id },
    { $set: setFields }
  )

  if (result.matchedCount === 0) {
    return NextResponse.json({ success: false, error: 'Address not found' }, { status: 404 })
  }

  const updated = await SavedAddress.findOne({ userId: sessionUser.id }).select('addresses').lean()
  return NextResponse.json({ success: true, addresses: (updated as any)?.addresses || [] })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  await connectToDatabase()

  const before: any = await SavedAddress.findOne({ userId: sessionUser.id }).select('addresses').lean()
  const removed = before?.addresses?.find((a: any) => String(a._id) === id)

  await SavedAddress.updateOne(
    { userId: sessionUser.id },
    { $pull: { addresses: { _id: id } } }
  )

  // If the deleted address was the default and others remain, promote the
  // most-recently-added remaining one so there's always a default when possible —
  // otherwise the checkout picker has nothing pre-selected for no good reason.
  if (removed?.isDefault) {
    const after: any = await SavedAddress.findOne({ userId: sessionUser.id }).select('addresses').lean()
    const remaining = after?.addresses || []
    if (remaining.length > 0) {
      await SavedAddress.updateOne(
        { userId: sessionUser.id, 'addresses._id': remaining[0]._id },
        { $set: { 'addresses.$.isDefault': true } }
      )
    }
  }

  const updated = await SavedAddress.findOne({ userId: sessionUser.id }).select('addresses').lean()
  return NextResponse.json({ success: true, addresses: (updated as any)?.addresses || [] })
}
