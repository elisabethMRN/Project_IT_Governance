import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatDateTime } from '../lib/format';
import {
  adminVerifyPhysicalCheck,
  fetchInstruments,
  fetchLocations,
  fetchPhysicalChecks,
} from '../lib/simlabApi';
import type {
  Instrument,
  LabLocation,
  PhysicalCheck,
  PhysicalCheckVerificationStatus,
} from '../types/simlab';

export function AdminPhysicalChecksPage() {
  const { profile } = useAuth();
  const { showNotification } = useNotification();

  const [checks, setChecks] = useState<PhysicalCheck[]>([]);
  const [locations, setLocations] = useState<LabLocation[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<'all' | 'Semester 1' | 'Semester 2'>('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [instrumentFilter, setInstrumentFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<'all' | PhysicalCheckVerificationStatus>(
    'all'
  );

  // Selected check for verification / note editing
  const [editingCheck, setEditingCheck] = useState<PhysicalCheck | null>(null);
  const [verificationStatus, setVerificationStatus] =
    useState<PhysicalCheckVerificationStatus>('Terverifikasi');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [checkNotes, setCheckNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchPhysicalChecks(), fetchLocations(), fetchInstruments()])
      .then(([checkRows, locRows, instRows]) => {
        if (!mounted) return;
        setChecks(checkRows);
        setLocations(locRows);
        setInstruments(instRows);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat data pemeriksaan semesteran.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredChecks = useMemo(() => {
    return checks.filter((c) => {
      if (periodFilter !== 'all' && c.period !== periodFilter) return false;
      if (locationFilter && String(c.location_id) !== String(locationFilter)) return false;
      if (instrumentFilter && String(c.instrument_id) !== String(instrumentFilter)) return false;
      const vStatus = c.verification_status || 'Belum Diverifikasi';
      if (verificationFilter !== 'all' && vStatus !== verificationFilter) return false;
      return true;
    });
  }, [checks, periodFilter, locationFilter, instrumentFilter, verificationFilter]);

  const openVerifyForm = (row: PhysicalCheck) => {
    setEditingCheck(row);
    setVerificationStatus(
      row.verification_status && row.verification_status !== 'Belum Diverifikasi'
        ? row.verification_status
        : 'Terverifikasi'
    );
    setVerificationNotes(row.verification_notes || '');
    setCheckNotes(row.notes || '');
    setError(null);
  };

  const handleSaveVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !editingCheck) return;

    const currentCheck = editingCheck;
    setError(null);
    setSaving(true);

    try {
      const updated = await adminVerifyPhysicalCheck({
        checkId: currentCheck.id,
        verifierId: profile.id,
        verifierName: profile.full_name,
        verificationStatus,
        verificationNotes,
        checkNotes,
      });
      setChecks((prev) =>
        prev.map((c) => (String(c.id) === String(updated.id) ? updated : c))
      );
      setEditingCheck(null);
      showNotification({
        variant: 'success',
        title: 'Pemeriksaan Fisik Diverifikasi',
        message: `Pemeriksaan ${updated.instrument?.name || 'alat'} (${updated.period} ${updated.check_year}) ditandai "${updated.verification_status}".`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan verifikasi pemeriksaan.';
      setError(msg);
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => setEditingCheck(currentCheck),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#0F2744]">
            Pemantauan & Verifikasi Pemeriksaan Semesteran
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tinjau hasil opname fisik bulan Juni dan Desember, selisih stok sistem vs stok fisik,
            serta berikan verifikasi dan catatan pemeriksaan.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 shrink-0">
          <ClipboardCheck className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
          <span>{filteredChecks.length} Catatan Pemeriksaan</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Verification Modal / Panel */}
      {editingCheck && (
        <form
          onSubmit={handleSaveVerification}
          className="rounded-lg border border-teal-200 bg-teal-50/40 p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-teal-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <h3 className="text-sm font-bold text-[#0F2744]">
                Verifikasi Pemeriksaan: {editingCheck.instrument?.name || 'Alat Gelas'} (
                {editingCheck.period} · {editingCheck.check_month} {editingCheck.check_year})
              </h3>
            </div>
            <span className="text-xs font-mono font-semibold text-[#0F2744]">
              Sistem: {editingCheck.system_stock} | Fisik: {editingCheck.physical_stock} | Selisih:{' '}
              {editingCheck.difference ?? editingCheck.physical_stock - editingCheck.system_stock}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Status Verifikasi Pemeriksaan
              </label>
              <select
                value={verificationStatus}
                onChange={(e) =>
                  setVerificationStatus(e.target.value as PhysicalCheckVerificationStatus)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="Terverifikasi">Terverifikasi</option>
                <option value="Perlu Tindak Lanjut">Perlu Tindak Lanjut</option>
                <option value="Belum Diverifikasi">Belum Diverifikasi</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Catatan Pemeriksaan Fisik
              </label>
              <input
                type="text"
                value={checkNotes}
                onChange={(e) => setCheckNotes(e.target.value)}
                placeholder="Perbarui atau lengkapi catatan pemeriksaan..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan Verifikasi Admin
            </label>
            <textarea
              rows={2}
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              placeholder="Contoh: Selisih sesuai dengan laporan kerusakan SIM-DEMO-001 yang sudah diverifikasi."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingCheck(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white text-xs font-semibold disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              <span>{saving ? 'Menyimpan...' : 'Simpan Verifikasi'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Periode</label>
          <select
            value={periodFilter}
            onChange={(e) =>
              setPeriodFilter(e.target.value as 'all' | 'Semester 1' | 'Semester 2')
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          >
            <option value="all">Semua Periode</option>
            <option value="Semester 1">Semester 1 (Juni)</option>
            <option value="Semester 2">Semester 2 (Desember)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Lokasi</label>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          >
            <option value="">Semua Lokasi</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Alat Gelas</label>
          <select
            value={instrumentFilter}
            onChange={(e) => setInstrumentFilter(e.target.value)}
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
            Status Verifikasi
          </label>
          <select
            value={verificationFilter}
            onChange={(e) =>
              setVerificationFilter(e.target.value as 'all' | PhysicalCheckVerificationStatus)
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          >
            <option value="all">Semua Status Verifikasi</option>
            <option value="Belum Diverifikasi">Belum Diverifikasi</option>
            <option value="Terverifikasi">Terverifikasi</option>
            <option value="Perlu Tindak Lanjut">Perlu Tindak Lanjut</option>
          </select>
        </div>
      </div>

      {/* Physical Checks Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : filteredChecks.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600">
            Tidak ada hasil pemeriksaan fisik yang sesuai dengan filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">Periode</th>
                  <th className="py-3 px-4">Lokasi & Alat</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Sistem</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Fisik</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Selisih</th>
                  <th className="py-3 px-4">Verifikasi</th>
                  <th className="py-3 px-4">Catatan</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredChecks.map((row) => {
                  const diff = row.difference ?? row.physical_stock - row.system_stock;
                  const vStatus = row.verification_status || 'Belum Diverifikasi';
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-900">{row.period}</span>
                        <span className="block text-xs text-slate-500">
                          {row.check_month} {row.check_year}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900 block">
                          {row.instrument?.name || '—'}
                        </span>
                        <span className="text-xs text-slate-500">{row.location?.name || '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {row.system_stock}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {row.physical_stock}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                        {diff === 0 ? (
                          <span className="text-emerald-700">0 (Sesuai)</span>
                        ) : diff < 0 ? (
                          <span className="text-red-700">{diff}</span>
                        ) : (
                          <span className="text-amber-700">+{diff}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                            vStatus === 'Terverifikasi'
                              ? 'border-teal-200 bg-teal-50 text-teal-800'
                              : vStatus === 'Perlu Tindak Lanjut'
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-slate-300 bg-slate-100 text-slate-700'
                          }`}
                        >
                          {vStatus}
                        </span>
                        {row.verified_by_name && (
                          <span className="block text-xs text-slate-500 mt-1">
                            Oleh {row.verified_by_name}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 max-w-xs space-y-1">
                        {row.notes && <p>{row.notes}</p>}
                        {row.verification_notes && (
                          <p className="text-teal-800 font-medium">
                            Verifikasi: {row.verification_notes}
                          </p>
                        )}
                        <span className="block text-slate-400 tabular-nums">
                          Pemeriksa: {row.checked_by_name} · {formatDateTime(row.created_at)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openVerifyForm(row)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white text-xs font-semibold whitespace-nowrap"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Verifikasi / Catatan</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
