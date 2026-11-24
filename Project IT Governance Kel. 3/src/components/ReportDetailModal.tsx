import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ImageOff,
  MessageSquarePlus,
  RefreshCw,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatDate, formatDateTime, getRoleLabel } from '../lib/format';
import {
  addReportNote,
  adminUpdateReportStatus,
  assignFollowUpReport,
  completeDamageReport,
  fetchAssignableProfiles,
  fetchReportActivityLogs,
  rejectDamageReport,
  verifyDamageReport,
} from '../lib/simlabApi';
import type { DamageReport, Profile, ReportActivityLog, ReportStatus } from '../types/simlab';
import { StatusBadge } from './StatusBadge';

interface ReportDetailModalProps {
  report: DamageReport | null;
  canManage: boolean;
  adminMode?: boolean;
  onClose: () => void;
  onReopenReport?: (report: DamageReport) => void;
  onUpdated: (updated: DamageReport) => void;
}

const REPORT_STATUSES: ReportStatus[] = [
  'Menunggu Verifikasi',
  'Diverifikasi',
  'Ditolak',
  'Tindak Lanjut',
  'Selesai',
];

export function ReportDetailModal({
  report,
  canManage,
  adminMode = false,
  onClose,
  onReopenReport,
  onUpdated,
}: ReportDetailModalProps) {
  const { profile } = useAuth();
  const { showNotification } = useNotification();
  const [logs, setLogs] = useState<ReportActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [picUsers, setPicUsers] = useState<Profile[]>([]);
  const [imgError, setImgError] = useState(false);

  // Supervisor / Admin action state
  const [activeAction, setActiveAction] = useState<
    'none' | 'verify' | 'reject' | 'followup' | 'complete' | 'note' | 'admin_status'
  >('none');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [testingImpactInput, setTestingImpactInput] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedPicId, setSelectedPicId] = useState('');
  const [followUpDeadline, setFollowUpDeadline] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [additionalNote, setAdditionalNote] = useState('');
  const [adminNextStatus, setAdminNextStatus] = useState<ReportStatus>('Menunggu Verifikasi');
  const [adminStatusNote, setAdminStatusNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadLogs = async (reportId: string) => {
    setLoadingLogs(true);
    try {
      const data = await fetchReportActivityLogs(reportId);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (!report) return;
    setImgError(false);
    setActiveAction('none');
    setVerificationNotes(report.verification_notes || '');
    setTestingImpactInput(report.testing_impact || '');
    setRejectionReason('');
    setSelectedPicId(report.pic_id || '');
    setFollowUpDeadline(report.follow_up_deadline || '');
    setFollowUpNotes(report.follow_up_notes || '');
    setCompletionNotes('');
    setAdditionalNote('');
    setAdminNextStatus(report.status);
    setAdminStatusNote('');
    setActionError(null);

    loadLogs(report.id);

    if (canManage) {
      fetchAssignableProfiles()
        .then((users) => {
          setPicUsers(users);
          if (!report.pic_id && users.length > 0) {
            setSelectedPicId(users[0].id);
          }
        })
        .catch(() => setPicUsers([]));
    }
  }, [report, canManage]);

  if (!report) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    setActionError(null);

    try {
      const updated = await verifyDamageReport({
        reportId: report.id,
        verifierId: profile.id,
        verifierName: profile.full_name,
        verificationNotes,
        testingImpact: testingImpactInput,
      });
      onUpdated(updated);
      setActiveAction('none');
      onClose();
      showNotification({
        variant: 'success',
        title: 'Laporan Diverifikasi',
        code: updated.report_code,
        message: 'Laporan telah diverifikasi dan siap diproses lebih lanjut.',
        primaryLabel: 'Lihat Laporan',
        onPrimaryAction: () => onReopenReport?.(updated),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memverifikasi laporan.';
      const currentReport = report;
      onClose();
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        closeOnBackdrop: false,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => onReopenReport?.(currentReport),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!rejectionReason.trim()) {
      setActionError('Alasan penolakan wajib diisi.');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const updated = await rejectDamageReport({
        reportId: report.id,
        verifierId: profile.id,
        verifierName: profile.full_name,
        rejectionReason,
      });
      onUpdated(updated);
      setActiveAction('none');
      onClose();
      showNotification({
        variant: 'error',
        title: 'Laporan Ditolak',
        code: updated.report_code,
        message: 'Laporan ditolak. Pastikan alasan penolakan telah dicatat.',
        closeOnBackdrop: true,
        primaryLabel: 'Lihat Laporan',
        onPrimaryAction: () => onReopenReport?.(updated),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menolak laporan.';
      const currentReport = report;
      onClose();
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        closeOnBackdrop: false,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => onReopenReport?.(currentReport),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!selectedPicId) {
      setActionError('Pilih PIC tindak lanjut terlebih dahulu.');
      return;
    }
    if (!followUpDeadline) {
      setActionError('Tentukan tenggat tindak lanjut.');
      return;
    }

    const picked = picUsers.find((u) => String(u.id) === String(selectedPicId));
    if (!picked) {
      setActionError('Pengguna PIC tidak valid.');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const updated = await assignFollowUpReport({
        reportId: report.id,
        actorId: profile.id,
        actorName: profile.full_name,
        picId: picked.id,
        picName: picked.full_name,
        deadline: followUpDeadline,
        followUpNotes,
      });
      onUpdated(updated);
      setActiveAction('none');
      onClose();
      showNotification({
        variant: 'info',
        title: 'Tindak Lanjut Ditambahkan',
        code: updated.report_code,
        message: 'PIC dan tenggat tindak lanjut berhasil ditetapkan.',
        primaryLabel: 'Lihat Laporan',
        onPrimaryAction: () => onReopenReport?.(updated),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menetapkan tindak lanjut.';
      const currentReport = report;
      onClose();
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        closeOnBackdrop: false,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => onReopenReport?.(currentReport),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSubmitting(true);
    setActionError(null);

    try {
      const updated = await completeDamageReport({
        reportId: report.id,
        actorId: profile.id,
        actorName: profile.full_name,
        completionNotes,
      });
      onUpdated(updated);
      setActiveAction('none');
      onClose();
      showNotification({
        variant: 'success',
        title: 'Laporan Selesai',
        code: updated.report_code,
        message: 'Status laporan telah diperbarui menjadi Selesai.',
        primaryLabel: 'Lihat Laporan',
        onPrimaryAction: () => onReopenReport?.(updated),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyelesaikan laporan.';
      const currentReport = report;
      onClose();
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        closeOnBackdrop: false,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => onReopenReport?.(currentReport),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!additionalNote.trim()) {
      setActionError('Isi catatan tidak boleh kosong.');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      await addReportNote({
        reportId: report.id,
        actorId: profile.id,
        actorName: profile.full_name,
        note: additionalNote,
        activityType: adminMode ? 'Catatan administratif' : 'Catatan ditambahkan',
      });
      await loadLogs(report.id);
      setAdditionalNote('');
      setActiveAction('none');
      const currentReport = report;
      onClose();
      showNotification({
        variant: 'info',
        title: adminMode ? 'Catatan Administratif Disimpan' : 'Catatan Aktivitas Disimpan',
        code: currentReport.report_code,
        message: 'Catatan berhasil ditambahkan pada riwayat aktivitas laporan.',
        primaryLabel: 'Lihat Laporan',
        onPrimaryAction: () => onReopenReport?.(currentReport),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menambahkan catatan.';
      const currentReport = report;
      onClose();
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        closeOnBackdrop: false,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => onReopenReport?.(currentReport),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (adminNextStatus === report.status && !adminStatusNote.trim()) {
      setActionError('Pilih status baru atau isi catatan administratif.');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const updated = await adminUpdateReportStatus({
        reportId: report.id,
        actorId: profile.id,
        actorName: profile.full_name,
        previousStatus: report.status,
        status: adminNextStatus,
        adminNotes: adminStatusNote,
      });
      onUpdated(updated);
      setActiveAction('none');
      setAdminStatusNote('');
      onClose();
      showNotification({
        variant: 'success',
        title: 'Status Laporan Diperbarui',
        code: updated.report_code,
        message: `Status laporan berhasil diperbarui menjadi ${updated.status}.`,
        primaryLabel: 'Lihat Laporan',
        onPrimaryAction: () => onReopenReport?.(updated),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah status laporan.';
      const currentReport = report;
      onClose();
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        closeOnBackdrop: false,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => onReopenReport?.(currentReport),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
    >
      <div className="relative h-full w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-white">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2
                id="detail-modal-title"
                className="text-lg font-bold font-mono text-[#0F2744] tabular-nums"
              >
                {report.report_code}
              </h2>
              <StatusBadge status={report.status} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dilaporkan oleh {report.reporter_name} · {formatDateTime(report.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            aria-label="Tutup detail laporan"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {actionError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {actionError}
            </div>
          )}

          {/* Primary Metadata Grid */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-200">
            <div>
              <dt className="text-xs font-medium text-slate-500">Lokasi Laboratorium</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {report.location?.name || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Nama Alat Gelas</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {report.instrument?.name || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Jumlah Alat Rusak</dt>
              <dd className="mt-1 text-sm font-semibold font-mono tabular-nums text-slate-900">
                {report.damaged_qty} {report.instrument?.unit || 'Unit'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Tanggal Pelaporan</dt>
              <dd className="mt-1 text-sm text-slate-900 tabular-nums">
                {formatDateTime(report.created_at)}
              </dd>
            </div>
          </dl>

          {/* Description & Impact */}
          <div className="space-y-4 pb-6 border-b border-slate-200">
            <div>
              <h3 className="text-xs font-semibold text-slate-500">Deskripsi Kejadian</h3>
              <p className="mt-1.5 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {report.description}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-500">Dampak Terhadap Pengujian</h3>
              <p className="mt-1.5 text-sm text-slate-800 leading-relaxed">
                {report.testing_impact || 'Tidak ada catatan dampak pengujian.'}
              </p>
            </div>

            {report.photo_url && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-2">Foto Kerusakan</h3>
                {!imgError ? (
                  <img
                    src={report.photo_url}
                    alt={`Dokumentasi kerusakan ${report.report_code}`}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="max-h-64 w-auto rounded-lg border border-slate-200 object-contain bg-slate-50"
                  />
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    <ImageOff className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span>Foto dokumentasi tidak dapat dimuat dari penyimpanan.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Verification / Follow-Up Status Section */}
          {(report.verifier_name ||
            report.rejection_reason ||
            report.pic_name ||
            report.verification_notes) && (
            <div className="space-y-3 pb-6 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-[#0F2744]">
                Informasi Verifikasi & Tindak Lanjut
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {report.verifier_name && (
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Verifikator</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{report.verifier_name}</dd>
                  </div>
                )}
                {report.verified_at && (
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Waktu Verifikasi</dt>
                    <dd className="mt-0.5 text-slate-800 tabular-nums">
                      {formatDateTime(report.verified_at)}
                    </dd>
                  </div>
                )}
                {report.pic_name && (
                  <div>
                    <dt className="text-xs font-medium text-slate-500">PIC Tindak Lanjut</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{report.pic_name}</dd>
                  </div>
                )}
                {report.follow_up_deadline && (
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Tenggat Tindak Lanjut</dt>
                    <dd className="mt-0.5 text-slate-800 tabular-nums">
                      {formatDate(report.follow_up_deadline)}
                    </dd>
                  </div>
                )}
              </dl>

              {report.verification_notes && (
                <div>
                  <p className="text-xs font-medium text-slate-500">Catatan Verifikasi</p>
                  <p className="mt-1 text-sm text-slate-800">{report.verification_notes}</p>
                </div>
              )}

              {report.rejection_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-800">Alasan Penolakan</p>
                  <p className="mt-1 text-sm text-red-900">{report.rejection_reason}</p>
                </div>
              )}

              {report.follow_up_notes && (
                <div>
                  <p className="text-xs font-medium text-slate-500">Catatan Tindak Lanjut</p>
                  <p className="mt-1 text-sm text-slate-800">{report.follow_up_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Supervisor/QA or Admin Action Panel */}
          {(canManage || adminMode) && (
            <div className="space-y-4 pb-6 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#0F2744]">
                  {adminMode ? 'Tindakan Administratif Laporan' : 'Tindakan Supervisor / QA'}
                </h3>
                {adminMode && (
                  <span className="text-xs text-slate-500">
                    Laporan tidak dapat dihapus permanen
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {canManage && report.status === 'Menunggu Verifikasi' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setActiveAction(activeAction === 'verify' ? 'none' : 'verify');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Verifikasi Laporan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setActiveAction(activeAction === 'reject' ? 'none' : 'reject');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Tolak Laporan</span>
                    </button>
                  </>
                )}

                {canManage &&
                  (report.status === 'Diverifikasi' || report.status === 'Tindak Lanjut') && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setActiveAction(activeAction === 'followup' ? 'none' : 'followup');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Tetapkan PIC & Tindak Lanjut</span>
                    </button>
                  )}

                {canManage && report.status === 'Tindak Lanjut' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setActiveAction(activeAction === 'complete' ? 'none' : 'complete');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Tandai Selesai</span>
                  </button>
                )}

                {adminMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setActiveAction(activeAction === 'admin_status' ? 'none' : 'admin_status');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Ubah Status Laporan</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setActiveAction(activeAction === 'note' ? 'none' : 'note');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{adminMode ? 'Tambah Catatan Administratif' : 'Tambah Catatan'}</span>
                </button>
              </div>

              {activeAction === 'verify' && (
                <form
                  onSubmit={handleVerify}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Penilaian Dampak Pengujian (Opsional)
                    </label>
                    <input
                      type="text"
                      value={testingImpactInput}
                      onChange={(e) => setTestingImpactInput(e.target.value)}
                      placeholder="Contoh: Pengujian sampel dialihkan ke alat cadangan"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Catatan Verifikasi
                    </label>
                    <textarea
                      rows={2}
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      placeholder="Tambahkan catatan hasil verifikasi..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveAction('none')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {submitting ? 'Menyimpan...' : 'Simpan Verifikasi'}
                    </button>
                  </div>
                </form>
              )}

              {activeAction === 'reject' && (
                <form
                  onSubmit={handleReject}
                  className="rounded-lg border border-red-200 bg-red-50/50 p-4 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-medium text-red-900 mb-1">
                      Alasan Penolakan <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Jelaskan ketidaksesuaian atau kekurangan data laporan..."
                      className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveAction('none')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {submitting ? 'Memproses...' : 'Konfirmasi Penolakan'}
                    </button>
                  </div>
                </form>
              )}

              {activeAction === 'followup' && (
                <form
                  onSubmit={handleAssignFollowUp}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Pilih PIC <span className="text-red-600">*</span>
                      </label>
                      <select
                        required
                        value={selectedPicId}
                        onChange={(e) => setSelectedPicId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                      >
                        <option value="">Pilih pengguna...</option>
                        {picUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} ({getRoleLabel(u.role)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Tenggat Tindak Lanjut <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={followUpDeadline}
                        onChange={(e) => setFollowUpDeadline(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Catatan Tindak Lanjut
                    </label>
                    <textarea
                      rows={2}
                      value={followUpNotes}
                      onChange={(e) => setFollowUpNotes(e.target.value)}
                      placeholder="Instruksi penggantian, pengajuan pengadaan, atau pemusnahan alat pecah..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveAction('none')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-1.5 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {submitting ? 'Menyimpan...' : 'Simpan Tindak Lanjut'}
                    </button>
                  </div>
                </form>
              )}

              {activeAction === 'complete' && (
                <form
                  onSubmit={handleComplete}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Catatan Penyelesaian (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      placeholder="Contoh: Penggantian alat telah selesai dicatat."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveAction('none')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {submitting ? 'Menyimpan...' : 'Selesaikan Laporan'}
                    </button>
                  </div>
                </form>
              )}

              {activeAction === 'admin_status' && adminMode && (
                <form
                  onSubmit={handleAdminStatusChange}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Status Laporan Baru
                    </label>
                    <select
                      value={adminNextStatus}
                      onChange={(e) => setAdminNextStatus(e.target.value as ReportStatus)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    >
                      {REPORT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Catatan Administratif Perubahan Status
                    </label>
                    <textarea
                      rows={2}
                      value={adminStatusNote}
                      onChange={(e) => setAdminStatusNote(e.target.value)}
                      placeholder="Jelaskan alasan penyesuaian status secara administratif..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveAction('none')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-1.5 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {submitting ? 'Menyimpan...' : 'Simpan Perubahan Status'}
                    </button>
                  </div>
                </form>
              )}

              {activeAction === 'note' && (
                <form
                  onSubmit={handleAddNote}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {adminMode ? 'Catatan Administratif' : 'Catatan Tambahan'}{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={additionalNote}
                      onChange={(e) => setAdditionalNote(e.target.value)}
                      placeholder="Tulis catatan aktivitas baru..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveAction('none')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {submitting ? 'Menyimpan...' : 'Simpan Catatan'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Activity History Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-[#0F2744] mb-3">Riwayat Aktivitas</h3>
            {loadingLogs ? (
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">
                Belum ada catatan aktivitas untuk laporan ini.
              </p>
            ) : (
              <ol className="space-y-3">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{log.activity_type}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 tabular-nums">
                        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>{formatDateTime(log.created_at)}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">Oleh: {log.actor_name}</p>
                    {log.notes && (
                      <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">{log.notes}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
