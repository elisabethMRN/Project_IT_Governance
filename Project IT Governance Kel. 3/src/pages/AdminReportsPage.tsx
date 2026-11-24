import { useEffect, useMemo, useState } from 'react';
import { Eye, RotateCcw, Search } from 'lucide-react';
import { ReportDetailModal } from '../components/ReportDetailModal';
import { StatusBadge } from '../components/StatusBadge';
import { filterReports, formatDate } from '../lib/format';
import {
  fetchAssignableProfiles,
  fetchDamageReports,
  fetchInstruments,
  fetchLocations,
} from '../lib/simlabApi';
import type {
  DamageReport,
  Instrument,
  LabLocation,
  Profile,
  ReportFilters,
  ReportStatus,
} from '../types/simlab';

const DEFAULT_FILTERS: ReportFilters = {
  search: '',
  locationId: '',
  instrumentId: '',
  status: '',
  userId: '',
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

export function AdminReportsPage() {
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [locations, setLocations] = useState<LabLocation[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchDamageReports(),
      fetchLocations(),
      fetchInstruments(),
      fetchAssignableProfiles(),
    ])
      .then(([reportRows, locRows, instRows, userRows]) => {
        if (!mounted) return;
        setReports(reportRows);
        setLocations(locRows);
        setInstruments(instRows);
        setUsers(userRows);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat seluruh laporan kerusakan.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredReports = useMemo(() => filterReports(reports, filters), [reports, filters]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#0F2744]">Manajemen Seluruh Laporan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau seluruh laporan kerusakan, riwayat aktivitas, sesuaikan status bila diperlukan,
            dan tambahkan catatan administratif. Penghapusan permanen dinonaktifkan.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 shrink-0">
          Menampilkan <span className="font-mono font-bold">{filteredReports.length}</span> dari{' '}
          <span className="font-mono font-bold">{reports.length}</span> laporan
        </div>
      </div>

      {/* Filter Panel */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#0F2744]">Filter Laporan</h3>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Filter</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
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
                placeholder="ID Laporan, alat, deskripsi..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
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
              Pengguna (Pelapor / Verifikator / PIC)
            </label>
            <select
              value={filters.userId || ''}
              onChange={(e) => setFilters((p) => ({ ...p, userId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              <option value="">Semua Pengguna</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
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

      {/* Reports Table */}
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
          <div className="p-10 text-center text-sm text-slate-600">
            Tidak ada laporan yang cocok dengan filter yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">ID Laporan</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tanggal</th>
                  <th className="py-3 px-4">Pelapor</th>
                  <th className="py-3 px-4">Lokasi</th>
                  <th className="py-3 px-4">Nama Alat</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Rusak</th>
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
                    <td className="py-3 px-4 text-slate-800 whitespace-nowrap">
                      {report.reporter_name}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{report.location?.name || '—'}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {report.instrument?.name || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {report.damaged_qty}
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
                        <span>Detail & Kelola</span>
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
        adminMode
        onClose={() => setSelectedReport(null)}
        onReopenReport={(rep) => setSelectedReport(rep)}
        onUpdated={(updated) => {
          setReports((prev) =>
            prev.map((r) => (String(r.id) === String(updated.id) ? updated : r))
          );
        }}
      />
    </div>
  );
}
