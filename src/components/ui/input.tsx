
import * as React from "react"

import { cn } from "@/lib/utils"

// Update InputProps to accept floatingLabel prop if needed for more complex scenarios
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, placeholder, ...props }, ref) => {
    // Basic handling for floating label effect: requires placeholder=" " and padding adjustments
    // More robust solutions might use peer selectors or JS.
    return (
      <input
        type={type}
        // Use cn to merge classes correctly
        // Added 'peer' class for use with peer-placeholder-shown
        className={cn(
          "peer flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-transparent focus:placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", // Placeholder transparent
          // Add padding-top if placeholder is used for floating label effect
          placeholder === " " && "pt-4",
          className
        )}
        placeholder={placeholder} // Pass placeholder down
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
