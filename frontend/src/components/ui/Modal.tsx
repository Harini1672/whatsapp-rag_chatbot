import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, description, size = 'md', children }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className={cn(
          'relative w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl',
          'max-h-[90vh] overflow-y-auto scrollbar-thin',
          sizes[size]
        )}
      >
        {(title || description) && (
          <div className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div>
                {title && <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>}
                {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="ml-4 -mt-1">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
