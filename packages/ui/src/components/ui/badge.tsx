import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide',
  {
    variants: {
      variant: {
        default: 'bg-muted text-foreground',
        success: 'bg-success-muted text-success',
        abstain: 'bg-abstain-muted text-abstain',
        destructive: 'bg-destructive-muted text-destructive',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...rest }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...rest} />;
}

export { badgeVariants };
