type BusyRange = {
  start: Date
  end: Date
}

function parseIcsDate(value: string): Date | null {
  const raw = String(value || "").trim()
  if (!raw) return null

  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    const year = Number(raw.slice(0, 4))
    const month = Number(raw.slice(4, 6)) - 1
    const day = Number(raw.slice(6, 8))
    const hour = Number(raw.slice(9, 11))
    const minute = Number(raw.slice(11, 13))
    const second = Number(raw.slice(13, 15))
    return new Date(Date.UTC(year, month, day, hour, minute, second))
  }

  if (/^\d{8}T\d{6}$/.test(raw)) {
    const year = Number(raw.slice(0, 4))
    const month = Number(raw.slice(4, 6)) - 1
    const day = Number(raw.slice(6, 8))
    const hour = Number(raw.slice(9, 11))
    const minute = Number(raw.slice(11, 13))
    const second = Number(raw.slice(13, 15))
    return new Date(year, month, day, hour, minute, second)
  }

  if (/^\d{8}$/.test(raw)) {
    const year = Number(raw.slice(0, 4))
    const month = Number(raw.slice(4, 6)) - 1
    const day = Number(raw.slice(6, 8))
    return new Date(year, month, day, 0, 0, 0, 0)
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseIcsBusyRanges(icsText: string): BusyRange[] {
  const lines = icsText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())

  const events: BusyRange[] = []
  let dtStart: Date | null = null
  let dtEnd: Date | null = null

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      dtStart = null
      dtEnd = null
      continue
    }

    if (line.startsWith("DTSTART")) {
      const value = line.split(":").slice(1).join(":")
      dtStart = parseIcsDate(value)
      continue
    }

    if (line.startsWith("DTEND")) {
      const value = line.split(":").slice(1).join(":")
      dtEnd = parseIcsDate(value)
      continue
    }

    if (line === "END:VEVENT") {
      if (dtStart && dtEnd && dtEnd.getTime() > dtStart.getTime()) {
        events.push({ start: dtStart, end: dtEnd })
      }
      dtStart = null
      dtEnd = null
    }
  }

  return events
}

export async function getIcsBusyRanges(params: {
  icsUrl?: string
  from: Date
  to: Date
}): Promise<BusyRange[]> {
  const { icsUrl, from, to } = params
  if (!icsUrl) return []

  try {
    const response = await fetch(icsUrl, {
      method: "GET",
      headers: {
        Accept: "text/calendar,text/plain,*/*",
      },
      next: { revalidate: 120 },
    })

    if (!response.ok) {
      return []
    }

    const text = await response.text()
    const parsed = parseIcsBusyRanges(text)
    const fromTime = from.getTime()
    const toTime = to.getTime()

    return parsed.filter((range) => {
      const start = range.start.getTime()
      const end = range.end.getTime()
      return start < toTime && end > fromTime
    })
  } catch {
    return []
  }
}

export function hasBusyOverlap(params: {
  busyRanges: BusyRange[]
  start: Date
  end: Date
}): boolean {
  const { busyRanges, start, end } = params
  const startMs = start.getTime()
  const endMs = end.getTime()

  return busyRanges.some((range) => {
    const busyStart = range.start.getTime()
    const busyEnd = range.end.getTime()
    return startMs < busyEnd && endMs > busyStart
  })
}

export type { BusyRange }
