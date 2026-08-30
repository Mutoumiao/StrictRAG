import * as React from 'react';

import { cn } from '../../lib/utils.js';

/** 关闭列表下拉：展示文案、值为 id；不能输入、不能搜。不是 combobox，不是原生 select。 */
export type ClosedSelectOption = {
  value: string;
  label: string;
};

export type ClosedSelectProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ClosedSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

export const ClosedSelect = React.forwardRef<HTMLButtonElement, ClosedSelectProps>(
  function ClosedSelect(
    {
      id,
      value,
      onValueChange,
      options,
      placeholder = '请选择',
      disabled,
      className,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
    },
    ref,
  ) {
    const [open, setOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const listId = React.useId();
    const selected = options.find((o) => o.value === value);
    const selectedIndex = options.findIndex((o) => o.value === value);
    const [activeIndex, setActiveIndex] = React.useState(selectedIndex >= 0 ? selectedIndex : 0);

    React.useEffect(() => {
      if (!open) return;
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      function onDocMouseDown(event: MouseEvent) {
        if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
      }
      function onDocKey(event: KeyboardEvent) {
        if (event.key === 'Escape') setOpen(false);
      }
      document.addEventListener('mousedown', onDocMouseDown);
      document.addEventListener('keydown', onDocKey);
      return () => {
        document.removeEventListener('mousedown', onDocMouseDown);
        document.removeEventListener('keydown', onDocKey);
      };
    }, [open, selectedIndex]);

    function selectAt(index: number) {
      const option = options[index];
      if (!option) return;
      onValueChange(option.value);
      setOpen(false);
    }

    function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      if (disabled) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((current) => {
          if (options.length === 0) return 0;
          return (current + delta + options.length) % options.length;
        });
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        if (open) {
          event.preventDefault();
          selectAt(activeIndex);
        }
      }
    }

    return (
      <div ref={rootRef} className={cn('relative', className)}>
        <button
          ref={ref}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            'flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          )}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={onTriggerKeyDown}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          <span aria-hidden className="text-muted-foreground">
            ▾
          </span>
        </button>
        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full min-w-[12rem] overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={cn(
                  'cursor-pointer px-3 py-1.5 text-xs text-foreground',
                  index === activeIndex && 'bg-muted',
                  option.value === value && 'font-medium',
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectAt(index);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  },
);
