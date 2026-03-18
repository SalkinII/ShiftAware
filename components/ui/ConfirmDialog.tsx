"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus first button when dialog opens
    const timer = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 100);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      } else if (
        e.key === "Enter" &&
        !isLoading &&
        e.target === cancelButtonRef.current
      ) {
        // Enter on cancel button closes
        onClose();
      } else if (
        e.key === "Enter" &&
        !isLoading &&
        e.target === confirmButtonRef.current
      ) {
        // Enter on confirm button triggers action
        handleConfirm();
      } else if (e.key === "Tab" && isOpen) {
        // Trap focus within dialog
        const focusableElements = [
          cancelButtonRef.current,
          confirmButtonRef.current,
        ].filter(Boolean) as HTMLElement[];

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, isLoading, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  async function handleConfirm() {
    if (isLoading) return;
    try {
      await onConfirm();
    } catch (error) {
      // Error handling is done by the caller (toast notifications)
      console.error("Confirm action error:", error);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={isLoading ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <Card className="relative z-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between mb-4">
          <h2
            id="confirm-dialog-title"
            className="text-xl font-bold text-gray-900"
          >
            {title}
          </h2>
          {!isLoading && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <p
          id="confirm-dialog-message"
          className="text-gray-600 mb-6 font-medium"
        >
          {message}
        </p>

        <div className="flex items-center justify-end gap-3">
          <Button
            ref={cancelButtonRef}
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="min-w-[100px]"
          >
            {cancelText}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={variant === "destructive" ? "destructive" : "primary"}
            onClick={handleConfirm}
            isLoading={isLoading}
            className="min-w-[100px]"
          >
            {confirmText}
          </Button>
        </div>
      </Card>
    </div>
  );
}
