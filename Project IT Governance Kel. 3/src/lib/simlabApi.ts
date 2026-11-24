import { supabase } from './supabase';
import type {
  DamageReport,
  Instrument,
  LabLocation,
  PhysicalCheck,
  PhysicalCheckVerificationStatus,
  Profile,
  ReportActivityLog,
  ReportStatus,
  UserRole,
} from '../types/simlab';

function formatSupabaseError(err: unknown, fallback: string): Error {
  if (err instanceof Error) {
    return err;
  }
  if (err && typeof err === 'object') {
    const pg = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    const code = pg.code ? `[${pg.code}] ` : '';
    const msg = pg.message || '';
    const lower = msg.toLowerCase();

    if (pg.code === '42501' || lower.includes('row-level security')) {
      return new Error(
        `Akses database ditolak oleh kebijakan Row Level Security (RLS). Pastikan skrip SQL migrasi/skema SIMLAB terbaru sudah dijalankan. (${code}${msg})`
      );
    }
    if (pg.code === '23505' || lower.includes('duplicate key')) {
      return new Error(
        `Data dengan kode atau nama yang sama sudah terdaftar. Gunakan nilai yang berbeda. (${code}${msg})`
      );
    }
    if (pg.code === '23503' || lower.includes('foreign key')) {
      return new Error(
        `Data referensi (profil pengguna, lokasi, atau alat) belum cocok dengan tabel terkait. (${code}${msg})`
      );
    }
    if (pg.code === '42P01' || pg.code === '42703' || pg.code === 'PGRST204') {
      return new Error(
        `Struktur tabel atau kolom Supabase belum sesuai pembaruan SIMLAB. Jalankan supabase/admin_migration.sql di SQL Editor Supabase. (${code}${msg})`
      );
    }
    if (msg) {
      const detail = pg.details ? ` — ${pg.details}` : '';
      return new Error(`${fallback} (${code}${msg}${detail})`);
    }
  }
  return new Error(fallback);
}

function requireClient() {
  if (!supabase) {
    throw new Error('Konfigurasi Supabase belum tersedia.');
  }
  return supabase;
}

export async function fetchLocations(): Promise<LabLocation[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('locations')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw formatSupabaseError(error, 'Gagal memuat data lokasi laboratorium.');
  return (data || []) as LabLocation[];
}

export async function fetchInstruments(): Promise<Instrument[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('instruments')
    .select('*, location:locations(id, name)')
    .order('name', { ascending: true });

  if (!error) {
    return (data || []) as Instrument[];
  }

  // Fallback apabila kolom location_id belum ditambahkan di tabel instruments
  if (error.code === '42703' || error.code === 'PGRST200') {
    const legacy = await client
      .from('instruments')
      .select('*')
      .order('name', { ascending: true });
    if (legacy.error) throw formatSupabaseError(legacy.error, 'Gagal memuat data alat gelas.');
    return (legacy.data || []) as Instrument[];
  }

  throw formatSupabaseError(error, 'Gagal memuat data alat gelas.');
}

export async function fetchAssignableProfiles(): Promise<Profile[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, email, role, is_active, created_at')
    .order('full_name', { ascending: true });

  if (!error) {
    return (data || []) as Profile[];
  }

  if (error.code === '42703') {
    const legacy = await client
      .from('profiles')
      .select('id, full_name, role, created_at')
      .order('full_name', { ascending: true });
    if (legacy.error) throw formatSupabaseError(legacy.error, 'Gagal memuat daftar pengguna.');
    return (legacy.data || []) as Profile[];
  }

  throw formatSupabaseError(error, 'Gagal memuat daftar pengguna.');
}

export async function fetchDamageReports(): Promise<DamageReport[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('damage_reports')
    .select(
      `
      *,
      location:locations(id, name),
      instrument:instruments(id, name)
    `
    )
    .order('created_at', { ascending: false });

  if (error) throw formatSupabaseError(error, 'Gagal memuat daftar laporan kerusakan.');
  return (data || []) as DamageReport[];
}

