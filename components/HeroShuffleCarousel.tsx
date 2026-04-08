"use client"

import { useEffect, useRef, useState, type SyntheticEvent } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buildPublicServicePath, buildPublicStorePath } from "@/lib/public-links"

type SlideKind = "store" | "product" | "service"

type CarouselSlide = {
  id: string
  kind: SlideKind
  title: string
  subtitle: string
  image: string
  href: string
}

const INVALID_IMAGE_PATTERN = /(placeholder|default|no[-_ ]?image|avatar-default|image-not-found)/i
const HERO_CAROUSEL_CACHE_KEY = "mis:hero-carousel:v1"
const FALLBACK_IMAGE = "/MISHG.png"
const X_PX_BY_OFFSET: Record<number, number> = { [-2]: -250, [-1]: -135, [0]: 0, [1]: 135, [2]: 250 }
const Y_BY_OFFSET: Record<number, number> = { [-2]: -46, [-1]: -48, [0]: -50, [1]: -48, [2]: -46 }
const SCALE_BY_OFFSET: Record<number, number> = { [-2]: 0.72, [-1]: 0.84, [0]: 1, [1]: 0.84, [2]: 0.72 }
const ROTATE_BY_OFFSET: Record<number, number> = { [-2]: -8, [-1]: -4, [0]: 0, [1]: 4, [2]: 8 }
const Z_BY_OFFSET: Record<number, number> = { [-2]: 5, [-1]: 20, [0]: 30, [1]: 20, [2]: 5 }

function hasValidImage(value: unknown): value is string {
  if (typeof value !== "string") return false
  const normalized = value.trim()
  if (!normalized) return false
  return !INVALID_IMAGE_PATTERN.test(normalized)
}

function firstValidImage(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const nested = firstValidImage(candidate)
      if (nested) return nested
      continue
    }

    if (hasValidImage(candidate)) {
      return candidate.trim()
    }
  }

  return null
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function isCarouselSlide(value: any): value is CarouselSlide {
  return (
    !!value &&
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    typeof value.title === "string" &&
    typeof value.subtitle === "string" &&
    typeof value.image === "string" &&
    typeof value.href === "string"
  )
}

function readCachedSlides(): CarouselSlide[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.sessionStorage.getItem(HERO_CAROUSEL_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCarouselSlide)
  } catch {
    return []
  }
}

async function verifyImageLoad(src: string, timeoutMs = 7000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    let settled = false

    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }

    const timeout = window.setTimeout(() => done(false), timeoutMs)
    img.onload = () => {
      window.clearTimeout(timeout)
      done(true)
    }
    img.onerror = () => {
      window.clearTimeout(timeout)
      done(false)
    }
    img.src = src
  })
}

async function fetchJsonWithTimeout(url: string, signal: AbortSignal, timeoutMs = 12000) {
  let timeoutHandle: number | undefined
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = window.setTimeout(() => reject(new Error("Request timed out")), timeoutMs)
    })

    const response = (await Promise.race([
      fetch(url, { signal }),
      timeoutPromise,
    ])) as Response

    return await response.json()
  } finally {
    if (timeoutHandle) window.clearTimeout(timeoutHandle)
  }
}

