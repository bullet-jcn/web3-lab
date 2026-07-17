
export function resolveAtomicSupport(status: 'supported' | 'ready' | 'unsupported' | undefined): 'atomic' | 'upgrade-then-atomic' | 'sequential-fallback' {
    if(status === 'supported') return 'atomic'
    if(status === 'ready') return 'upgrade-then-atomic'
    return 'sequential-fallback'
}