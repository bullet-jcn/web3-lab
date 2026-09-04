import Link from 'next/link'
import type { ReactNode } from 'react'

export function PolicyPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
        返回 Web3 Sentinel
      </Link>
      <header className="mt-8 border-b border-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">生效日期：2026-09-04</p>
      </header>
      <article className="space-y-8 py-8 text-sm leading-7 text-foreground/90 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-medium [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </article>
    </main>
  )
}
