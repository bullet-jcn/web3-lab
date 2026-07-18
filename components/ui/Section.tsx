import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
