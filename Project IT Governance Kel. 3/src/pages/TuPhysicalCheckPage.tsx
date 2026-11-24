import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatDateTime, getInstrumentStock } from '../lib/format';
import {
  createPhysicalCheck,
  fetchInstruments,
  fetchLocations,
  fetchPhysicalChecks,
} from '../lib/simlabApi';
import type { Instrument, LabLocation, PhysicalCheck } from '../types/simlab';

export function TuPhysicalCheckPage() {
  const { profile } = useAuth();
  const { showNotification } = useNotification();
  const [checks, setChecks] = useState<PhysicalCheck[]>([]);
  const [locations, setLocations] = useState<LabLocation[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [period, setPeriod] = useState<'Semester 1' | 'Semester 2'>('Semester 1');
  const [checkYear, setCheckYear] = useState<number>(new Date().getFullYear());
  const [locationId, setLocationId] = useState('');
  const [instrumentId, setInstrumentId] = useState('');
  const [systemStock, setSystemStock] = useState('');
  const [physicalStock, setPhysicalStock] = useState('');
  const [notes, setNotes] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);

    Promise.all([fetchPhysicalChecks(), fetchLocations(), fetchInstruments()])
      .then(([checkRows, locRows, instRows]) => {
        if (!mounted) return;
        setChecks(checkRows);
        setLocations(locRows.filter((l) => l.is_active !== false));
        setInstruments(instRows.filter((i) => i.is_active !== false));
      })
      .catch((err) => {
        if (!mounted) return;
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat data pemeriksaan.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleInstrumentChange = (nextId: string) => {
    setInstrumentId(nextId);
    const found = instruments.find((i) => String(i.id) === String(nextId));
    if (found) {
      setSystemStock(String(getInstrumentStock(found)));
    }
  };

  const liveDifference = useMemo(() => {
    if (systemStock === '' || physicalStock === '') return null;
    const sys = Number(systemStock);
    const phys = Number(physicalStock);
    if (Number.isNaN(sys) || Number.isNaN(phys)) return null;
    return phys - sys;
  }, [systemStock, physicalStock]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!profile) return;
    if (!locationId || !instrumentId) {
      setFormError('Lokasi dan nama alat wajib dipilih.');
      return;
    }

    const sysNum = Number(systemStock);
    const physNum = Number(physicalStock);
    if (
      systemStock === '' ||
      physicalStock === '' ||
      Number.isNaN(sysNum) ||
      Number.isNaN(physNum) ||
      sysNum < 0 ||
      physNum < 0 ||
      !Number.isInteger(sysNum) ||
      !Number.isInteger(physNum)
    ) {
      setFormError('Jumlah stok sistem dan stok fisik harus berupa bilangan bulat minimal 0.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPhysicalCheck({
        period,
        checkYear,
        locationId,
        instrumentId,
        systemStock: sysNum,
        physicalStock: physNum,
        notes,
        checkedBy: profile.id,
        checkedByName: profile.full_name,
      });

      setChecks((prev) => [created, ...prev]);
      setLocationId('');
      setInstrumentId('');
      setSystemStock('');
      setPhysicalStock('');
      setNotes('');
      const diff = created.physical_stock - created.system_stock;
      showNotification({
        variant: 'success',
        title: 'Pemeriksaan Fisik Disimpan',
        message: `${created.period} (${created.check_month} ${created.check_year}) untuk ${created.instrument?.name || 'alat gelas'} telah tercatat (Selisih: ${diff > 0 ? `+${diff}` : diff}). Stok sistem tidak diubah tanpa verifikasi.`,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal menyimpan hasil pemeriksaan semesteran.';
      setFormError(msg);
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => {
          // Keeps form inputs intact so user can review or resubmit
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const checkMonthLabel = period === 'Semester 1' ? 'Juni' : 'Desember';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#0F2744]">
          Rekap Pemeriksaan Fisik Semesteran (Juni & Desember)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Catat perbandingan jumlah stok sistem dan stok fisik alat gelas. Selisih dihitung otomatis
          tanpa mengubah stok alat secara langsung tanpa verifikasi.
        </p>
      </div>

      {/* Form Input Pemeriksaan */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-bold text-[#0F2744] mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-teal-600" aria-hidden="true" />
          <span>Input Hasil Pemeriksaan Fisik</span>
        </h3>

        {formError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Periode Pemeriksaan
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as 'Semester 1' | 'Semester 2')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="Semester 1">Semester 1 (Juni)</option>
                <option value="Semester 2">Semester 2 (Desember)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tahun Pemeriksaan
              </label>
              <input
                type="number"
                min={2020}
                max={2100}
                value={checkYear}
                onChange={(e) => setCheckYear(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lokasi</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="">Pilih lokasi...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nama Alat</label>
              <select
                value={instrumentId}
                onChange={(e) => handleInstrumentChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="">Pilih alat...</option>
                {instruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jumlah Stok pada Sistem
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={systemStock}
                onChange={(e) => setSystemStock(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jumlah Stok Fisik ({checkMonthLabel} {checkYear})
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={physicalStock}
                onChange={(e) => setPhysicalStock(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Selisih Otomatis (Fisik - Sistem)
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono tabular-nums font-semibold">
                {liveDifference === null ? (
                  <span className="text-slate-400">—</span>
                ) : liveDifference === 0 ? (
                  <span className="text-emerald-700">0 (Sesuai)</span>
                ) : liveDifference < 0 ? (
                  <span className="text-red-700">{liveDifference} (Kurang)</span>
                ) : (
                  <span className="text-amber-700">+{liveDifference} (Lebih)</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan Pemeriksaan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan hasil opname fisik, temuan selisih, atau tindak lanjut verifikasi..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-5 py-2.5 transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              <span>{submitting ? 'Menyimpan...' : 'Simpan Hasil Pemeriksaan'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Daftar Pemeriksaan */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50/70">
          <h3 className="text-sm font-semibold text-[#0F2744]">
            Daftar Pemeriksaan Fisik & Selisih Stok
          </h3>
        </div>

        {loadError ? (
          <div className="p-6 text-sm text-red-700 bg-red-50">{loadError}</div>
        ) : loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : checks.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600">
            Belum ada catatan pemeriksaan fisik semesteran.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">Periode</th>
                  <th className="py-3 px-4">Lokasi</th>
                  <th className="py-3 px-4">Nama Alat</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Stok Sistem</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Stok Fisik</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Selisih</th>
                  <th className="py-3 px-4">Catatan</th>
                  <th className="py-3 px-4 whitespace-nowrap">Pemeriksa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {checks.map((row) => {
                  const diff = row.difference ?? row.physical_stock - row.system_stock;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-900">{row.period}</span>
                        <span className="block text-xs text-slate-500">
                          {row.check_month} {row.check_year}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800">{row.location?.name || '—'}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {row.instrument?.name || '—'}
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
                      <td className="py-3 px-4 text-xs text-slate-700 max-w-xs">
                        {row.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{row.checked_by_name}</span>
                        <span className="block text-slate-400 tabular-nums">
                          {formatDateTime(row.created_at)}
                        </span>
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
