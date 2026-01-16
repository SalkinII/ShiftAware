import { SelectHTMLAttributes, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
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
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "w-full rounded-lg border bg-white pl-4 pr-10 py-2.5 text-sm text-gray-900",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all duration-200",
            "appearance-none cursor-pointer",
            error
              ? "border-error-300 focus-visible:border-error-500 focus-visible:ring-error-500"
              : "border-gray-300 focus-visible:border-primary-500 focus-visible:ring-primary-500",
            className,
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${selectId}-error` : undefined}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          aria-hidden="true"
        />
      </div>
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
