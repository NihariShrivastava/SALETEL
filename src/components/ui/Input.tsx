import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full bg-bg-primary border border-bg-border rounded-lg py-2.5 text-white placeholder:text-text-muted focus:border-accent-blue focus:outline-none transition-colors text-sm",
            icon ? "pl-10 pr-3" : "px-3",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = 'Input';
