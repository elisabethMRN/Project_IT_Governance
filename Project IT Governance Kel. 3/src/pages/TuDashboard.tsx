import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, FileSpreadsheet, RotateCcw, Search } from 'lucide-react';
import { ReportDetailModal } from '../components/ReportDetailModal';
import { StatusBadge } from '../components/StatusBadge';
import { useNotification } from '../context/NotificationContext';
import { exportReportsToCsv, exportReportsToExcel } from '../lib/export';
import { filterReports, formatDate } from '../lib/format';
import { fetchDamageReports, fetchInstruments, fetchLocations } from '../lib/simlabApi';
import type { DamageReport, Instrument, LabLocation, ReportFilters } from '../types/simlab';

const DEFAULT_FILTERS: ReportFilters = {
  search: '',
  locationId: '',
  instrumentId: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  period: 'all',
};

const VERIFIED_STATUSES = ['Diverifikasi', 'Tindak Lanjut', 'Selesai'];

export function TuDashboard() {
  const { showNotification } = useNotification();
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [locations, setLocations] = useState<LabLocation[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);

  const runExport = (fn: () => void, fallbackMsg: string) => {
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
        message: err instanceof Error ? err.message : fallbackMsg,
        closeOnBackdrop: false,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => runExport(fn, fallbackMsg),
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchDamageReports(), fetchLocations(), fetchInstruments()])
      .then(([reportRows, locRows, instRows]) => {
        if (!mounted) return;
        const verifiedOnly = reportRows.filter((r) => VERIFIED_STATUSES.includes(r.status));
        setReports(verifiedOnly);
        setLocations(locRows);
        setInstruments(instRows);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat laporan terverifikasi.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredReports = useMemo(() => filterReports(reports, filters), [reports, filters]);

  const counts = useMemo(() => {
    const totalDamagedUnits = filteredReports.reduce((acc, r) => acc + r.damaged_qty, 0);
    return {
      totalReports: filteredReports.length,
      verified: filteredReports.filter((r) => r.status === 'Diverifikasi').length,
      followUp: filteredReports.filter((r) => r.status === 'Tindak Lanjut').length,
      completed: filteredReports.filter((r) => r.status === 'Selesai').length,
      totalDamagedUnits,
    };
  }, [filteredReports]);

  return (
    <div className="space-y-6">
      {/* Header & Export Readiness Notice */}
      <div className="rounded-lg border border-teal-200 bg-teal-50/70 px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#0F2744]">
            Data siap ekspor untuk proses administrasi berikutnya
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            Menampilkan laporan kerusakan yang telah diverifikasi Supervisor / QA. File ekspor
            bukan merupakan format impor resmi SAKTI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              runExport(
                () => exportReportsToCsv(filteredReports, 'SIMLAB_Laporan_Kerusakan_Demo.csv'),
                'Gagal mengekspor file laporan CSV.'
              )
            }
            disabled={filteredReports.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white text-xs font-semibold px-4 py-2.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            onClick={() =>
              runExport(
                () => exportReportsToExcel(filteredReports, 'SIMLAB_Laporan_Kerusakan_Demo.xlsx'),
                'Gagal mengekspor file laporan Excel.'
              )
            }
            disabled={filteredReports.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Summary Metric Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Laporan Terfilter</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#0F2744]">
            {counts.totalReports}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Diverifikasi</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-teal-700">
            {counts.verified}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Tindak Lanjut</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-sky-800">
            {counts.followUp}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Selesai</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {counts.completed}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 col-span-2 lg:col-span-1">
          <p className="text-xs font-medium text-slate-500">Total Unit Rusak</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#0F2744]">
            {counts.totalDamagedUnits}
          </p>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#0F2744]">Filter Laporan Sebelum Ekspor</h2>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Filter</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Pencarian</label>
            <div className="relative">
              <Search
                className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={filters.search}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                placeholder="ID Laporan, alat, PIC..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>

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
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              <option value="">Semua Terverifikasi</option>
              <option value="Diverifikasi">Diverifikasi</option>
              <option value="Tindak Lanjut">Tindak Lanjut</option>
              <option value="Selesai">Selesai</option>
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
              <option value="Semester 1">Semester 1 (Jan–Jun)</option>
              <option value="Semester 2">Semester 2 (Jul–Des)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
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

      {/* Verified Reports Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {error ? (
          <div className="p-6 text-sm text-red-700 bg-red-50">{error}</div>
        ) : loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              Tidak ada laporan terverifikasi yang cocok dengan filter yang dipilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">ID Laporan</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tanggal</th>
                  <th className="py-3 px-4">Nama Alat</th>
                  <th className="py-3 px-4">Lokasi</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Jumlah Rusak</th>
                  <th className="py-3 px-4">Verifikator</th>
                  <th className="py-3 px-4">PIC & Tenggat</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => setSelectedReport(report)}
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0F2744] whitespace-nowrap tabular-nums">
                      {report.report_code}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap tabular-nums">
                      {formatDate(report.created_at)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {report.instrument?.name || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{report.location?.name || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {report.damaged_qty}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {report.verifier_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {report.pic_name ? (
                        <div>
                          <span className="font-medium text-slate-900">{report.pic_name}</span>
                          {report.follow_up_deadline && (
                            <span className="block text-slate-500 tabular-nums">
                              {formatDate(report.follow_up_deadline)}
                            </span>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReport(report);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Detail</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReportDetailModal
        report={selectedReport}
        canManage={false}
        onClose={() => setSelectedReport(null)}
        onUpdated={() => {}}
      />
    </div>
  );
}
