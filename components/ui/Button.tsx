import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "danger"; // "danger" kept for backward compatibility
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      className = "",
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    // Map "danger" to "destructive" for backward compatibility
    const normalizedVariant = variant === "danger" ? "destructive" : variant;

    // Base styles - Design System v2
    const base =
      "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]";

    // Size variants
    const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
      sm: "px-3 py-1.5 text-xs rounded-md",
      md: "px-4 py-2.5 text-sm rounded-lg",
      lg: "px-6 py-3 text-base rounded-lg",
    };

    // Variant styles - Design System v2
    const variants: Record<
      "primary" | "secondary" | "ghost" | "destructive",
      string
    > = {
      primary:
        "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)] focus-visible:ring-primary-500",
      secondary:
        "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] hover:shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] focus-visible:ring-gray-400",
      ghost:
        "bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-gray-400",
      destructive:
        "bg-error-600 text-white hover:bg-error-700 active:bg-error-800 shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)] focus-visible:ring-error-500",
    };

    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        className={`${base} ${sizes[size]} ${variants[normalizedVariant]} ${className}`}
        disabled={isDisabled}
        {...props}
      >
        {isLoading && (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
