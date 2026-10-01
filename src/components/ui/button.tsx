// 共通ボタンコンポーネント（ui-design-system.md 3.2 準拠）。
// class-variance-authority を使わず、cn() でバリアント/サイズを解決する軽量版。

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "destructive" | "ghost";
type Size = "sm" | "md" | "lg" | "full" | "icon";

const base =
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none select-none";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none",
  secondary:
    "bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 active:bg-slate-300 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100",
  outline:
    "bg-white text-emerald-700 border border-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 disabled:border-slate-200 disabled:text-slate-400",
  destructive:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:bg-slate-300 disabled:text-slate-500",
  ghost:
    "text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-400",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-xs rounded-md",
  md: "h-11 px-4 py-2 text-sm",
  lg: "h-12 px-6 text-base font-semibold",
  full: "w-full h-12 px-6 text-base font-semibold",
  icon: "h-10 w-10 p-0",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        className={cn(base, variantClasses[variant], sizeClasses[size], className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