export default function HeroShuffleCarousel() {
  const [slides, setSlides] = useState<CarouselSlide[]>(() => readCachedSlides())
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(() => readCachedSlides().length === 0)
  const [lightImageMap, setLightImageMap] = useState<Record<string, boolean>>({})
  const warmedImagesRef = useRef<Set<string>>(new Set())

  const warmImage = (src?: string) => {
    if (!src || warmedImagesRef.current.has(src)) return
    warmedImagesRef.current.add(src)

    const img = new Image()
    img.decoding = "async"
    img.src = src
    if (typeof img.decode === "function") {
      img.decode().catch(() => {
        // Ignore decode failures; runtime onError handles true failures.
      })
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    const loadSlides = async () => {
      try {
        const [productsJson, servicesJson, storesJson] = await Promise.all([
          fetchJsonWithTimeout("/api/database/products?limit=18", controller.signal),
          fetchJsonWithTimeout("/api/database/services?limit=18", controller.signal),
          fetchJsonWithTimeout("/api/database/stores?limit=18&sortBy=for-you", controller.signal),
        ])

        const products = Array.isArray(productsJson?.data) ? productsJson.data : []
        const services = Array.isArray(servicesJson?.data) ? servicesJson.data : []
        const stores = Array.isArray(storesJson?.data) ? storesJson.data : []

        const productSlides: CarouselSlide[] = products
          .map((product: any) => {
            const image = firstValidImage([
              product?.images,
              product?.image,
              product?.imageUrl,
              product?.thumbnail,
            ])

            if (!image) return null

            const id = String(product?.id || product?._id || "").trim()
            if (!id) return null

            return {
              id: `product-${id}`,
              kind: "product" as const,
              title: String(product?.title || product?.name || "Featured Product"),
              subtitle: String(product?.category || product?.storeName || "Top Product"),
              image,
              href: `/products/${id}`,
            }
          })
          .filter(Boolean) as CarouselSlide[]

        const serviceSlides: CarouselSlide[] = services
          .map((service: any) => {
            const image = firstValidImage([
              service?.images,
              service?.image,
              service?.imageUrl,
              service?.thumbnail,
            ])

            if (!image) return null

            const id = String(service?.id || service?._id || "").trim()
            if (!id) return null

            return {
              id: `service-${id}`,
              kind: "service" as const,
              title: String(service?.title || service?.name || "Featured Service"),
              subtitle: String(service?.category || service?.providerName || "Top Service"),
              image,
              href: buildPublicServicePath(service),
            }
          })
          .filter(Boolean) as CarouselSlide[]

        const storeSlides: CarouselSlide[] = stores
          .map((store: any) => {
            const hasLogoOrProfileCard =
              hasValidImage(store?.logoImage) ||
              hasValidImage(store?.profileImage) ||
              hasValidImage(store?.storeImage) ||
              hasValidImage(store?.logo)

            if (!hasLogoOrProfileCard) return null

            const image = firstValidImage([
              store?.bannerImage,
              store?.profileImage,
              store?.logoImage,
              store?.storeImage,
              store?.logo,
              store?.bannerImages,
            ])

            if (!image) return null

            const id = String(store?.id || store?._id || "").trim()
            if (!id) return null

            return {
              id: `store-${id}`,
              kind: "store" as const,
              title: String(store?.name || store?.storeName || "Featured Store"),
              subtitle: String(store?.city || store?.state || "Top Store"),
              image,
              href: buildPublicStorePath(store),
            }
          })
          .filter(Boolean) as CarouselSlide[]

        const mixed = shuffle([...storeSlides, ...productSlides, ...serviceSlides]).slice(0, 24)

        const finalSlides =
          mixed.length > 0
            ? mixed
            : [
                {
                  id: "fallback-hero",
                  kind: "store" as const,
                  title: "Make It Sell",
                  subtitle: "Discover products, services and stores",
                  image: FALLBACK_IMAGE,
                  href: "/stores",
                },
              ]

        setSlides(finalSlides)
        finalSlides.slice(0, 10).forEach((slide) => warmImage(slide.image))
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(HERO_CAROUSEL_CACHE_KEY, JSON.stringify(finalSlides))
        }
      } catch {
        setSlides([])
      } finally {
        setLoading(false)
      }
    }

    loadSlides()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (slides.length <= 1) return

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length)
    }, 3400)

    return () => window.clearInterval(timer)
  }, [slides])

  useEffect(() => {
    if (!slides.length) return

    // Warm nearby images so transitions stay smooth.
    const preloadIndexes = [
      (activeIndex + 1) % slides.length,
      (activeIndex + 2) % slides.length,
      (activeIndex + 3) % slides.length,
      (activeIndex - 1 + slides.length) % slides.length,
    ]

    preloadIndexes.forEach((idx) => {
      const src = slides[idx]?.image
      warmImage(src)
    })
  }, [activeIndex, slides])

  useEffect(() => {
    if (activeIndex < slides.length) return
    setActiveIndex(0)
  }, [activeIndex, slides.length])

  const getRelativeOffset = (index: number) => {
    const total = slides.length
    if (!total) return 0

    let diff = index - activeIndex
    if (diff > total / 2) diff -= total
    if (diff < -total / 2) diff += total
    return diff
  }

  const detectImageTone = (slideId: string, img: HTMLImageElement) => {
    if (lightImageMap[slideId] !== undefined) return

    try {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const sampleWidth = 18
      const sampleHeight = 18
      canvas.width = sampleWidth
      canvas.height = sampleHeight
      ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight)

      const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight)
      let totalLuminance = 0
      const pixelCount = data.length / 4

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b
      }

      const avgLuminance = totalLuminance / pixelCount
      setLightImageMap((current) => ({ ...current, [slideId]: avgLuminance >= 165 }))
    } catch {
      // Cross-origin images may block canvas reads; default to high-contrast white text.
      setLightImageMap((current) => ({ ...current, [slideId]: false }))
    }
  }

  const handleSlideImageError = (slideId: string, event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.visibility = "hidden"

    setSlides((current) => {
      const failedIndex = current.findIndex((slide) => slide.id === slideId)
      if (failedIndex === -1) return current

      const nextSlides = current.filter((slide) => slide.id !== slideId)

      setActiveIndex((prev) => {
        if (!nextSlides.length) return 0
        if (prev > failedIndex) return prev - 1
        if (prev === failedIndex) return prev % nextSlides.length
        return prev
      })

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(HERO_CAROUSEL_CACHE_KEY, JSON.stringify(nextSlides))
      }

      return nextSlides
    })
  }

  const frameClass =
    "w-full max-w-[620px] sm:max-w-[700px] md:max-w-[820px] lg:max-w-[900px] xl:max-w-[980px] h-[clamp(380px,96vw,560px)] sm:h-[clamp(320px,54vw,500px)] md:h-[clamp(340px,45vw,560px)] lg:h-[clamp(360px,40vw,620px)]"

  if (loading) {
    return (
      <div className={`${frameClass} rounded-2xl bg-white/60 border border-white/60 animate-pulse mx-auto`} />
    )
  }

  if (!slides.length) {
    return (
      <img
        src={FALLBACK_IMAGE}
        alt="MakeItSell Logo"
        className={`${frameClass} rounded-xl object-cover mx-auto`}
      />
    )
  }

  return (
    <div className={`${frameClass} relative rounded-2xl sm:rounded-3xl overflow-hidden   mx-auto`}>
      {slides.map((slide, index) => (
        (() => {
          const offset = getRelativeOffset(index)
          const isActive = offset === 0
          const isSide = Math.abs(offset) === 1
          const isNear = Math.abs(offset) <= 2

          if (!isNear) return null

          const transform = `translate(-50%, ${Y_BY_OFFSET[offset] || -50}%) translateX(${X_PX_BY_OFFSET[offset] || 0}px) scale(${SCALE_BY_OFFSET[offset] || 1}) rotate(${ROTATE_BY_OFFSET[offset] || 0}deg)`
          const opacity = Math.abs(offset) === 2 ? 0.15 : 1
          const pointerEvents = isActive || isSide ? "auto" : "none"

          return (
            <Link
              key={slide.id}
              href={slide.href}
              className="absolute left-1/2 top-1/2 h-[84%] w-[56%] sm:w-[52%] md:w-[46%] rounded-2xl sm:rounded-3xl overflow-hidden block transform-gpu will-change-transform will-change-opacity transition-[transform,opacity] duration-600 ease-[cubic-bezier(0.22,0.7,0.2,1)]"
              aria-hidden={!isActive && !isSide}
              style={{ transform, opacity, zIndex: Z_BY_OFFSET[offset] || 1, pointerEvents, backfaceVisibility: "hidden" }}
            >
          <img
            src={slide.image}
            alt={slide.title}
            className="h-full w-full object-cover"
            loading={index === activeIndex ? "eager" : "lazy"}
            onLoad={(e) => detectImageTone(slide.id, e.currentTarget)}
            onError={(e) => handleSlideImageError(slide.id, e)}
          />
              <div className="absolute inset-0 bg-linear-to-t from-black/78 via-black/40 to-transparent" />

              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5 md:p-3 backdrop-blur-xl bg-accent/10 border border-white/30 rounded-2xl sm:rounded-3xl z-30 space-y-1 gap-1 sm:gap-2">
                  <Badge
                    variant="outline"
                    className="inline-flex w-full text-[10px] sm:text-xs md:text-sm font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 shadow hover:opacity-90 transition min-h-5 sm:min-h-6 items-center justify-center text-center leading-tight bg-accent text-white"
                    style={{
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                      hyphens: "auto",
                      lineHeight: "1.2",
                    }}
                  >
                    <span className="line-clamp-2 sm:line-clamp-1">{slide.title}</span>
                  </Badge>

                  <div className="flex items-center justify-between gap-1 sm:gap-2">
                    <Badge
                      variant="outline"
                      className="text-[9px] sm:text-[10px] md:text-xs backdrop-blur-sm border-white/50 px-1 sm:px-1.5 py-0 text-white bg-accent"
                    >
                      {slide.subtitle}
                    </Badge>

                    <Badge
                      variant="outline"
                      className="text-[9px] sm:text-[10px] md:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 backdrop-blur-sm bg-white/70 text-accent uppercase"
                    >
                      {slide.kind}
                    </Badge>
                  </div>

                  <span className="w-full h-6 sm:h-7 md:h-8 text-[10px] sm:text-xs md:text-xs backdrop-blur-sm hover:scale-105 active:scale-95 transition-all hover:shadow-lg flex items-center justify-center gap-0 bg-white/50 hover:bg-white text-black rounded-md">
                    <img src="/images/logo3.png" alt="View" className="w-6 sm:w-7 md:w-8 h-6 sm:h-7 md:h-8 -mt-1 sm:-mt-2" />
                    <span className="leading-none text-accent inline-flex items-center gap-1">View details <ArrowUpRight className="h-3.5 w-3.5" /></span>
                  </span>
                </div>
              )}

              {!isActive && isSide && (
                <div className="absolute left-2 right-2 bottom-2 rounded-xl border border-white/30 p-2 backdrop-blur-md bg-accent/15 text-white">
                  <p className="text-[10px] font-semibold line-clamp-1">{slide.title}</p>
                </div>
              )}
            </Link>
          )
        })()
      ))}

      <div className="absolute left-3 right-3 top-3 z-30 flex items-center justify-center gap-1.5 sm:left-4 sm:right-4 sm:top-4">
        {slides.slice(0, 6).map((slide, index) => {
          const isActive = index === activeIndex % Math.max(slides.length, 1)
          return (
            <span
              key={`dot-${slide.id}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${isActive ? "w-7 bg-white" : "w-3 bg-white/45"}`}
            />
          )
        })}
      </div>
    </div>
  )
}
