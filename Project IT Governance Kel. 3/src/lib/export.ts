import * as XLSX from 'xlsx';
import type { DamageReport, Instrument, PhysicalCheck } from '../types/simlab';
import { formatDate, formatDateTime, getInstrumentStock } from './format';

interface ExportRow {
  'ID Laporan': string;
  Tanggal: string;
  Pelapor: string;
  'Nama Alat': string;
  Lokasi: string;
  'Jumlah Rusak': number;
  Deskripsi: string;
  Status: string;
  Verifikator: string;
  PIC: string;
  Tenggat: string;
  Catatan: string;
}

interface InstrumentExportRow {
  'Kode Alat': string;
  'Nama Alat Gelas': string;
  Kategori: string;
  Lokasi: string;
  Satuan: string;
  'Stok Sistem': number;
  'Stok Minimum': number | string;
  Kondisi: string;
  Status: string;
}

interface PhysicalCheckExportRow {
  Periode: string;
  Bulan: string;
  Tahun: number;
  Lokasi: string;
  'Nama Alat': string;
  'Stok Sistem': number;
  'Stok Fisik': number;
  Selisih: number;
  'Status Verifikasi': string;
  Pemeriksa: string;
  Verifikator: string;
  'Tanggal Input': string;
  'Catatan Pemeriksaan': string;
  'Catatan Verifikasi': string;
}

function combineNotes(report: DamageReport): string {
  const parts: string[] = [];
  if (report.testing_impact) parts.push(`Dampak pengujian: ${report.testing_impact}`);
  if (report.verification_notes) parts.push(`Verifikasi: ${report.verification_notes}`);
  if (report.follow_up_notes) parts.push(`Tindak lanjut: ${report.follow_up_notes}`);
  if (report.rejection_reason) parts.push(`Alasan ditolak: ${report.rejection_reason}`);
  return parts.length > 0 ? parts.join(' | ') : '-';
}

function buildExportRows(reports: DamageReport[]): ExportRow[] {
  return reports.map((r) => ({
    'ID Laporan': r.report_code,
    Tanggal: formatDate(r.created_at),
    Pelapor: r.reporter_name || '-',
    'Nama Alat': r.instrument?.name || '-',
    Lokasi: r.location?.name || '-',
    'Jumlah Rusak': r.damaged_qty,
    Deskripsi: r.description,
    Status: r.status,
    Verifikator: r.verifier_name || '-',
    PIC: r.pic_name || '-',
    Tenggat: r.follow_up_deadline ? formatDate(r.follow_up_deadline) : '-',
    Catatan: combineNotes(r),
  }));
}

function buildInstrumentExportRows(instruments: Instrument[]): InstrumentExportRow[] {
  return instruments.map((inst) => ({
    'Kode Alat': inst.code || '-',
    'Nama Alat Gelas': inst.name,
    Kategori: inst.category || '-',
    Lokasi: inst.location?.name || 'Semua / Umum',
    Satuan: inst.unit || 'Unit',
    'Stok Sistem': getInstrumentStock(inst),
    'Stok Minimum': typeof inst.minimum_stock === 'number' ? inst.minimum_stock : '-',
    Kondisi: inst.condition || inst.condition_summary || '-',
    Status: inst.is_active === false ? 'Nonaktif' : 'Aktif',
  }));
}

function buildPhysicalCheckExportRows(checks: PhysicalCheck[]): PhysicalCheckExportRow[] {
  return checks.map((c) => ({
    Periode: c.period,
    Bulan: c.check_month,
    Tahun: c.check_year,
    Lokasi: c.location?.name || '-',
    'Nama Alat': c.instrument?.name || '-',
    'Stok Sistem': c.system_stock,
    'Stok Fisik': c.physical_stock,
    Selisih: c.difference ?? c.physical_stock - c.system_stock,
    'Status Verifikasi': c.verification_status || 'Belum Diverifikasi',
    Pemeriksa: c.checked_by_name,
    Verifikator: c.verified_by_name || '-',
    'Tanggal Input': formatDateTime(c.created_at),
    'Catatan Pemeriksaan': c.notes || '-',
    'Catatan Verifikasi': c.verification_notes || '-',
  }));
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportJsonRowsToCsv<T extends object>(rows: T[], headers: (keyof T)[], filename: string): void {
  const csvLines = [
    headers.map((h) => escapeCsvCell(String(h))).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h] as string | number)).join(',')),
  ];

  const bom = '\uFEFF';
  const blob = new Blob([bom + csvLines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });

  triggerDownload(blob, filename);
}

