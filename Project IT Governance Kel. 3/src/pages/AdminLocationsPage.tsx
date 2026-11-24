import React, { useEffect, useState } from 'react';
import { Building2, Edit3, Loader2, Plus, Power } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { adminCreateLocation, adminUpdateLocation, fetchLocations } from '../lib/simlabApi';
import type { LabLocation } from '../types/simlab';

export function AdminLocationsPage() {
  const { showNotification } = useNotification();

  const [locations, setLocations] = useState<LabLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add / Edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingLoc, setEditingLoc] = useState<LabLocation | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchLocations()
      .then((rows) => {
        if (!mounted) return;
        setLocations(rows);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat daftar lokasi.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const openCreateForm = () => {
    setEditingLoc(null);
    setCode('');
    setName('');
    setDescription('');
    setError(null);
    setShowForm(true);
  };

  const openEditForm = (loc: LabLocation) => {
    setEditingLoc(loc);
    setCode(loc.code || '');
    setName(loc.name);
    setDescription(loc.description || '');
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Nama lokasi laboratorium wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingLoc) {
        const updated = await adminUpdateLocation({
          id: editingLoc.id,
          code,
          name,
          description,
          isActive: editingLoc.is_active !== false,
        });
        setLocations((prev) =>
          prev.map((l) => (String(l.id) === String(updated.id) ? updated : l))
        );
        showNotification({
          variant: 'success',
          title: 'Lokasi Diperbarui',
          message: `Data lokasi "${updated.name}" berhasil diperbarui.`,
        });
      } else {
        const created = await adminCreateLocation({ code, name, description });
        setLocations((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        showNotification({
          variant: 'success',
          title: 'Lokasi Ditambahkan',
          message: `Lokasi baru "${created.name}" berhasil ditambahkan.`,
        });
      }
      setShowForm(false);
      setEditingLoc(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan data lokasi.';
      setError(msg);
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => setShowForm(true),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (loc: LabLocation) => {
    const nextActive = loc.is_active === false;
    setError(null);
    setTogglingId(loc.id);

    try {
      const updated = await adminUpdateLocation({
        id: loc.id,
        code: loc.code || '',
        name: loc.name,
        description: loc.description || '',
        isActive: nextActive,
      });
      setLocations((prev) =>
        prev.map((l) => (String(l.id) === String(updated.id) ? updated : l))
      );
      const msg = nextActive
        ? `Lokasi "${updated.name}" diaktifkan kembali.`
        : `Lokasi "${updated.name}" dinonaktifkan dari pilihan input baru.`;
      showNotification({
        variant: 'success',
        title: nextActive ? 'Lokasi Diaktifkan' : 'Lokasi Dinonaktifkan',
        message: msg,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah status lokasi.';
      setError(msg);
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => {
          void handleToggleActive(loc);
        },
      });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#0F2744]">Manajemen Lokasi Laboratorium</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tambah, ubah nama, atau nonaktifkan lokasi laboratorium. Lokasi nonaktif tetap
            tersimpan pada riwayat laporan lama.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Tambah Lokasi</span>
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
            <Building2 className="h-4 w-4 text-teal-600" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[#0F2744]">
              {editingLoc ? `Ubah Lokasi: ${editingLoc.name}` : 'Tambah Lokasi Laboratorium Baru'}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kode Lokasi <span className="text-slate-400">(Opsional)</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Contoh: LAB-DEMO-C"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Lokasi Laboratorium <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Laboratorium Mikrobiologi Demo"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Keterangan / Deskripsi <span className="text-slate-400">(Opsional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi singkat fungsi ruangan laboratorium..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingLoc(null);
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
              <span>{submitting ? 'Menyimpan...' : editingLoc ? 'Simpan Perubahan' : 'Tambah Lokasi'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Locations Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : locations.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600">
            Belum ada lokasi laboratorium terdaftar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">Kode</th>
                  <th className="py-3 px-4">Nama Lokasi</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {locations.map((loc) => {
                  const isActive = loc.is_active !== false;
                  const isToggling = togglingId === loc.id;
                  return (
                    <tr key={loc.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0F2744] whitespace-nowrap">
                        {loc.code || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{loc.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-md">
                        {loc.description || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center rounded-md border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(loc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Ubah</span>
                          </button>
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleActive(loc)}
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
