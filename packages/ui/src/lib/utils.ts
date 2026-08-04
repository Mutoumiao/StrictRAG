import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** className 合并（shadcn 风格，对齐参考仓） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
