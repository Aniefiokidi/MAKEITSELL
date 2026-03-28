"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

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

export default function HeroShuffleCarousel() {
  const [slides, setSlides] = useState<CarouselSlide[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lightImageMap, setLightImageMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const controller = new AbortController()

    const loadSlides = async () => {
      try {
        const [productsRes, servicesRes, storesRes] = await Promise.all([
          fetch("/api/database/products?limit=18", { signal: controller.signal }),
          fetch("/api/database/services?limit=18", { signal: controller.signal }),
          fetch("/api/database/stores?limit=18&sortBy=for-you", { signal: controller.signal }),
        ])

        const [productsJson, servicesJson, storesJson] = await Promise.all([
          productsRes.json(),
          servicesRes.json(),
          storesRes.json(),
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
              href: `/service/${id}`,
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
              href: `/store/${id}`,
            }
          })
          .filter(Boolean) as CarouselSlide[]

        const mixed = shuffle([...storeSlides, ...productSlides, ...serviceSlides]).slice(0, 24)
        setSlides(mixed)
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

    // Preload nearby images so the next rotation is already decoded.
    const preloadIndexes = [
      (activeIndex + 1) % slides.length,
      (activeIndex + 2) % slides.length,
      (activeIndex - 1 + slides.length) % slides.length,
    ]

    preloadIndexes.forEach((idx) => {
      const src = slides[idx]?.image
      if (!src) return
      const img = new Image()
      img.decoding = "async"
      img.src = src
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

  const detailsToneClass = (slideId: string) =>
    lightImageMap[slideId]
      ? {
          text: "text-[oklch(0.21_0.194_29.234)]",
          chip: "border-[oklch(0.21_0.194_29.234)]/40 bg-white/85 text-[oklch(0.21_0.194_29.234)]",
          button: "border-[oklch(0.21_0.194_29.234)]/50 bg-white/82 text-[oklch(0.21_0.194_29.234)] hover:bg-white",
        }
      : {
          text: "text-white",
          chip: "border-white/55 bg-black/35 text-white",
          button: "border-white/60 bg-black/35 text-white hover:bg-black/50",
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
        src="/MISHG.png"
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

          const xByOffset: Record<number, number> = {
            [-2]: -118,
            [-1]: -64,
            [0]: 0,
            [1]: 64,
            [2]: 118,
          }

          const yByOffset: Record<number, number> = {
            [-2]: -46,
            [-1]: -48,
            [0]: -50,
            [1]: -48,
            [2]: -46,
          }

          const scaleByOffset: Record<number, number> = {
            [-2]: 0.72,
            [-1]: 0.84,
            [0]: 1,
            [1]: 0.84,
            [2]: 0.72,
          }

          const rotateByOffset: Record<number, number> = {
            [-2]: -8,
            [-1]: -4,
            [0]: 0,
            [1]: 4,
            [2]: 8,
          }

          const zByOffset: Record<number, number> = {
            [-2]: 5,
            [-1]: 20,
            [0]: 30,
            [1]: 20,
            [2]: 5,
          }

          const transform = `translate3d(calc(-50% + ${xByOffset[offset] || 0}%), ${yByOffset[offset] || -50}%, 0) scale(${scaleByOffset[offset] || 1}) rotate(${rotateByOffset[offset] || 0}deg)`
          const opacity = Math.abs(offset) === 2 ? 0.15 : 1
          const pointerEvents = isActive || isSide ? "auto" : "none"

          return (
            <Link
              key={slide.id}
              href={slide.href}
              className="absolute left-1/2 top-1/2 h-[84%] w-[56%] sm:w-[52%] md:w-[46%] rounded-2xl sm:rounded-3xl overflow-hidden block transform-gpu will-change-transform will-change-opacity transition-transform duration-700 ease-[cubic-bezier(0.22,0.7,0.2,1)]"
              aria-hidden={!isActive && !isSide}
              style={{ transform, opacity, zIndex: zByOffset[offset] || 1, pointerEvents }}
            >
          <img
            src={slide.image}
            alt={slide.title}
            className="h-full w-full object-cover"
            loading={index === activeIndex ? "eager" : "lazy"}
            onLoad={(e) => detectImageTone(slide.id, e.currentTarget)}
          />
              <div className="absolute inset-0 bg-linear-to-t from-black/78 via-black/40 to-transparent" />

              {isActive && (
                <div className={`absolute left-3 right-3 sm:left-4 sm:right-4 bottom-3 sm:bottom-4 z-30 rounded-2xl border backdrop-blur-xl p-3 sm:p-4 bg-white/18 ${detailsToneClass(slide.id).text}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${detailsToneClass(slide.id).chip}`}>
                      {slide.kind}
                    </span>
                    
                  </div>
                  <h3 className="mt-2 text-base sm:text-xl font-bold leading-tight line-clamp-2 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
                    {slide.title}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm line-clamp-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">{slide.subtitle}</p>
                  <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors ${detailsToneClass(slide.id).button}`}>
                    View details
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              )}

              {!isActive && isSide && (
                <div className={`absolute left-2 right-2 bottom-2 rounded-xl border p-2 backdrop-blur-md bg-white/18 ${detailsToneClass(slide.id).text}`}>
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
