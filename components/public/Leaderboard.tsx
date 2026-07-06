'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trophy, Medal, Award, Store } from 'lucide-react'

interface LeaderboardEntry {
  rank: number
  storeName: string
  category: string
  vendorId: string
  isLastChampion: boolean
}

interface LeaderboardData {
  success: boolean
  data: LeaderboardEntry[]
  isLastMonth: boolean
}

const RANK_STYLES: Record<number, { bg: string; text: string; icon: React.ReactNode }> = {
  1: { bg: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-700', icon: <Trophy className="h-4 w-4 text-yellow-500" /> },
  2: { bg: 'bg-gray-50 border-gray-300', text: 'text-gray-600', icon: <Medal className="h-4 w-4 text-gray-400" /> },
  3: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-600', icon: <Award className="h-4 w-4 text-orange-400" /> },
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    goods: 'Products',
    services: 'Services',
    both: 'Products & Services',
    food: 'Food',
    general: 'General',
  }
  return map[cat] || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'General')
}

export function Leaderboard() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [isLastMonth, setIsLastMonth] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/public/leaderboard')
      .then((r) => r.json())
      .then((res: LeaderboardData) => {
        if (res.success) {
          setData(res.data.slice(0, 10))
          setIsLastMonth(res.isLastMonth)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section className="py-10 sm:py-14">
        <div className="container mx-auto px-4 sm:px-8">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (data.length === 0) return null

  return (
    <section className="py-10 sm:py-14 bg-white">
      <div className="container mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              {isLastMonth ? "Last Month's Champions" : "This Month's Top Sellers"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {isLastMonth
                ? 'Our best-performing stores from last month'
                : 'The highest-selling stores on Make It Sell right now'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {data.map((entry) => {
            const style = RANK_STYLES[entry.rank] ?? {
              bg: 'bg-white border-gray-200',
              text: 'text-gray-500',
              icon: <Store className="h-4 w-4 text-gray-400" />,
            }
            return (
              <div
                key={entry.vendorId}
                className={`relative rounded-xl border p-4 flex flex-col gap-2 transition-shadow hover:shadow-md ${style.bg}`}
              >
                {/* Rank badge */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wide ${style.text} flex items-center gap-1`}>
                    {style.icon}
                    #{entry.rank}
                  </span>
                  {entry.isLastChampion && (
                    <span className="text-[10px] font-semibold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full border border-yellow-300">
                      Champion
                    </span>
                  )}
                </div>

                {/* Store name */}
                <p className="font-semibold text-neutral-900 text-sm leading-snug line-clamp-2">
                  {entry.storeName}
                </p>

                {/* Category + Shop Now */}
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs text-muted-foreground">{categoryLabel(entry.category)}</span>
                  <Link
                    href={`/stores?vendor=${entry.vendorId}`}
                    className="text-xs font-medium text-[#E31E24] hover:underline"
                  >
                    Shop Now
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-right">Updated every 5 minutes</p>
      </div>
    </section>
  )
}
