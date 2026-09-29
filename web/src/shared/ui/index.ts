// NexCargo — Shared UI Primitives Barrel Export
// C6-II/C6-III Platform Layer
// Exports all reusable UI primitives per PROMPT 5 architecture

export { Button, type ButtonProps } from './components/button';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  type CardProps,
} from './components/card';
export { Badge, type BadgeProps } from './components/badge';
export { Skeleton, type SkeletonProps } from './components/skeleton';
export { Spinner, type SpinnerProps } from './components/spinner';
export { Input, Select, Textarea, type InputProps, type SelectProps, type TextareaProps } from './components/form-controls';
export { Table, type TableProps, type Column } from './components/table';
export { ToastProvider, Toast, type ToastProviderProps, type ToastMessage, useToast } from './components/toast';
export { ErrorBanner, type ErrorBannerProps } from './components/error-banner';
export { LanguageSwitcher, type LanguageSwitcherProps } from './components/language-switcher';
export { SkipNav } from './components/skip-nav';
export { LocaleAwareLink } from './components/locale-aware-link';
export { NexCargoLogo } from './components/nex-cargo-logo';
export { NexCargoSymbol } from './components/nex-cargo-symbol';
export { PublicHeader } from './components/public-header';
export { PublicFooter } from './components/public-footer';

