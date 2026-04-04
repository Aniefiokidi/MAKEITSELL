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

    return NextResponse.json({
      user,
      userProfile: {
        uid: String(user.id),
        email: user.email,
        displayName: user.name,
        role: user.role,
        mustChangePassword: !!(user as any).mustChangePassword,
        phone: (user as any).phone,
        phoneNumber: (user as any).phone_number,
        phoneVerified: !!(user as any).phone_verified,
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
