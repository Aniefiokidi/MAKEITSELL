"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Truck } from "lucide-react"

export default function RetiredFeatureNotice({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <Link href="/" className="text-sm font-medium text-accent underline underline-offset-4">
            Back to home
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
