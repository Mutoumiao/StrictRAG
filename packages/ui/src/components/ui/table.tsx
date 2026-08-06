/* eslint-disable react/prop-types -- TypeScript props */
import * as React from 'react';

import { cn } from '../../lib/utils.js';

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  function Table({ className, ...rest }, ref) {
    return (
      <table ref={ref} className={cn('w-full border-collapse text-[13px]', className)} {...rest} />
    );
  },
);

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableHeader({ className, ...rest }, ref) {
  return <thead ref={ref} className={cn(className)} {...rest} />;
});

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableBody({ className, ...rest }, ref) {
  return <tbody ref={ref} className={cn(className)} {...rest} />;
});

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  function TableRow({ className, ...rest }, ref) {
    return <tr ref={ref} className={cn('border-b border-muted', className)} {...rest} />;
  },
);

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(function TableHead({ className, ...rest }, ref) {
  return (
    <th
      ref={ref}
      className={cn('border-b border-border px-1 py-2 text-left font-medium', className)}
      {...rest}
    />
  );
});

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(function TableCell({ className, ...rest }, ref) {
  return <td ref={ref} className={cn('px-1 py-2', className)} {...rest} />;
});
