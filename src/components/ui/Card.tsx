import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
}

export function Card({ className, title, subtitle, children, ...props }: CardProps) {
  return (
    <div className={cn("bg-bg-secondary border border-bg-border rounded-xl p-5 shadow-sm", className)} {...props}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
          {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
