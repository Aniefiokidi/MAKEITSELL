"use client"

import { useEffect, useRef, useState } from "react"
import Footer from "./Footer"

const REVEAL_OFFSET = 120

export default function FooterReveal() {
  const [visible, setVisible] = useState(false)
  const [footerHeight, setFooterHeight] = useState(0)
  const rafRef = useRef<number | null>(null)
  const footerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const measure = () => {
      if (footerRef.current) {
        setFooterHeight(footerRef.current.getBoundingClientRect().height)
      }
    }

    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(() => {
        const { scrollTop, clientHeight, scrollHeight } = document.documentElement
        const atBottom = scrollTop + clientHeight >= scrollHeight - REVEAL_OFFSET
        setVisible(atBottom)
        rafRef.current = null
      })
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <>
      <div aria-hidden style={{ height: footerHeight || 0 }} className={!footerHeight ? "h-24" : undefined} />
      <div
        ref={footerRef}
        className={`fixed inset-x-0 bottom-0 z-40 transition-all duration-500 ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <Footer />
      </div>
    </>
  )
}