export function exportReportsToCsv(
  reports: DamageReport[],
  filename = 'SIMLAB_Laporan_Kerusakan_Demo.csv'
): void {
  const rows = buildExportRows(reports);
  const headers: (keyof ExportRow)[] = [
    'ID Laporan',
    'Tanggal',
    'Pelapor',
    'Nama Alat',
    'Lokasi',
    'Jumlah Rusak',
    'Deskripsi',
    'Status',
    'Verifikator',
    'PIC',
    'Tenggat',
    'Catatan',
  ];
  exportJsonRowsToCsv(rows, headers, filename);
}

export function exportReportsToExcel(
  reports: DamageReport[],
  filename = 'SIMLAB_Laporan_Kerusakan_Demo.xlsx'
): void {
  const rows = buildExportRows(reports);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 26 },
    { wch: 22 },
    { wch: 13 },
    { wch: 36 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 14 },
    { wch: 42 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Kerusakan');
  XLSX.writeFile(workbook, filename);
}

export function exportInstrumentsToCsv(
  instruments: Instrument[],
  filename = 'SIMLAB_Stok_Alat_Gelas_Demo.csv'
): void {
  const rows = buildInstrumentExportRows(instruments);
  const headers: (keyof InstrumentExportRow)[] = [
    'Kode Alat',
    'Nama Alat Gelas',
    'Kategori',
    'Lokasi',
    'Satuan',
    'Stok Sistem',
    'Stok Minimum',
    'Kondisi',
    'Status',
  ];
  exportJsonRowsToCsv(rows, headers, filename);
}

export function exportInstrumentsToExcel(
  instruments: Instrument[],
  filename = 'SIMLAB_Stok_Alat_Gelas_Demo.xlsx'
): void {
  const rows = buildInstrumentExportRows(instruments);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 15 },
    { wch: 28 },
    { wch: 18 },
    { wch: 22 },
    { wch: 10 },
    { wch: 13 },
    { wch: 14 },
    { wch: 28 },
    { wch: 12 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Alat & Stok');
  XLSX.writeFile(workbook, filename);
}

export function exportPhysicalChecksToCsv(
  checks: PhysicalCheck[],
  filename = 'SIMLAB_Rekap_Pemeriksaan_Semesteran_Demo.csv'
): void {
  const rows = buildPhysicalCheckExportRows(checks);
  const headers: (keyof PhysicalCheckExportRow)[] = [
    'Periode',
    'Bulan',
    'Tahun',
    'Lokasi',
    'Nama Alat',
    'Stok Sistem',
    'Stok Fisik',
    'Selisih',
    'Status Verifikasi',
    'Pemeriksa',
    'Verifikator',
    'Tanggal Input',
    'Catatan Pemeriksaan',
    'Catatan Verifikasi',
  ];
  exportJsonRowsToCsv(rows, headers, filename);
}

export function exportPhysicalChecksToExcel(
  checks: PhysicalCheck[],
  filename = 'SIMLAB_Rekap_Pemeriksaan_Semesteran_Demo.xlsx'
): void {
  const rows = buildPhysicalCheckExportRows(checks);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 13 },
    { wch: 11 },
    { wch: 8 },
    { wch: 22 },
    { wch: 26 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 32 },
    { wch: 32 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pemeriksaan Semesteran');
  XLSX.writeFile(workbook, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
