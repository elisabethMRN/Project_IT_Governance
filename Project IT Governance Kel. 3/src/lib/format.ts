import type { DamageReport, Instrument, ReportFilters } from '../types/simlab';

export function getInstrumentStock(inst: Instrument): number {
  if (typeof inst.stock_quantity === 'number' && !Number.isNaN(inst.stock_quantity)) {
    if (inst.stock_quantity > 0) {
      return inst.stock_quantity;
    }
    if (typeof inst.stock === 'number' && !Number.isNaN(inst.stock) && inst.stock > 0 && !inst.updated_at) {
      return inst.stock;
    }
    return typeof inst.stock === 'number' && !Number.isNaN(inst.stock) ? inst.stock : inst.stock_quantity;
  }
  return typeof inst.stock === 'number' && !Number.isNaN(inst.stock) ? inst.stock : 0;
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getRoleLabel(role?: string | null): string {
  switch (role) {
    case 'analis':
      return 'Analis Laboratorium';
    case 'supervisor':
      return 'Supervisor / QA';
    case 'tu':
      return 'Tata Usaha (TU)';
    case 'admin':
      return 'Administrator';
    default:
      return 'Peran Tidak Dikenal';
  }
}

export function getPeriodFromIso(isoString: string): 'Semester 1' | 'Semester 2' {
  const date = new Date(isoString);
  const month = date.getMonth() + 1;
  return month <= 6 ? 'Semester 1' : 'Semester 2';
}

export function filterReports(reports: DamageReport[], filters: ReportFilters): DamageReport[] {
  const q = filters.search.trim().toLowerCase();

  return reports.filter((report) => {
    if (filters.locationId && String(report.location_id) !== String(filters.locationId)) {
      return false;
    }
    if (filters.instrumentId && String(report.instrument_id) !== String(filters.instrumentId)) {
      return false;
    }
    if (filters.status && report.status !== filters.status) return false;

    if (filters.userId) {
      const target = String(filters.userId);
      const matchesUser =
        String(report.reporter_id || '') === target ||
        String(report.pic_id || '') === target ||
        String(report.verifier_id || '') === target;
      if (!matchesUser) return false;
    }

    if (filters.period !== 'all') {
      if (getPeriodFromIso(report.created_at) !== filters.period) return false;
    }

    if (filters.dateFrom) {
      const createdDate = report.created_at.slice(0, 10);
      if (createdDate < filters.dateFrom) return false;
    }

    if (filters.dateTo) {
      const createdDate = report.created_at.slice(0, 10);
      if (createdDate > filters.dateTo) return false;
    }

    if (q) {
      const haystack = [
        report.report_code,
        report.reporter_name,
        report.description,
        report.location?.name,
        report.instrument?.name,
        report.pic_name,
        report.verifier_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}
