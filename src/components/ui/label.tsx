
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  // Base styles for the label
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
  // Removed pointer-events-none as floating label logic handles interaction
  // Add variants here if needed (e.g., for error states)
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => {
  // Ensure the label receives the 'peer-placeholder-shown' state from the input/textarea
  // This might require specific CSS structure or JS, depending on implementation.
  // For simpler CSS-only floating labels, the label is often positioned absolutely
  // and styled based on the sibling input's state (:placeholder-shown).
  // The `cn` function merges classes, allowing parent components to style based on focus/value.
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(labelVariants(), className)}
      {...props}
    />
  )
})
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
