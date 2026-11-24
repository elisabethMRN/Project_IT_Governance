import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  RotateCcw,
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import {
  exportInstrumentsToCsv,
  exportInstrumentsToExcel,
  exportPhysicalChecksToCsv,
  exportPhysicalChecksToExcel,
  exportReportsToCsv,
  exportReportsToExcel,
} from '../lib/export';
import { filterReports } from '../lib/format';
import {
  fetchDamageReports,
  fetchInstruments,
  fetchLocations,
  fetchPhysicalChecks,
} from '../lib/simlabApi';
import type {
  DamageReport,
  Instrument,
  LabLocation,
  PhysicalCheck,
  ReportFilters,
  ReportStatus,
} from '../types/simlab';

const DEFAULT_FILTERS: ReportFilters = {
  search: '',
  locationId: '',
  instrumentId: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  period: 'all',
};

const ALL_STATUSES: ReportStatus[] = [
  'Menunggu Verifikasi',
  'Diverifikasi',
  'Ditolak',
  'Tindak Lanjut',
  'Selesai',
];

export function AdminExportPage() {
  const { showNotification } = useNotification();

  const runExport = (fn: () => void) => {
    try {
      fn();
      showNotification({
        variant: 'download',
        title: 'Ekspor Berhasil',
        message: 'File laporan berhasil diunduh.',
      });
    } catch (err) {
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: err instanceof Error ? err.message : 'Gagal mengekspor data ke file.',
        closeOnBackdrop: false,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => runExport(fn),
      });
    }
  };

  const [reports, setReports] = useState<DamageReport[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [checks, setChecks] = useState<PhysicalCheck[]>([]);
  const [locations, setLocations] = useState<LabLocation[]>([]);
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchDamageReports(),
      fetchInstruments(),
      fetchPhysicalChecks(),
      fetchLocations(),
    ])
      .then(([repRows, instRows, checkRows, locRows]) => {
        if (!mounted) return;
        setReports(repRows);
        setInstruments(instRows);
        setChecks(checkRows);
        setLocations(locRows);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat data untuk ekspor.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredReports = useMemo(() => filterReports(reports, filters), [reports, filters]);

  const filteredInstruments = useMemo(() => {
    return instruments.filter((inst) => {
      if (filters.instrumentId && String(inst.id) !== String(filters.instrumentId)) {
        return false;
      }
      if (
        filters.locationId &&
        inst.location_id &&
        String(inst.location_id) !== String(filters.locationId)
      ) {
        return false;
      }
      return true;
    });
  }, [instruments, filters.instrumentId, filters.locationId]);

  const filteredChecks = useMemo(() => {
    return checks.filter((c) => {
      if (filters.locationId && String(c.location_id) !== String(filters.locationId)) {
        return false;
      }
      if (filters.instrumentId && String(c.instrument_id) !== String(filters.instrumentId)) {
        return false;
      }
      if (filters.period !== 'all' && c.period !== filters.period) {
        return false;
      }
      if (filters.dateFrom && c.created_at.slice(0, 10) < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && c.created_at.slice(0, 10) > filters.dateTo) {
        return false;
      }
      return true;
    });
  }, [checks, filters]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-teal-200 bg-teal-50/70 px-5 py-4">
        <p className="text-sm font-bold text-[#0F2744]">
          Data siap ekspor untuk proses administrasi berikutnya
        </p>
        <p className="text-xs text-slate-600 mt-0.5">
          Gunakan filter di bawah untuk menyiapkan data laporan kerusakan, data alat & stok, serta
          rekap pemeriksaan semesteran dalam format Excel (.xlsx) atau CSV. SIMLAB adalah prototype
          akademik dan belum terintegrasi langsung dengan SAKTI.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Filter Panel */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#0F2744]">
            Filter Ekspor (Lokasi, Alat, Tanggal, Status & Periode)
          </h2>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Filter</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Lokasi</label>
            <select
              value={filters.locationId}
              onChange={(e) => setFilters((p) => ({ ...p, locationId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              <option value="">Semua Lokasi</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Alat Gelas</label>
            <select
              value={filters.instrumentId}
              onChange={(e) => setFilters((p) => ({ ...p, instrumentId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              <option value="">Semua Alat</option>
              {instruments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Status Laporan
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              <option value="">Semua Status</option>
              {ALL_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Periode</label>
            <select
              value={filters.period}
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  period: e.target.value as ReportFilters['period'],
                }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              <option value="all">Semua Periode</option>
              <option value="Semester 1">Semester 1 (Juni)</option>
              <option value="Semester 2">Semester 2 (Desember)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>
        </div>
      </div>

      {/* Export Dataset Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-44 rounded-lg bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Laporan Kerusakan */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-[#0F2744]">
                <FileText className="h-5 w-5 text-teal-600 shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-bold">Seluruh Laporan Kerusakan</h3>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Mencakup laporan semua status sesuai filter lokasi, alat, tanggal, status, dan
                periode.
              </p>
              <p className="mt-3 text-2xl font-bold font-mono tabular-nums text-[#0F2744]">
                {filteredReports.length}{' '}
                <span className="text-xs font-sans font-medium text-slate-500">baris data</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={filteredReports.length === 0}
                onClick={() =>
                  runExport(() =>
                    exportReportsToCsv(
                      filteredReports,
                      'SIMLAB_Admin_Laporan_Kerusakan_Demo.csv'
                    )
                  )
                }
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white text-xs font-semibold px-3 py-2.5 transition-colors disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                disabled={filteredReports.length === 0}
                onClick={() =>
                  runExport(() =>
                    exportReportsToExcel(
                      filteredReports,
                      'SIMLAB_Admin_Laporan_Kerusakan_Demo.xlsx'
                    )
                  )
                }
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2.5 transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* 2. Data Alat & Stok */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-[#0F2744]">
                <Package className="h-5 w-5 text-teal-600 shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-bold">Data Alat & Stok</h3>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Daftar katalog alat gelas, kategori, lokasi penyimpanan, stok sistem, stok minimum,
                dan kondisi.
              </p>
              <p className="mt-3 text-2xl font-bold font-mono tabular-nums text-[#0F2744]">
                {filteredInstruments.length}{' '}
                <span className="text-xs font-sans font-medium text-slate-500">jenis alat</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={filteredInstruments.length === 0}
                onClick={() =>
                  runExport(() =>
                    exportInstrumentsToCsv(
                      filteredInstruments,
                      'SIMLAB_Admin_Alat_Stok_Demo.csv'
                    )
                  )
                }
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white text-xs font-semibold px-3 py-2.5 transition-colors disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                disabled={filteredInstruments.length === 0}
                onClick={() =>
                  runExport(() =>
                    exportInstrumentsToExcel(
                      filteredInstruments,
                      'SIMLAB_Admin_Alat_Stok_Demo.xlsx'
                    )
                  )
                }
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2.5 transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* 3. Rekap Pemeriksaan Semesteran */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-[#0F2744]">
                <ClipboardCheck className="h-5 w-5 text-teal-600 shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-bold">Rekap Pemeriksaan Semesteran</h3>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Rekapitulasi stok sistem vs stok fisik (Juni & Desember), selisih, status
                verifikasi, dan catatan.
              </p>
              <p className="mt-3 text-2xl font-bold font-mono tabular-nums text-[#0F2744]">
                {filteredChecks.length}{' '}
                <span className="text-xs font-sans font-medium text-slate-500">catatan</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={filteredChecks.length === 0}
                onClick={() =>
                  runExport(() =>
                    exportPhysicalChecksToCsv(
                      filteredChecks,
                      'SIMLAB_Admin_Pemeriksaan_Semesteran_Demo.csv'
                    )
                  )
                }
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white text-xs font-semibold px-3 py-2.5 transition-colors disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                disabled={filteredChecks.length === 0}
                onClick={() =>
                  runExport(() =>
                    exportPhysicalChecksToExcel(
                      filteredChecks,
                      'SIMLAB_Admin_Pemeriksaan_Semesteran_Demo.xlsx'
                    )
                  )
                }
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2.5 transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
