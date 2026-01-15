import { SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function Select({
  label,
  error,
  required,
  className = "",
  children,
  ...props
}: SelectProps) {
  const selectId =
    props.id || `select-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-semibold text-gray-700"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "w-full rounded-xl border bg-white px-4 py-3 text-gray-900 focus:ring-2 focus:outline-none shadow-sm transition-colors",
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
            : "border-gray-200 focus:border-primary-500 focus:ring-primary-500/20",
          className,
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p
          id={`${selectId}-error`}
          className="text-sm text-red-600 font-medium flex items-center gap-1"
          role="alert"
        >
          <span>⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}
