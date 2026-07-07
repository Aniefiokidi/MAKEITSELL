"use client"

import { useEffect, useState } from "react"
import StreakWidget from "./StreakWidget"
import StreakTargetModal from "./StreakTargetModal"

export default function StreakGate() {
  const [status, setStatus] = useState<"loading" | "needs-target" | "has-target">("loading")
  const [floorOrderCount, setFloorOrderCount] = useState(5)
  const [isDefaultFloor, setIsDefaultFloor] = useState(false)

  const fetchProgress = () => {
    fetch("/api/vendor/streak", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setStatus("has-target"); return }
        setFloorOrderCount(d.floorOrderCount ?? 5)
        setIsDefaultFloor(!!d.isDefaultFloor)
        setStatus(d.hasSetTarget ? "has-target" : "needs-target")
      })
      .catch(() => setStatus("has-target"))
  }

  useEffect(() => { fetchProgress() }, [])

  if (status === "loading") return null

  if (status === "needs-target") {
    return (
      <StreakTargetModal
        floorOrderCount={floorOrderCount}
        isDefaultFloor={isDefaultFloor}
        onSuccess={() => setStatus("has-target")}
      />
    )
  }

  return <StreakWidget />
}
