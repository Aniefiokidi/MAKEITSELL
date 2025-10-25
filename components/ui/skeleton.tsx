import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-gray-500/50 animate-pulse rounded-md backdrop-blur-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
