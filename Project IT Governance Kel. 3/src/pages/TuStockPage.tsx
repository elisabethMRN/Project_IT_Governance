import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getInstrumentStock } from '../lib/format';
import { fetchDamageReports, fetchInstruments } from '../lib/simlabApi';
import type { DamageReport, Instrument } from '../types/simlab';

export function TuStockPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchInstruments(), fetchDamageReports()])
      .then(([instRows, reportRows]) => {
        if (!mounted) return;
        setInstruments(instRows);
        setReports(reportRows);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat stok alat gelas.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const damagedByInstrument = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reports) {
      if (r.status === 'Diverifikasi' || r.status === 'Tindak Lanjut' || r.status === 'Selesai') {
        const key = String(r.instrument_id);
        map.set(key, (map.get(key) || 0) + r.damaged_qty);
      }
    }
    return map;
  }, [reports]);

  const totalSystemStock = useMemo(
    () => instruments.reduce((acc, i) => acc + getInstrumentStock(i), 0),
    [instruments]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#0F2744]">Stok & Kondisi Alat Gelas</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Rekapitulasi stok sistem, batas stok minimum, dan akumulasi unit rusak terverifikasi
            sebagai bahan pemantauan administrasi.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5">
          <span className="text-xs text-slate-500 mr-2">Total Stok Tercatat:</span>
          <span className="font-mono font-bold text-base tabular-nums text-[#0F2744]">
            {totalSystemStock} Unit
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {error ? (
          <div className="p-6 text-sm text-red-700 bg-red-50">{error}</div>
        ) : loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : instruments.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600">
            Belum ada data alat gelas terdaftar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">Kode / Kategori</th>
                  <th className="py-3 px-4">Nama Alat Gelas</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Stok Sistem</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Stok Minimum</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">
                    Rusak Terverifikasi
                  </th>
                  <th className="py-3 px-4">Status & Kondisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {instruments.map((inst) => {
                  const stockVal = getInstrumentStock(inst);
                  const minStock =
                    typeof inst.minimum_stock === 'number' ? inst.minimum_stock : null;
                  const isLow = minStock !== null && stockVal <= minStock;
                  const verifiedDamaged = damagedByInstrument.get(String(inst.id)) || 0;
                  const unit = inst.unit || 'Unit';

                  return (
                    <tr key={inst.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0F2744] whitespace-nowrap">
                        {inst.code || inst.category || '—'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{inst.name}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {stockVal} {unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {minStock !== null ? `${minStock} ${unit}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-800">
                        {verifiedDamaged} {unit}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          {isLow ? (
                            <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 whitespace-nowrap">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                              <span>Mendekati Minimum</span>
                            </span>
                          ) : (
                            <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 whitespace-nowrap">
                              <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0" aria-hidden="true" />
                              <span>Tersedia</span>
                            </span>
                          )}
                          {(inst.condition || inst.condition_summary) && (
                            <span className="text-xs text-slate-600">
                              {inst.condition || inst.condition_summary}
                            </span>
                          )}
                        </div>
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
