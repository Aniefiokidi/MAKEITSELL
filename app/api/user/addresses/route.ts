import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { SavedAddress } from '@/lib/models/SavedAddress'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, addresses: [] })
  }
  await connectToDatabase()
  const doc = await SavedAddress.findOne({ userId: sessionUser.id }).lean()
  return NextResponse.json({ success: true, addresses: (doc as any)?.addresses || [] })
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { label, firstName, lastName, phoneCountryCode, phone, address, city, state, zipCode, deliveryInstructions, isDefault } = body

  if (!label || !address || !city || !state) {
    return NextResponse.json({ success: false, error: 'label, address, city, and state are required' }, { status: 400 })
  }

  await connectToDatabase()

  const existing = await SavedAddress.findOne({ userId: sessionUser.id }).select('addresses').lean()
  const hasNone = !existing || (existing as any).addresses.length === 0
  const makeDefault = Boolean(isDefault) || hasNone

  if (makeDefault) {
    // Unset any existing default before this one becomes it — a user only ever has one
    // default address at a time, used to pre-select the checkout picker.
    await SavedAddress.updateOne(
      { userId: sessionUser.id },
      { $set: { 'addresses.$[].isDefault': false } }
    )
  }

  await SavedAddress.updateOne(
    { userId: sessionUser.id },
    {
      $push: {
        addresses: {
          $each: [{
            label: String(label).trim(),
            firstName: firstName || '',
            lastName: lastName || '',
            phoneCountryCode: phoneCountryCode || '+234',
            phone: phone || '',
            address: String(address).trim(),
            city: String(city).trim(),
            state: String(state).trim(),
            zipCode: zipCode || '',
            deliveryInstructions: deliveryInstructions || '',
            isDefault: makeDefault,
            createdAt: new Date(),
          }],
          $position: 0,
        },
      },
    },
    { upsert: true }
  )

  const updated = await SavedAddress.findOne({ userId: sessionUser.id }).select('addresses').lean()
  return NextResponse.json({ success: true, addresses: (updated as any)?.addresses || [] })
}
