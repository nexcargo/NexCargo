// NexCargo — Form Controls
// C6-II UI Primitives Layer
// Implements Input, Select, Textarea per PROMPT 5 Input System

import React from 'react';
import { cn } from '../utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors',
          'placeholder:text-zinc-500',
          'focus:border-[#1A5C9E] focus:outline-none focus:ring-2 focus:ring-[#1A5C9E]/20',
          'dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors',
          'focus:border-[#1A5C9E] focus:outline-none focus:ring-2 focus:ring-[#1A5C9E]/20',
          'dark:border-zinc-700 dark:bg-zinc-900 dark:text-white',
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors',
          'placeholder:text-zinc-500',
          'focus:border-[#1A5C9E] focus:outline-none focus:ring-2 focus:ring-[#1A5C9E]/20',
          'dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
