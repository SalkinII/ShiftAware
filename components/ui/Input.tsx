import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  required?: boolean;
}

export function Input({
  label,
  error,
  helpText,
  required,
  className = "",
  disabled,
  ...props
}: InputProps) {
  const inputId =
    props.id || `input-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-gray-700"
        >
          {label}
          {required && <span className="text-error-600 ml-1">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50",
          error
            ? "border-error-300 focus-visible:border-error-500 focus-visible:ring-error-500"
            : "border-gray-300 focus-visible:border-primary-500 focus-visible:ring-primary-500",
          className,
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={
          error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined
        }
        disabled={disabled}
        {...props}
      />
      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm text-error-600 font-medium flex items-center gap-1"
          role="alert"
        >
          <span>⚠</span>
          {error}
        </p>
      )}
      {!error && helpText && (
        <p id={`${inputId}-help`} className="text-xs text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
}
