import { CheckCheck, CheckCircle2, Clock, UserCheck, XCircle } from 'lucide-react';
import type { ReportStatus } from '../types/simlab';

interface StatusBadgeProps {
  status: ReportStatus | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case 'Menunggu Verifikasi':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 whitespace-nowrap shrink-0">
          <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
          <span>Menunggu Verifikasi</span>
        </span>
      );
    case 'Diverifikasi':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 whitespace-nowrap shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0" aria-hidden="true" />
          <span>Diverifikasi</span>
        </span>
      );
    case 'Ditolak':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 whitespace-nowrap shrink-0">
          <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" aria-hidden="true" />
          <span>Ditolak</span>
        </span>
      );
    case 'Tindak Lanjut':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900 whitespace-nowrap shrink-0">
          <UserCheck className="h-3.5 w-3.5 text-sky-700 shrink-0" aria-hidden="true" />
          <span>Tindak Lanjut</span>
        </span>
      );
    case 'Selesai':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 whitespace-nowrap shrink-0">
          <CheckCheck className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
          <span>Selesai</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0">
          <span>{status}</span>
        </span>
      );
  }
}
