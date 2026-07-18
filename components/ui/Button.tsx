import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'danger' | 'ghost'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-900',
  ghost:
    'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  )
}
