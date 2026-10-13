import { useEffect } from 'react'

/**
 * Scrolls the main content container to the top on mount.
 * The Layout uses <main className="flex-1 overflow-y-auto"> as the scroll host —
 * React Router doesn't reset it on navigation, so pages must do it themselves.
 */
export function useScrollToTop() {
  useEffect(() => {
    // Target the Layout's main scroll container
    const main = document.querySelector('main.overflow-y-auto') as HTMLElement | null
    if (main) {
      main.scrollTop = 0
    } else {
      // Fallback for window-based scroll
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [])
}
