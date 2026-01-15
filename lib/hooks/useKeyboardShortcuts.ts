"use client";

import { useEffect } from "react";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (e: KeyboardEvent) => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          e.preventDefault();
          shortcut.handler(e);
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}

// Common shortcut handlers
export const commonShortcuts = {
  escape: (handler: () => void) => ({
    key: "Escape",
    handler: () => handler(),
    description: "Close dialog/form",
  }),
  save: (handler: () => void) => ({
    key: "s",
    ctrl: true,
    handler: (e: KeyboardEvent) => {
      e.preventDefault();
      handler();
    },
    description: "Save (Ctrl+S)",
  }),
  search: (handler: () => void) => ({
    key: "k",
    ctrl: true,
    handler: (e: KeyboardEvent) => {
      e.preventDefault();
      handler();
    },
    description: "Search (Ctrl+K)",
  }),
};
