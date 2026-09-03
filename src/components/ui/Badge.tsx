import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'orange' | 'purple' | 'pink';
}

export function Badge({ className, variant = 'gray', children, ...props }: BadgeProps) {
  const variants = {
    blue: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
    green: 'bg-accent-green/10 text-accent-green border-accent-green/20',
    yellow: 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20',
    red: 'bg-accent-red/10 text-accent-red border-accent-red/20',
    gray: 'bg-bg-hover text-text-secondary border-bg-border',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    pink: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  };

  return (
    <span
      className={cn(
        "inline-flex items-center border rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
