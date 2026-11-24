import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Edit3,
  Loader2,
  Package,
  Plus,
  Power,
  Search,
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { getInstrumentStock } from '../lib/format';
import {
  adminCreateInstrument,
  adminUpdateInstrument,
  fetchDamageReports,
  fetchInstruments,
  fetchLocations,
} from '../lib/simlabApi';
import type { DamageReport, Instrument, LabLocation } from '../types/simlab';

export function AdminInstrumentsPage() {
  const { showNotification } = useNotification();

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [locations, setLocations] = useState<LabLocation[]>([]);
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingInst, setEditingInst] = useState<Instrument | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('Unit');
  const [locationId, setLocationId] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [minimumStock, setMinimumStock] = useState('5');
  const [conditionSummary, setConditionSummary] = useState('Tersedia untuk pengujian');
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchInstruments(), fetchLocations(), fetchDamageReports()])
      .then(([instRows, locRows, reportRows]) => {
        if (!mounted) return;
        setInstruments(instRows);
        setLocations(locRows);
        setReports(reportRows);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat data alat gelas.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const reportCountByInstrument = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reports) {
      const key = String(r.instrument_id);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [reports]);

  const filteredInstruments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return instruments.filter((inst) => {
      const isActive = inst.is_active !== false;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;
      if (!q) return true;
      return [
        inst.code,
        inst.name,
        inst.category,
        inst.location?.name,
        inst.condition_summary,
        inst.condition,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [instruments, search, statusFilter]);

  const openCreateForm = () => {
    setEditingInst(null);
    setCode('');
    setName('');
    setCategory('');
    setUnit('Unit');
    setLocationId('');
    setStockQuantity('0');
    setMinimumStock('5');
    setConditionSummary('Tersedia untuk pengujian');
    setError(null);
    setShowForm(true);
  };

  const openEditForm = (inst: Instrument) => {
    setEditingInst(inst);
    setCode(inst.code || '');
    setName(inst.name);
    setCategory(inst.category || '');
    setUnit(inst.unit || 'Unit');
    setLocationId(inst.location_id ? String(inst.location_id) : '');
    setStockQuantity(String(getInstrumentStock(inst)));
    setMinimumStock(String(typeof inst.minimum_stock === 'number' ? inst.minimum_stock : 5));
    setConditionSummary(inst.condition_summary || inst.condition || 'Tersedia untuk pengujian');
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Nama alat gelas wajib diisi.');
      return;
    }

    const stockNum = Number(stockQuantity);
    const minNum = Number(minimumStock);
    if (
      Number.isNaN(stockNum) ||
      Number.isNaN(minNum) ||
      !Number.isInteger(stockNum) ||
      !Number.isInteger(minNum) ||
      stockNum < 0 ||
      minNum < 0
    ) {
      setError('Stok dan stok minimum harus berupa bilangan bulat minimal 0.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingInst) {
        const updated = await adminUpdateInstrument(editingInst.id, {
          code,
          name,
          category,
          unit,
          locationId,
          stockQuantity: stockNum,
          minimumStock: minNum,
          conditionSummary,
          isActive: editingInst.is_active !== false,
        });
        setInstruments((prev) =>
          prev.map((i) => (String(i.id) === String(updated.id) ? updated : i))
        );
        showNotification({
          variant: 'success',
          title: 'Data Alat Berhasil Disimpan',
          message: `Perubahan data alat "${updated.name}" berhasil disimpan.`,
        });
      } else {
        const created = await adminCreateInstrument({
          code,
          name,
          category,
          unit,
          locationId,
          stockQuantity: stockNum,
          minimumStock: minNum,
          conditionSummary,
        });
        setInstruments((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
        );
        showNotification({
          variant: 'success',
          title: 'Data Alat Berhasil Disimpan',
          message: `Alat gelas baru "${created.name}" berhasil ditambahkan.`,
        });
      }
      setShowForm(false);
      setEditingInst(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan data alat gelas.';
      setError(msg);
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => {},
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (inst: Instrument) => {
    const nextActive = inst.is_active === false;
    setError(null);
    setTogglingId(inst.id);

    try {
      const updated = await adminUpdateInstrument(inst.id, {
        code: inst.code || '',
        name: inst.name,
        category: inst.category || '',
        unit: inst.unit || 'Unit',
        locationId: inst.location_id ? String(inst.location_id) : '',
        stockQuantity: getInstrumentStock(inst),
        minimumStock: typeof inst.minimum_stock === 'number' ? inst.minimum_stock : 5,
        conditionSummary: inst.condition_summary || inst.condition || 'Baik',
        isActive: nextActive,
      });
      setInstruments((prev) =>
        prev.map((i) => (String(i.id) === String(updated.id) ? updated : i))
      );
      showNotification({
        variant: 'success',
        title: 'Data Alat Berhasil Disimpan',
        message: nextActive
          ? `Alat gelas "${updated.name}" berhasil diaktifkan kembali.`
          : `Alat gelas "${updated.name}" berhasil dinonaktifkan. Data historis pada laporan tetap aman.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah status alat.';
      setError(msg);
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => handleToggleActive(inst),
      });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#0F2744]">Manajemen Alat Gelas & Stok</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola katalog alat gelas, kategori, satuan, lokasi, stok sistem, dan stok minimum.
            Alat yang pernah digunakan pada laporan tidak dapat dihapus permanen.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Tambah Alat Gelas</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-200 bg-white p-6 space-y-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Package className="h-4 w-4 text-teal-600" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[#0F2744]">
              {editingInst ? `Ubah Alat: ${editingInst.name}` : 'Tambah Alat Gelas Baru'}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kode Alat <span className="text-slate-400">(Opsional)</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Contoh: GLS-BG-500"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Alat Gelas <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Beaker Glass 500 mL"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Contoh: Gelas Kimia / Labu Ukur"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Satuan <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Unit / Buah / Pcs"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Lokasi Penyimpanan
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="">Umum / Semua Lokasi</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                    {loc.is_active === false ? ' (Nonaktif)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Stok Sistem <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={1}
                required
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Stok Minimum <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={1}
                required
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Kondisi Alat</label>
              <input
                type="text"
                value={conditionSummary}
                onChange={(e) => setConditionSummary(e.target.value)}
                placeholder="Contoh: Tersedia untuk pengujian"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingInst(null);
              }}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white text-xs font-semibold disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              <span>
                {submitting ? 'Menyimpan...' : editingInst ? 'Simpan Perubahan' : 'Tambah Alat'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode, nama alat, kategori, atau lokasi..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          aria-label="Filter status alat"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
        >
          <option value="all">Semua Status</option>
          <option value="active">Alat Aktif</option>
          <option value="inactive">Alat Nonaktif</option>
        </select>
      </div>

      {/* Instruments Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : filteredInstruments.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600">
            Tidak ada alat gelas yang sesuai dengan filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">Kode</th>
                  <th className="py-3 px-4">Nama Alat Gelas</th>
                  <th className="py-3 px-4">Kategori & Lokasi</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Stok</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Min. Stok</th>
                  <th className="py-3 px-4">Kondisi & Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredInstruments.map((inst) => {
                  const stockVal = getInstrumentStock(inst);
                  const minStock =
                    typeof inst.minimum_stock === 'number' ? inst.minimum_stock : null;
                  const isLow = minStock !== null && stockVal <= minStock;
                  const isActive = inst.is_active !== false;
                  const isToggling = togglingId === inst.id;
                  const usedCount = reportCountByInstrument.get(String(inst.id)) || 0;
                  const unitLabel = inst.unit || 'Unit';

                  return (
                    <tr key={inst.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0F2744] whitespace-nowrap">
                        {inst.code || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{inst.name}</div>
                        {usedCount > 0 && (
                          <span className="text-xs text-slate-500">
                            Terkait {usedCount} laporan kerusakan
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <span className="font-medium text-slate-800 block">
                          {inst.category || 'Umum'}
                        </span>
                        <span>{inst.location?.name || 'Semua Lokasi'}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {stockVal} {unitLabel}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {minStock !== null ? `${minStock} ${unitLabel}` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap gap-1.5">
                            {isActive ? (
                              <span className="inline-flex items-center rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                Nonaktif
                              </span>
                            )}
                            {isLow && isActive && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                <span>Stok Minimum</span>
                              </span>
                            )}
                          </div>
                          {(inst.condition_summary || inst.condition) && (
                            <span className="text-xs text-slate-600">
                              {inst.condition_summary || inst.condition}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(inst)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Ubah</span>
                          </button>
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleActive(inst)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                              isActive
                                ? 'border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900'
                                : 'border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-900'
                            }`}
                          >
                            {isToggling ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <Power className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            <span>{isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                          </button>
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
