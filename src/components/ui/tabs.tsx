"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "grid grid-cols-3 gap-1.5 rounded-lg border border-[#D8D2C5] bg-[#ECE8DF] p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 rounded-md px-2.5 py-2 text-left text-[11px] font-medium leading-tight text-[#52525B] transition-all duration-150 hover:text-[#18181B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6E6E] data-[state=active]:bg-[#FCFBF8] data-[state=active]:font-semibold data-[state=active]:text-[#18181B] data-[state=active]:shadow-beautiful-sm sm:flex-row sm:items-center sm:gap-1.5 sm:px-3 sm:text-xs",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-4 focus-visible:outline-none", className)}
      {...props}
    />
  );
}
