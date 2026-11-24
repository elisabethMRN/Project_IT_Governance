import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export type NotificationVariant = 'success' | 'error' | 'info' | 'download';

export interface NotificationModalPayload {
  id: string;
  variant: NotificationVariant;
  title: string;
  message: string;
  code?: string;
  primaryLabel?: string;
  onPrimaryAction?: () => void;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
}

interface NotificationModalProps {
  notice: NotificationModalPayload | null;
  onClose: () => void;
}

const VARIANT_STYLES: Record<
  NotificationVariant,
  {
    iconBg: string;
    iconRing: string;
    iconColor: string;
    primaryBtn: string;
    codeBg: string;
  }
> = {
  success: {
    iconBg: 'bg-emerald-100',
    iconRing: 'ring-8 ring-emerald-50',
    iconColor: 'text-emerald-600',
    primaryBtn: 'bg-teal-600 hover:bg-teal-700 focus-visible:ring-teal-600',
    codeBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  download: {
    iconBg: 'bg-emerald-100',
    iconRing: 'ring-8 ring-emerald-50',
    iconColor: 'text-emerald-600',
    primaryBtn: 'bg-teal-600 hover:bg-teal-700 focus-visible:ring-teal-600',
    codeBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  error: {
    iconBg: 'bg-red-100',
    iconRing: 'ring-8 ring-red-50',
    iconColor: 'text-red-600',
    primaryBtn: 'bg-[#0F2744] hover:bg-[#16365E] focus-visible:ring-[#0F2744]',
    codeBg: 'bg-red-50 border-red-200 text-red-800',
  },
  info: {
    iconBg: 'bg-sky-100',
    iconRing: 'ring-8 ring-sky-50',
    iconColor: 'text-sky-600',
    primaryBtn: 'bg-[#0F2744] hover:bg-[#16365E] focus-visible:ring-[#0F2744]',
    codeBg: 'bg-sky-50 border-sky-200 text-sky-800',
  },
};

function renderVariantIcon(variant: NotificationVariant, className: string) {
  switch (variant) {
    case 'success':
      return <CheckCircle2 className={className} aria-hidden="true" />;
    case 'download':
      return <Download className={className} aria-hidden="true" />;
    case 'error':
      return <AlertTriangle className={className} aria-hidden="true" />;
    case 'info':
      return <Clock className={className} aria-hidden="true" />;
  }
}

export function NotificationModal({ notice, onClose }: NotificationModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Lock page scroll & trap keyboard focus while modal is open
  useEffect(() => {
    if (!notice) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const container = dialogRef.current;
      if (!container) return;
      const preferred =
        container.querySelector<HTMLElement>('[data-modal-primary="true"]') ||
        container.querySelector<HTMLElement>('[data-modal-close="true"]') ||
        container;
      preferred.focus();
    }, 25);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [notice, onClose]);

  if (typeof document === 'undefined') return null;

  const styles = notice ? VARIANT_STYLES[notice.variant] : VARIANT_STYLES.success;
  const allowBackdropClose = notice
    ? notice.closeOnBackdrop ?? notice.variant !== 'error'
    : true;

  return createPortal(
    <AnimatePresence>
      {notice && (
        <motion.div
          key={notice.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.22, ease: 'easeOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          {/* Full-screen dark semi-transparent overlay blocking background clicks */}
          <div
            onClick={() => {
              if (allowBackdropClose) {
                onClose();
              }
            }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* Centered White Notification Card */}
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 28, scale: 0.95 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 14, scale: 0.96 }
            }
            transition={{
              duration: prefersReducedMotion ? 0.01 : 0.25,
              ease: [0.16, 1, 0.3, 1],
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-[0_24px_60px_-12px_rgba(15,39,68,0.35)] focus:outline-none"
          >
            {/* Top-right X close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup notifikasi"
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Large Animated Icon at Top */}
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0.65, opacity: 0 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                transition={{
                  duration: prefersReducedMotion ? 0.01 : 0.26,
                  delay: prefersReducedMotion ? 0 : 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={`flex h-20 w-20 items-center justify-center rounded-full ${styles.iconBg} ${styles.iconRing}`}
              >
                {renderVariantIcon(notice.variant, `h-10 w-10 ${styles.iconColor}`)}
              </motion.div>

              {/* Prominent Title */}
              <h2
                id={titleId}
                className="mt-6 text-xl sm:text-2xl font-bold text-[#0F2744] tracking-tight"
              >
                {notice.title}
              </h2>

              {/* Optional Newly Created Report ID */}
              {notice.code && (
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center rounded-xl border px-4 py-1.5 font-mono text-sm font-bold tabular-nums ${styles.codeBg}`}
                  >
                    ID Laporan: {notice.code}
                  </span>
                </div>
              )}

              {/* Clear Short Message */}
              <p
                id={descId}
                className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-md"
              >
                {notice.message}
              </p>

              {/* Primary + Close Buttons */}
              <div className="mt-7 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full">
                <button
                  type="button"
                  data-modal-close="true"
                  onClick={onClose}
                  className="flex-1 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  {notice.closeLabel || 'Tutup'}
                </button>

                {notice.primaryLabel && notice.onPrimaryAction && (
                  <button
                    type="button"
                    data-modal-primary="true"
                    onClick={() => {
                      const action = notice.onPrimaryAction;
                      onClose();
                      action?.();
                    }}
                    className={`flex-1 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${styles.primaryBtn}`}
                  >
                    {notice.primaryLabel}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
