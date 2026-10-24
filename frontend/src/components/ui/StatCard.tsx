import React from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: number
  trendLabel?: string
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'purple' | 'blue'
  className?: string
}

const colorMap = {
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

export function StatCard({ title, value, icon, trend, trendLabel, color = 'indigo', className }: StatCardProps) {
  const TrendIcon = trend === undefined ? Minus : trend > 0 ? TrendingUp : TrendingDown
  const trendColor = trend === undefined ? 'text-gray-400' : trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-3 rounded-lg', colorMap[color])}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{title}</p>
      {trendLabel && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{trendLabel}</p>}
    </div>
  )
}
