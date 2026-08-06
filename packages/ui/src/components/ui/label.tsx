/* eslint-disable react/prop-types -- TypeScript props */
import * as React from 'react';

import { cn } from '../../lib/utils.js';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...rest },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
      {...rest}
    />
  );
});
