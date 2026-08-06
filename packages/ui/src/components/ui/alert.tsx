import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils.js';

const alertVariants = cva('rounded-lg border p-4 text-sm', {
  variants: {
    variant: {
      default: 'border-border bg-card text-card-foreground',
      success: 'border-success bg-success-muted text-foreground',
      abstain:
        'border-abstain bg-abstain-muted text-abstain-foreground shadow-[0_10px_28px_rgba(124,58,237,0.09)]',
      destructive: 'border-destructive bg-destructive-muted text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>;

export function Alert({ className, variant, ...rest }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...rest} />;
}

export function AlertTitle({ className, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs font-semibold tracking-wide', className)} {...rest} />;
}

export function AlertDescription({ className, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-2 text-[15px] leading-relaxed', className)} {...rest} />;
}

export { alertVariants };
