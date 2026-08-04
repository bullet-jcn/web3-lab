import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { cn } from '@/lib/utils'

interface SectionProps {
  title: string
  children: ReactNode
  description?: string
  eyebrow?: string
  icon?: LucideIcon
  accent?: boolean
}

export function Section({ title, children, description, eyebrow, icon: Icon, accent }: SectionProps) {
  return (
    <Card className={cn('relative border-0 bg-card/70 shadow-[0_18px_60px_-35px_rgba(0,0,0,0.35)] ring-foreground/10 backdrop-blur-xl dark:shadow-[0_18px_60px_-35px_rgba(0,0,0,0.8)]', accent && 'ring-emerald-500/25')}>
      {accent && <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />}
      <CardHeader className="border-b border-foreground/7 pb-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground/5 text-muted-foreground ring-1 ring-foreground/8', accent && 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300')}>
              <Icon className="size-4" />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-700/80 dark:text-emerald-300/80">{eyebrow}</p>}
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription className="mt-1 leading-5">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
