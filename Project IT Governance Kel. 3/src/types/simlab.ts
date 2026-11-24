export type UserRole = 'analis' | 'supervisor' | 'tu' | 'admin';

export type ReportStatus =
  | 'Menunggu Verifikasi'
  | 'Diverifikasi'
  | 'Ditolak'
  | 'Tindak Lanjut'
  | 'Selesai';

export type PhysicalCheckVerificationStatus =
  | 'Belum Diverifikasi'
  | 'Terverifikasi'
  | 'Perlu Tindak Lanjut';

export interface Profile {
  id: string;
  full_name: string;
  email?: string | null;
  role: UserRole | string;
  is_active?: boolean | null;
  created_at?: string;
}

export interface LabLocation {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
  created_at?: string;
}

export interface Instrument {
  id: string;
  code?: string | null;
  name: string;
  capacity?: string | null;
  category?: string | null;
  unit?: string | null;
  location_id?: string | number | null;
  stock?: number | null;
  stock_quantity?: number | null;
  minimum_stock?: number | null;
  condition?: string | null;
  condition_summary?: string | null;
  is_active?: boolean | null;
  created_at?: string;
  updated_at?: string;
  location?: { id: string; name: string } | null;
}

export interface DamageReport {
  id: string;
  report_code: string;
  reporter_id: string;
  reporter_name: string;
  location_id: string;
  instrument_id: string;
  damaged_qty: number;
  description: string;
  photo_url?: string | null;
  testing_impact?: string | null;
  status: ReportStatus;
  verifier_id?: string | null;
  verifier_name?: string | null;
  verified_at?: string | null;
  verification_notes?: string | null;
  rejection_reason?: string | null;
  pic_id?: string | null;
  pic_name?: string | null;
  follow_up_deadline?: string | null;
  follow_up_notes?: string | null;
  created_at: string;
  updated_at?: string;
  // Joined fields from Supabase relational select
  location?: { id: string; name: string; code?: string } | null;
  instrument?: { id: string; name: string; code?: string; unit?: string } | null;
}

export interface ReportActivityLog {
  id: string;
  report_id: string;
  actor_id: string;
  actor_name: string;
  activity_type: string;
  notes?: string | null;
  created_at: string;
}

export interface PhysicalCheck {
  id: string;
  period: 'Semester 1' | 'Semester 2';
  check_month: 'Juni' | 'Desember';
  check_year: number;
  location_id: string;
  instrument_id: string;
  system_stock: number;
  physical_stock: number;
  difference: number;
  notes?: string | null;
  checked_by: string;
  checked_by_name: string;
  verification_status?: PhysicalCheckVerificationStatus | null;
  verified_by?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
  verification_notes?: string | null;
  created_at: string;
  location?: { id: string; name: string } | null;
  instrument?: { id: string; name: string; unit?: string } | null;
}

export interface ReportFilters {
  search: string;
  locationId: string;
  instrumentId: string;
  status: string;
  userId?: string;
  dateFrom: string;
  dateTo: string;
  period: 'all' | 'Semester 1' | 'Semester 2';
}
