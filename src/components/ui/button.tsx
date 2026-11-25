import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonStyles = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6E6E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F4EF] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#0F6E6E] text-[#FCFBF8] shadow-beautiful-sm hover:bg-[#0B5959] active:translate-y-px",
        ink: "bg-[#18181B] text-[#FCFBF8] shadow-beautiful-sm hover:bg-[#27272A]",
        paper:
          "border border-[#D8D2C5] bg-[#F6F4EF] text-[#18181B] shadow-beautiful-sm hover:bg-[#ECE8DF]",
        outline:
          "border border-[#D8D2C5] bg-[#FCFBF8] text-[#3F3F46] hover:bg-[#ECE8DF] hover:text-[#18181B]",
        ghost: "text-[#52525B] hover:bg-[#ECE8DF] hover:text-[#18181B]",
        danger:
          "border border-[#991B1B] bg-[#FEE2E2] text-[#991B1B] shadow-beautiful-sm hover:bg-[#FECACA]",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 rounded-md px-2.5 py-1 text-xs",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  );
}
