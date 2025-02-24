
import { Toaster as SonnerToaster } from "sonner"

export function Toast() {
  return (
    <SonnerToaster />
  )
}

// Exporting these to maintain API compatibility
export const ToastProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const ToastViewport = () => null
export const ToastClose = () => null
export const ToastTitle = () => null
export const ToastDescription = () => null
export const ToastAction = () => null

export type ToastActionElement = React.ReactElement
export type ToastProps = {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}
