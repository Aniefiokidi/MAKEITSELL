import connectToDatabase from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'

const PLATFORM_AVERAGE_PRICE = 8500
const DEFAULT_FLOOR = 26
const MINIMUM_FLOOR = 4
const GMV_FLOOR = 220000

export async function calculateStreakFloor(vendorId: string): Promise<{
  floorOrderCount: number
  lowestPrice: number
  isDefaultFloor: boolean
}> {
  await connectToDatabase()

  const products = await Product.find({ vendorId, status: 'active' })
    .select('price')
    .lean() as any[]

  if (!products.length) {
    return { floorOrderCount: DEFAULT_FLOOR, lowestPrice: PLATFORM_AVERAGE_PRICE, isDefaultFloor: true }
  }

  const prices = products.map((p: any) => Number(p.price || 0)).filter(p => p > 0)
  if (!prices.length) {
    return { floorOrderCount: DEFAULT_FLOOR, lowestPrice: PLATFORM_AVERAGE_PRICE, isDefaultFloor: true }
  }

  const lowestPrice = Math.min(...prices)
  const rawFloor = Math.ceil(GMV_FLOOR / lowestPrice)
  const floorOrderCount = Math.max(rawFloor, MINIMUM_FLOOR)

  return { floorOrderCount, lowestPrice, isDefaultFloor: false }
}
