export type LogisticsRegionKey = 'lagos' | 'abuja'

export type LogisticsRegionConfig = {
  key: LogisticsRegionKey
  cityLabel: string
  keyword: string
  email: string
  notificationEmail: string
  basePath: string
  panelTitle: string
}

const REGION_CONFIG: Record<LogisticsRegionKey, LogisticsRegionConfig> = {
  lagos: {
    key: 'lagos',
    cityLabel: 'Lagos',
    keyword: 'lagos',
    email: 'A&CO@makeitselll.org',
    notificationEmail: 'Kingmishi456@gmail.com',
    basePath: '/logistics',
    panelTitle: 'A&CO Lagos Logistics',
  },
  abuja: {
    key: 'abuja',
    cityLabel: 'Abuja',
    keyword: 'abuja',
    email: 'Orahlogistics@gmail.com',
    notificationEmail: 'Orahlogistics@gmail.com',
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

export function detectLogisticsRegionFromAddress(city: unknown, state: unknown): LogisticsRegionConfig | null {
  const haystack = `${String(city || '')} ${String(state || '')}`.toLowerCase()
  for (const config of Object.values(REGION_CONFIG)) {
    if (haystack.includes(config.keyword)) return config
  }
  return null
}
