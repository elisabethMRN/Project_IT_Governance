import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { createDamageReport, fetchInstruments, fetchLocations } from '../lib/simlabApi';
import type { DamageReport, Instrument, LabLocation } from '../types/simlab';

interface CreateReportPageProps {
  onSuccessBack: () => void;
  onViewCreatedReport?: (report: DamageReport) => void;
}

export function CreateReportPage({ onSuccessBack, onViewCreatedReport }: CreateReportPageProps) {
  const { profile } = useAuth();
  const { showNotification } = useNotification();
  const [locations, setLocations] = useState<LabLocation[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [masterError, setMasterError] = useState<string | null>(null);

  const [locationId, setLocationId] = useState('');
  const [instrumentId, setInstrumentId] = useState('');
  const [damagedQty, setDamagedQty] = useState('1');
  const [description, setDescription] = useState('');
  const [testingImpact, setTestingImpact] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingMaster(true);

    Promise.all([fetchLocations(), fetchInstruments()])
      .then(([locs, insts]) => {
        if (!mounted) return;
        setLocations(locs.filter((l) => l.is_active !== false));
        setInstruments(insts.filter((i) => i.is_active !== false));
      })
      .catch((err) => {
        if (!mounted) return;
        setMasterError(
          err instanceof Error
            ? err.message
            : 'Gagal memuat data lokasi dan alat dari database.'
        );
      })
      .finally(() => {
        if (mounted) setLoadingMaster(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFieldErrors((prev) => ({ ...prev, photo: 'File foto harus berupa gambar (JPG/PNG).' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, photo: 'Ukuran foto maksimal 5 MB.' }));
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.photo;
      return next;
    });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!locationId) {
      errors.locationId = 'Lokasi laboratorium wajib dipilih.';
    }
    if (!instrumentId) {
      errors.instrumentId = 'Nama alat gelas wajib dipilih.';
    }
    const qtyNum = Number(damagedQty);
    if (!damagedQty || Number.isNaN(qtyNum) || !Number.isInteger(qtyNum) || qtyNum <= 0) {
      errors.damagedQty = 'Jumlah alat rusak harus berupa bilangan bulat lebih dari 0.';
    }
    if (!description.trim()) {
      errors.description = 'Deskripsi kejadian kerusakan wajib diisi.';
    } else if (description.trim().length < 10) {
      errors.description = 'Deskripsi kejadian minimal 10 karakter agar mudah diverifikasi.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!profile) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const report = await createDamageReport({
        reporterId: profile.id,
        reporterName: profile.full_name,
        locationId,
        instrumentId,
        damagedQty: Number(damagedQty),
        description,
        testingImpact,
        photoFile,
      });

      setLocationId('');
      setInstrumentId('');
      setDamagedQty('1');
      setDescription('');
      setTestingImpact('');
      clearPhoto();
      setFieldErrors({});
      onSuccessBack();

      showNotification({
        variant: 'success',
        title: 'Laporan Berhasil Dikirim',
        code: report.report_code,
        message: 'Laporan kerusakan alat gelas berhasil dikirim dan menunggu verifikasi.',
        primaryLabel: 'Lihat Laporan',
        onPrimaryAction: () => {
          if (onViewCreatedReport) {
            onViewCreatedReport(report);
          } else {
            onSuccessBack();
          }
        },
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal mengirim laporan kerusakan ke server.';
      setSubmitError(msg);
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        closeOnBackdrop: false,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => {},
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onSuccessBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#0F2744] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Kembali ke Daftar Laporan</span>
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
        <div className="pb-5 mb-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-[#0F2744]">Formulir Laporan Kerusakan Alat Gelas</h2>
          <p className="text-xs text-slate-500 mt-1">
            Lengkapi data kerusakan di bawah ini. Laporan yang dikirim akan masuk ke antrean
            verifikasi Supervisor / QA.
          </p>
        </div>

        {masterError && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {masterError}
          </div>
        )}

        {submitError && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {submitError}
          </div>
        )}

        {loadingMaster ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-24 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Lokasi Laboratorium <span className="text-red-600">*</span>
                </label>
                <select
                  id="location"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 ${
                    fieldErrors.locationId
                      ? 'border-red-400 focus:border-red-600 focus:ring-red-600/20'
                      : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600/20'
                  }`}
                >
                  <option value="">Pilih lokasi laboratorium...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.locationId && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.locationId}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="instrument"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Nama Alat Gelas <span className="text-red-600">*</span>
                </label>
                <select
                  id="instrument"
                  value={instrumentId}
                  onChange={(e) => setInstrumentId(e.target.value)}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 ${
                    fieldErrors.instrumentId
                      ? 'border-red-400 focus:border-red-600 focus:ring-red-600/20'
                      : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600/20'
                  }`}
                >
                  <option value="">Pilih nama alat...</option>
                  {instruments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.instrumentId && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.instrumentId}</p>
                )}
              </div>
            </div>

            <div className="sm:w-1/2 sm:pr-2.5">
              <label
                htmlFor="damagedQty"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Jumlah Alat Rusak <span className="text-red-600">*</span>
              </label>
              <input
                id="damagedQty"
                type="number"
                min={1}
                step={1}
                value={damagedQty}
                onChange={(e) => setDamagedQty(e.target.value)}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white focus:outline-none focus:ring-2 ${
                  fieldErrors.damagedQty
                    ? 'border-red-400 focus:border-red-600 focus:ring-red-600/20'
                    : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600/20'
                }`}
              />
              {fieldErrors.damagedQty && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.damagedQty}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Deskripsi Kejadian <span className="text-red-600">*</span>
              </label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan kronologi dan kondisi kerusakan alat gelas (misal: bibir gelas retak saat pencucian setelah preparasi)."
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 ${
                  fieldErrors.description
                    ? 'border-red-400 focus:border-red-600 focus:ring-red-600/20'
                    : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600/20'
                }`}
              />
              {fieldErrors.description && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="testingImpact"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Dampak Terhadap Pengujian <span className="text-xs text-slate-400">(Opsional)</span>
              </label>
              <textarea
                id="testingImpact"
                rows={2}
                value={testingImpact}
                onChange={(e) => setTestingImpact(e.target.value)}
                placeholder="Contoh: Menggunakan unit cadangan sehingga pengujian tetap berjalan."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Foto Kerusakan <span className="text-xs text-slate-400">(Opsional, maksimal 5 MB)</span>
              </label>
              {!photoPreview ? (
                <label className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <Upload className="h-5 w-5 text-slate-500 mb-2" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-700">
                    Pilih file gambar dokumentasi kerusakan
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5">Format JPG atau PNG</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="sr-only"
                  />
                </label>
              ) : (
                <div className="relative inline-block rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <img
                    src={photoPreview}
                    alt="Pratinjau foto kerusakan"
                    className="max-h-48 rounded object-contain"
                  />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    aria-label="Hapus foto"
                    className="absolute -top-2 -right-2 rounded-full bg-slate-900 text-white p-1 hover:bg-red-600 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
              {fieldErrors.photo && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.photo}</p>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onSuccessBack}
                className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>{submitting ? 'Mengirim Laporan...' : 'Kirim Laporan'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
