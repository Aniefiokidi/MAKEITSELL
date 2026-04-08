import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getUserBySessionToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('sessionToken')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ user: null, success: false }, { status: 401 });
    }

    const user = await getUserBySessionToken(sessionToken);
    
    if (!user) {
      return NextResponse.json({ user: null, success: false }, { status: 401 });
    }

    const resolvedPhone =
      (user as any).phone ||
      (user as any).phone_number ||
      (user as any).phoneNumber ||
      (user as any).vendorInfo?.phone ||
      (user as any).vendorInfo?.phone_number ||
      ''

    const resolvedPhoneNumber =
      (user as any).phone_number ||
      (user as any).phone ||
      (user as any).phoneNumber ||
      (user as any).vendorInfo?.phone_number ||
      (user as any).vendorInfo?.phone ||
      ''

    const resolvedPhoneVerified = Boolean((user as any).phone_verified || (user as any).phoneVerified)

    return NextResponse.json({
      user,
      userProfile: {
        uid: String(user.id),
        email: user.email,
        displayName: user.name,
        role: user.role,
        mustChangePassword: !!(user as any).mustChangePassword,
        phone: resolvedPhone,
        phoneNumber: resolvedPhoneNumber,
        phoneVerified: resolvedPhoneVerified,
        address: (user as any).address,
        city: (user as any).city,
        state: (user as any).state,
        postalCode: (user as any).postalCode,
        vendorType: user.role === 'vendor' ? user.vendorType : undefined,
        walletBalance: typeof user.walletBalance === 'number' ? user.walletBalance : 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      success: true
    }, { status: 200 });
  } catch (error: any) {
    console.error('[/api/auth/me] Error:', error);
    return NextResponse.json({ user: null, success: false, error: error?.message }, { status: 500 });
  }
}
