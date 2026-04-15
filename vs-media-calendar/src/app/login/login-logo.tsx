"use client"

import { useState } from "react"
import { VsMediaLogo } from "@/components/logo"

export function LoginLogo() {
  const [imgError, setImgError] = useState(false)

  if (imgError) {
    return <VsMediaLogo variant="white" size="xl" />
  }

  return (
    <img
      src="/logo.svg"
      alt="VS.Media"
      className="h-9 w-auto object-contain"
      onError={() => setImgError(true)}
    />
  )
}
