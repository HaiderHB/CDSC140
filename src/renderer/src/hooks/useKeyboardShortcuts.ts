import { useEffect } from 'react'

interface UseKeyboardShortcutsProps {
  onManualDeleteEyeContact: () => void
  onRestoreLastDeleted: () => void
  isActive?: boolean
}

export const useKeyboardShortcuts = ({
  onManualDeleteEyeContact,
  onRestoreLastDeleted,
  isActive = true
}: UseKeyboardShortcutsProps) => {
  // Set up global keyboard shortcuts
  useEffect(() => {
    if (!isActive) return

    // Clean up function to remove event listeners
    const cleanup = () => {}

    // Add Ctrl+M event listener
    // @ts-ignore - window.api is defined in the preload script
    const cleanupCtrlM = window.api?.onCtrlM?.(() => {
      onManualDeleteEyeContact()
    })

    // Add Ctrl+N event listener
    // @ts-ignore - window.api is defined in the preload script
    const cleanupCtrlN = window.api?.onCtrlN?.(() => {
      onRestoreLastDeleted()
    })

    // Return a cleanup function that calls both cleanup functions
    return () => {
      if (cleanupCtrlM) cleanupCtrlM()
      if (cleanupCtrlN) cleanupCtrlN()
    }
  }, [onManualDeleteEyeContact, onRestoreLastDeleted, isActive])
}
