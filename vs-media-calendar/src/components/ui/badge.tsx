import * as React from "react"
import { cn } from "@/lib/utils"
import type { BookingStatus } from "@prisma/client"
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "muted"
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variants = {
      default: "bg-slate-100 text-slate-700",
      success: "bg-emerald-100 text-emerald-800",
      warning: "bg-amber-100 text-amber-800",
      danger: "bg-red-100 text-red-800",
      info: "bg-blue-100 text-blue-800",
      muted: "bg-gray-100 text-gray-600",
    }

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    )
  }
)
Badge.displayName = "Badge"

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        BOOKING_STATUS_COLORS[status]
      )}
    >
      {BOOKING_STATUS_LABELS[status]}
    </span>
  )
}

export { Badge, BookingStatusBadge }
