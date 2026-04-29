export type LogisticsRegionKey = 'lagos' | 'abuja'

export type LogisticsRegionConfig = {
  key: LogisticsRegionKey
  cityLabel: string
  keyword: string
  email: string
  basePath: string
  panelTitle: string
}

const REGION_CONFIG: Record<LogisticsRegionKey, LogisticsRegionConfig> = {
  lagos: {
    key: 'lagos',
    cityLabel: 'Lagos',
    keyword: 'lagos',
    email: 'A&CO@makeitselll.org',
    basePath: '/logistics',
    panelTitle: 'A&CO Lagos Logistics',
  },
  abuja: {
    key: 'abuja',
    cityLabel: 'Abuja',
    keyword: 'abuja',
    email: 'Orahlogistics@gmail.com',
    basePath: '/logistics/abuja',
    panelTitle: 'Orah Abuja Logistics',
  },
}

export function resolveLogisticsRegion(region: unknown): LogisticsRegionConfig {
  const normalized = String(region || '').trim().toLowerCase()
  if (normalized === 'abuja') return REGION_CONFIG.abuja
  return REGION_CONFIG.lagos
}

export function getLogisticsRegionConfig(key: LogisticsRegionKey): LogisticsRegionConfig {
  return REGION_CONFIG[key]
}

export function logisticsEmailAllowedForRegion(email: unknown, region: LogisticsRegionConfig): boolean {
  if (!email) return false
  return String(email).trim().toLowerCase() === region.email.toLowerCase()
}

export function storeMatchesLogisticsRegion(store: any, region: LogisticsRegionConfig): boolean {
  const keyword = region.keyword.toLowerCase()
  const values = [store?.city, store?.state, store?.address]
  return values.some((value) => String(value || '').toLowerCase().includes(keyword))
}
