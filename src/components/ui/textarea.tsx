
import * as React from 'react';

import {cn} from '@/lib/utils';

// Update TextareaProps to accept floatingLabel prop if needed for more complex scenarios
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}


const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({className, placeholder, ...props}, ref) => {
    // Basic handling for floating label effect: requires placeholder=" " and padding adjustments
    return (
      <textarea
        // Use cn to merge classes correctly
        // Added 'peer' class for use with peer-placeholder-shown
        className={cn(
          'peer flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-transparent focus:placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm', // Keep min-h, make placeholder transparent by default
          // Add padding-top only when placeholder is used for floating label effect (e.g., placeholder=" ")
          placeholder === " " && "pt-4",
          className
        )}
        placeholder={placeholder} // Pass placeholder down
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