export async function fetchReportActivityLogs(reportId: string): Promise<ReportActivityLog[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('report_activity_logs')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });

  if (error) throw formatSupabaseError(error, 'Gagal memuat riwayat aktivitas laporan.');
  return (data || []) as ReportActivityLog[];
}

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 960;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => reject(new Error('Gagal memproses file gambar.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadDamagePhoto(file: File, userId: string): Promise<string> {
  const client = requireClient();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await client.storage
    .from('damage-photos')
    .upload(safeName, file, { upsert: false });

  if (!uploadError) {
    const { data: publicData } = client.storage.from('damage-photos').getPublicUrl(safeName);
    if (publicData?.publicUrl) {
      return publicData.publicUrl;
    }
  }

  // Fallback jika bucket storage belum dibuat pada proyek demo
  return compressImageToDataUrl(file);
}

export interface CreateDamageReportInput {
  reporterId: string;
  reporterName: string;
  locationId: string;
  instrumentId: string;
  damagedQty: number;
  description: string;
  testingImpact?: string;
  photoFile?: File | null;
}

async function generateFallbackReportCode(): Promise<string> {
  const client = requireClient();
  const { data } = await client
    .from('damage_reports')
    .select('report_code')
    .like('report_code', 'SIM-DEMO-%');

  let maxNum = 0;
  for (const row of data || []) {
    const match = /^SIM-DEMO-(\d+)$/.exec(String(row.report_code || ''));
    if (match) {
      const n = Number(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  const next = maxNum + 1;
  return `SIM-DEMO-${String(next).padStart(3, '0')}`;
}

export async function createDamageReport(
  input: CreateDamageReportInput
): Promise<DamageReport> {
  const client = requireClient();

  let photoUrl: string | null = null;
  if (input.photoFile) {
    photoUrl = await uploadDamagePhoto(input.photoFile, input.reporterId);
  }

  const basePayload = {
    reporter_id: input.reporterId,
    reporter_name: input.reporterName,
    location_id: input.locationId,
    instrument_id: input.instrumentId,
    damaged_qty: input.damagedQty,
    description: input.description.trim(),
    testing_impact: input.testingImpact?.trim() || null,
    photo_url: photoUrl,
    status: 'Menunggu Verifikasi' as const,
  };

  let { data: inserted, error: insertError } = await client
    .from('damage_reports')
    .insert({ ...basePayload, report_code: '' })
    .select(
      `
      *,
      location:locations(id, name),
      instrument:instruments(id, name)
    `
    )
    .single();

  // Fallback jika trigger trg_assign_report_code belum terpasang di Supabase
  if (insertError && insertError.code === '23505') {
    const startCode = await generateFallbackReportCode();
    const startNum = Number(startCode.replace('SIM-DEMO-', '')) || 1;
    for (let offset = 0; offset < 10; offset += 1) {
      const candidateCode = `SIM-DEMO-${String(startNum + offset).padStart(3, '0')}`;
      const retry = await client
        .from('damage_reports')
        .insert({ ...basePayload, report_code: candidateCode })
        .select(
          `
          *,
          location:locations(id, name),
          instrument:instruments(id, name)
        `
        )
        .single();
      inserted = retry.data;
      insertError = retry.error;
      if (!insertError || insertError.code !== '23505') {
        break;
      }
    }
  }

  if (insertError) {
    throw formatSupabaseError(insertError, 'Gagal mengirim laporan kerusakan ke server.');
  }

  const report = inserted as DamageReport;

  const { error: logError } = await client.from('report_activity_logs').insert({
    report_id: report.id,
    actor_id: input.reporterId,
    actor_name: input.reporterName,
    activity_type: 'Laporan dibuat',
    notes: `Melaporkan kerusakan ${input.damagedQty} unit ${report.instrument?.name || 'alat'} di ${report.location?.name || 'laboratorium'}.`,
  });

  if (logError) {
    console.error('Gagal mencatat log pembuatan laporan:', logError);
  }

  return report;
}

export async function verifyDamageReport(params: {
  reportId: string;
  verifierId: string;
  verifierName: string;
  verificationNotes?: string;
  testingImpact?: string;
}): Promise<DamageReport> {
  const client = requireClient();
  const nowIso = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {
    status: 'Diverifikasi' satisfies ReportStatus,
    verifier_id: params.verifierId,
    verifier_name: params.verifierName,
    verified_at: nowIso,
    verification_notes: params.verificationNotes?.trim() || null,
  };

  if (params.testingImpact !== undefined) {
    updatePayload.testing_impact = params.testingImpact.trim() || null;
  }

  const { data, error } = await client
    .from('damage_reports')
    .update(updatePayload)
    .eq('id', params.reportId)
    .select(
      `
      *,
      location:locations(id, name),
      instrument:instruments(id, name)
    `
    )
    .single();

  if (error) throw formatSupabaseError(error, 'Gagal memverifikasi laporan.');

  await client.from('report_activity_logs').insert({
    report_id: params.reportId,
    actor_id: params.verifierId,
    actor_name: params.verifierName,
    activity_type: 'Laporan diverifikasi',
    notes: params.verificationNotes?.trim() || 'Laporan dinyatakan lengkap dan sesuai.',
  });

  return data as DamageReport;
}

export async function rejectDamageReport(params: {
  reportId: string;
  verifierId: string;
  verifierName: string;
  rejectionReason: string;
}): Promise<DamageReport> {
  const client = requireClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await client
    .from('damage_reports')
    .update({
      status: 'Ditolak' satisfies ReportStatus,
      verifier_id: params.verifierId,
      verifier_name: params.verifierName,
      verified_at: nowIso,
      rejection_reason: params.rejectionReason.trim(),
    })
    .eq('id', params.reportId)
    .select(
      `
      *,
      location:locations(id, name),
      instrument:instruments(id, name)
    `
    )
    .single();

  if (error) throw formatSupabaseError(error, 'Gagal menolak laporan.');

  await client.from('report_activity_logs').insert({
    report_id: params.reportId,
    actor_id: params.verifierId,
    actor_name: params.verifierName,
    activity_type: 'Laporan ditolak',
    notes: params.rejectionReason.trim(),
  });

  return data as DamageReport;
}

export async function assignFollowUpReport(params: {
  reportId: string;
  actorId: string;
  actorName: string;
  picId: string;
  picName: string;
  deadline: string;
  followUpNotes?: string;
}): Promise<DamageReport> {
  const client = requireClient();

  const { data, error } = await client
    .from('damage_reports')
    .update({
      status: 'Tindak Lanjut' satisfies ReportStatus,
      pic_id: params.picId,
      pic_name: params.picName,
      follow_up_deadline: params.deadline,
      follow_up_notes: params.followUpNotes?.trim() || null,
    })
    .eq('id', params.reportId)
    .select(
      `
      *,
      location:locations(id, name),
      instrument:instruments(id, name)
    `
    )
    .single();

  if (error) throw formatSupabaseError(error, 'Gagal menetapkan tindak lanjut.');

  const noteParts = [`PIC: ${params.picName}`, `Tenggat: ${params.deadline}`];
  if (params.followUpNotes?.trim()) {
    noteParts.push(params.followUpNotes.trim());
  }

  await client.from('report_activity_logs').insert({
    report_id: params.reportId,
    actor_id: params.actorId,
    actor_name: params.actorName,
    activity_type: 'Tindak lanjut ditetapkan',
    notes: noteParts.join(' • '),
  });

  return data as DamageReport;
}

export async function completeDamageReport(params: {
  reportId: string;
  actorId: string;
  actorName: string;
  completionNotes?: string;
}): Promise<DamageReport> {
  const client = requireClient();

  const updatePayload: Record<string, unknown> = {
    status: 'Selesai' satisfies ReportStatus,
  };
  if (params.completionNotes?.trim()) {
    updatePayload.follow_up_notes = params.completionNotes.trim();
  }

  const { data, error } = await client
    .from('damage_reports')
    .update(updatePayload)
    .eq('id', params.reportId)
    .select(
      `
      *,
      location:locations(id, name),
      instrument:instruments(id, name)
    `
    )
    .single();

  if (error) throw formatSupabaseError(error, 'Gagal menyelesaikan laporan.');

  await client.from('report_activity_logs').insert({
    report_id: params.reportId,
    actor_id: params.actorId,
    actor_name: params.actorName,
    activity_type: 'Status berubah',
    notes: params.completionNotes?.trim()
      ? `Status diubah menjadi Selesai. ${params.completionNotes.trim()}`
      : 'Status diubah menjadi Selesai.',
  });

  return data as DamageReport;
}

export async function adminUpdateReportStatus(params: {
  reportId: string;
  actorId: string;
  actorName: string;
  previousStatus: ReportStatus;
  status: ReportStatus;
  adminNotes?: string;
}): Promise<DamageReport> {
  const client = requireClient();

  const updatePayload: Record<string, unknown> = {
    status: params.status,
  };

  if (params.status === 'Diverifikasi') {
    updatePayload.verified_at = new Date().toISOString();
    updatePayload.verifier_id = params.actorId;
    updatePayload.verifier_name = params.actorName;
    if (params.adminNotes?.trim()) {
      updatePayload.verification_notes = params.adminNotes.trim();
    }
  } else if (params.status === 'Ditolak' && params.adminNotes?.trim()) {
    updatePayload.rejection_reason = params.adminNotes.trim();
  } else if (params.adminNotes?.trim()) {
    updatePayload.follow_up_notes = params.adminNotes.trim();
  }

  const { data, error } = await client
    .from('damage_reports')
    .update(updatePayload)
    .eq('id', params.reportId)
    .select(
      `
      *,
      location:locations(id, name),
      instrument:instruments(id, name)
    `
    )
    .single();

  if (error) throw formatSupabaseError(error, 'Gagal memperbarui status laporan.');

  const noteText = params.adminNotes?.trim()
    ? `Status diubah oleh Admin (${params.previousStatus} → ${params.status}). Catatan: ${params.adminNotes.trim()}`
    : `Status diubah oleh Admin (${params.previousStatus} → ${params.status}).`;

  await client.from('report_activity_logs').insert({
    report_id: params.reportId,
    actor_id: params.actorId,
    actor_name: params.actorName,
    activity_type: 'Perubahan status administratif',
    notes: noteText,
  });

  return data as DamageReport;
}

export async function addReportNote(params: {
  reportId: string;
  actorId: string;
  actorName: string;
  note: string;
  activityType?: string;
}): Promise<void> {
  const client = requireClient();

  const { error } = await client.from('report_activity_logs').insert({
    report_id: params.reportId,
    actor_id: params.actorId,
    actor_name: params.actorName,
    activity_type: params.activityType || 'Catatan ditambahkan',
    notes: params.note.trim(),
  });

  if (error) throw formatSupabaseError(error, 'Gagal menambahkan catatan.');
}

export async function fetchPhysicalChecks(): Promise<PhysicalCheck[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('physical_checks')
    .select(
      `
      *,
      location:locations(id, name),
      instrument:instruments(id, name, unit)
    `
    )
    .order('created_at', { ascending: false });

  if (error) throw formatSupabaseError(error, 'Gagal memuat data pemeriksaan fisik.');
  return (data || []) as PhysicalCheck[];
}

export interface CreatePhysicalCheckInput {
  period: 'Semester 1' | 'Semester 2';
  checkYear: number;
  locationId: string;
  instrumentId: string;
  systemStock: number;
  physicalStock: number;
  notes?: string;
  checkedBy: string;
  checkedByName: string;
}

export async function createPhysicalCheck(
  input: CreatePhysicalCheckInput
): Promise<PhysicalCheck> {
  const client = requireClient();
  const checkMonth = input.period === 'Semester 1' ? 'Juni' : 'Desember';

  const { data, error } = await client
    .from('physical_checks')
    .insert({
      period: input.period,
      check_month: checkMonth,
      check_year: input.checkYear,
      location_id: input.locationId,
      instrument_id: input.instrumentId,
      system_stock: input.systemStock,
      physical_stock: input.physicalStock,
      notes: input.notes?.trim() || null,
      checked_by: input.checkedBy,
      checked_by_name: input.checkedByName,
    })
    .select(
      `
      *,
      location:locations(id, name),
      instrument:instruments(id, name, unit)
    `
    )
    .single();

  if (error) throw formatSupabaseError(error, 'Gagal menyimpan hasil pemeriksaan semesteran.');
  return data as PhysicalCheck;
}

export async function adminVerifyPhysicalCheck(params: {
  checkId: string;
  verifierId: string;
  verifierName: string;
  verificationStatus: PhysicalCheckVerificationStatus;
  verificationNotes?: string;
  checkNotes?: string;
}): Promise<PhysicalCheck> {
  const client = requireClient();

  const updatePayload: Record<string, unknown> = {
    verification_status: params.verificationStatus,
    verified_by: params.verifierId,
    verified_by_name: params.verifierName,
    verified_at: new Date().toISOString(),
    verification_notes: params.verificationNotes?.trim() || null,
  };

  if (params.checkNotes !== undefined) {
    updatePayload.notes = params.checkNotes.trim() || null;
  }

  const { data, error } = await client
    .from('physical_checks')
    .update(updatePayload)
    .eq('id', params.checkId)
    .select(
      `
      *,
      location:locations(id, name),
      instrument:instruments(id, name, unit)
    `
    )
    .single();

  if (error) throw formatSupabaseError(error, 'Gagal memverifikasi hasil pemeriksaan fisik.');
  return data as PhysicalCheck;
}

// ----------------------------------------------------------------------------
// ADMIN API: Manajemen Pengguna, Lokasi, dan Alat Gelas
// ----------------------------------------------------------------------------

export async function adminUpdateUserProfile(params: {
  userId: string;
  role: UserRole;
  isActive: boolean;
}): Promise<Profile> {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .update({
      role: params.role,
      is_active: params.isActive,
    })
    .eq('id', params.userId)
    .select('id, full_name, email, role, is_active, created_at')
    .single();

  if (error) throw formatSupabaseError(error, 'Gagal memperbarui data pengguna.');
  return data as Profile;
}

export async function adminCreateLocation(params: {
  code?: string;
  name: string;
  description?: string;
}): Promise<LabLocation> {
  const client = requireClient();
  const { data, error } = await client
    .from('locations')
    .insert({
      code: params.code?.trim() || null,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) throw formatSupabaseError(error, 'Gagal menambahkan lokasi laboratorium.');
  return data as LabLocation;
}

export async function adminUpdateLocation(params: {
  id: string;
  code?: string;
  name: string;
  description?: string;
  isActive: boolean;
}): Promise<LabLocation> {
  const client = requireClient();
  const { data, error } = await client
    .from('locations')
    .update({
      code: params.code?.trim() || null,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      is_active: params.isActive,
    })
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) throw formatSupabaseError(error, 'Gagal memperbarui lokasi laboratorium.');
  return data as LabLocation;
}

export interface UpsertInstrumentInput {
  code?: string;
  name: string;
  category?: string;
  unit: string;
  locationId?: string;
  stockQuantity: number;
  minimumStock: number;
  conditionSummary: string;
  isActive?: boolean;
}

export async function adminCreateInstrument(input: UpsertInstrumentInput): Promise<Instrument> {
  const client = requireClient();

  const fullPayload = {
    code: input.code?.trim() || null,
    name: input.name.trim(),
    category: input.category?.trim() || null,
    unit: input.unit.trim() || 'Unit',
    location_id: input.locationId || null,
    stock: input.stockQuantity,
    stock_quantity: input.stockQuantity,
    minimum_stock: input.minimumStock,
    condition_summary: input.conditionSummary.trim() || 'Baik',
    is_active: true,
  };

  let { data, error } = await client
    .from('instruments')
    .insert(fullPayload)
    .select('*, location:locations(id, name)')
    .single();

  // Fallback jika kolom legacy 'stock' tidak ada pada skema bersih
  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    const { stock: _omit, ...withoutLegacyStock } = fullPayload;
    const retry = await client
      .from('instruments')
      .insert(withoutLegacyStock)
      .select('*, location:locations(id, name)')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw formatSupabaseError(error, 'Gagal menambahkan alat gelas baru.');
  return data as Instrument;
}

export async function adminUpdateInstrument(
  id: string,
  input: UpsertInstrumentInput
): Promise<Instrument> {
  const client = requireClient();

  const fullPayload = {
    code: input.code?.trim() || null,
    name: input.name.trim(),
    category: input.category?.trim() || null,
    unit: input.unit.trim() || 'Unit',
    location_id: input.locationId || null,
    stock: input.stockQuantity,
    stock_quantity: input.stockQuantity,
    minimum_stock: input.minimumStock,
    condition_summary: input.conditionSummary.trim() || 'Baik',
    is_active: input.isActive !== false,
  };

  let { data, error } = await client
    .from('instruments')
    .update(fullPayload)
    .eq('id', id)
    .select('*, location:locations(id, name)')
    .single();

  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    const { stock: _omit, ...withoutLegacyStock } = fullPayload;
    const retry = await client
      .from('instruments')
      .update(withoutLegacyStock)
      .eq('id', id)
      .select('*, location:locations(id, name)')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw formatSupabaseError(error, 'Gagal memperbarui data alat gelas.');
  return data as Instrument;
}
