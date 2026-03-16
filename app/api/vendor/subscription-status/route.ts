import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  return NextResponse.json({
    subscriptionStatus: 'not_required',
    accountStatus: 'active',
    isActive: true,
    vendorAccess: 'free',
    message: 'Vendor subscription is not required. Vendor accounts are free.'
  })
}