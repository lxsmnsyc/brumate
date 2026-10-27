---
'@brumate/ui': patch
---

A non-modal Popover closes on Escape while focus is on its trigger or on nothing. A ModalOverlay with its own `isOpen` reports `onOpenChange(false)` once while it leaves. Shift+F6 outside the toasts no longer jumps into them, and F6 is prevented only when focus moves. A vertical Toolbar and ToggleButtonGroup leave Up and Down to a text area.
