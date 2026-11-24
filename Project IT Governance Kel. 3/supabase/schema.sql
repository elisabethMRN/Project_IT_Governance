-- ============================================================================
-- SIMLAB — Sistem Informasi Manajemen Alat Gelas Laboratorium
-- Skema Database PostgreSQL & Kebijakan Row Level Security (Supabase)
-- Prototype Akademik • Data Dummy • Belum terintegrasi langsung dengan SAKTI
-- Aman dijalankan ulang (idempotent) termasuk jika tabel sudah dibuat sebelumnya
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABEL: public.profiles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('analis', 'supervisor', 'tu', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('analis', 'supervisor', 'tu', 'admin'));

-- Sinkronisasi email dari auth.users ke public.profiles agar tampil di Manajemen Pengguna
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR BTRIM(p.email) = '');

-- ----------------------------------------------------------------------------
-- 2. TABEL: public.locations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ----------------------------------------------------------------------------
-- 3. TABEL: public.instruments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  capacity TEXT,
  unit TEXT NOT NULL DEFAULT 'Unit',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_stock INTEGER NOT NULL DEFAULT 5 CHECK (minimum_stock >= 0),
  condition_summary TEXT NOT NULL DEFAULT 'Baik',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS capacity TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'Unit',
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_stock INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS condition_summary TEXT NOT NULL DEFAULT 'Baik',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Tambahkan location_id pada public.instruments dengan tipe otomatis mengikuti locations.id (UUID atau BIGINT/INTEGER)
DO $$
DECLARE
  v_loc_type TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'instruments' AND column_name = 'location_id'
  ) THEN
    SELECT data_type INTO v_loc_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'id';

    IF v_loc_type = 'uuid' THEN
      EXECUTE 'ALTER TABLE public.instruments ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL';
    ELSE
      EXECUTE 'ALTER TABLE public.instruments ADD COLUMN location_id BIGINT REFERENCES public.locations(id) ON DELETE SET NULL';
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. TABEL: public.damage_reports
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.damage_report_code_seq START 1;

CREATE TABLE IF NOT EXISTS public.damage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code TEXT NOT NULL UNIQUE DEFAULT '',
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reporter_name TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  damaged_qty INTEGER NOT NULL CHECK (damaged_qty > 0),
  description TEXT NOT NULL,
  photo_url TEXT,
  testing_impact TEXT,
  status TEXT NOT NULL DEFAULT 'Menunggu Verifikasi'
    CHECK (status IN ('Menunggu Verifikasi', 'Diverifikasi', 'Ditolak', 'Tindak Lanjut', 'Selesai')),
  verifier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verifier_name TEXT,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  rejection_reason TEXT,
  pic_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  pic_name TEXT,
  follow_up_deadline DATE,
  follow_up_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.damage_reports
  ADD COLUMN IF NOT EXISTS report_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reporter_name TEXT,
  ADD COLUMN IF NOT EXISTS damaged_qty INTEGER,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS testing_impact TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Menunggu Verifikasi',
  ADD COLUMN IF NOT EXISTS verifier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verifier_name TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS pic_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pic_name TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_deadline DATE,
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger pembuat ID Laporan otomatis: SIM-DEMO-001, SIM-DEMO-002, dst.
CREATE OR REPLACE FUNCTION public.assign_simlab_report_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num BIGINT;
BEGIN
  IF NEW.report_code IS NULL OR BTRIM(NEW.report_code) = '' THEN
    SELECT COALESCE(
      GREATEST(
        (SELECT MAX(NULLIF(REGEXP_REPLACE(report_code, '^SIM-DEMO-', ''), '')::BIGINT)
         FROM public.damage_reports
         WHERE report_code ~ '^SIM-DEMO-[0-9]+$'),
        0
      ) + 1,
      1
    ) INTO next_num;

    NEW.report_code := 'SIM-DEMO-' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_report_code ON public.damage_reports;
CREATE TRIGGER trg_assign_report_code
  BEFORE INSERT ON public.damage_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_simlab_report_code();

-- Trigger updated_at otomatis
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_damage_reports_updated_at ON public.damage_reports;
CREATE TRIGGER trg_damage_reports_updated_at
  BEFORE UPDATE ON public.damage_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_instruments_updated_at ON public.instruments;
CREATE TRIGGER trg_instruments_updated_at
  BEFORE UPDATE ON public.instruments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. TABEL: public.report_activity_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.damage_reports(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  actor_name TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.report_activity_logs
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS actor_name TEXT,
  ADD COLUMN IF NOT EXISTS activity_type TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ----------------------------------------------------------------------------
-- 6. TABEL: public.physical_checks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.physical_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL CHECK (period IN ('Semester 1', 'Semester 2')),
  check_month TEXT NOT NULL CHECK (check_month IN ('Juni', 'Desember')),
  check_year INTEGER NOT NULL CHECK (check_year >= 2020 AND check_year <= 2100),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  system_stock INTEGER NOT NULL CHECK (system_stock >= 0),
  physical_stock INTEGER NOT NULL CHECK (physical_stock >= 0),
  difference INTEGER GENERATED ALWAYS AS (physical_stock - system_stock) STORED,
  notes TEXT,
  checked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  checked_by_name TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'Belum Diverifikasi'
    CHECK (verification_status IN ('Belum Diverifikasi', 'Terverifikasi', 'Perlu Tindak Lanjut')),
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_by_name TEXT,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.physical_checks
  ADD COLUMN IF NOT EXISTS period TEXT,
  ADD COLUMN IF NOT EXISTS check_month TEXT,
  ADD COLUMN IF NOT EXISTS check_year INTEGER,
  ADD COLUMN IF NOT EXISTS system_stock INTEGER,
  ADD COLUMN IF NOT EXISTS physical_stock INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS checked_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS checked_by_name TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'Belum Diverifikasi',
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_by_name TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ----------------------------------------------------------------------------
-- FUNGSI HELPER ROLE UNTUK RLS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND COALESCE(is_active, TRUE) = TRUE;
$$;

-- ----------------------------------------------------------------------------
-- AKTIFKAN ROW LEVEL SECURITY PADA SEMUA TABEL
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_checks ENABLE ROW LEVEL SECURITY;

-- Kebijakan: profiles (tidak mengizinkan DELETE permanen oleh admin)
DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON public.profiles;
CREATE POLICY "profiles_select_own_or_staff"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.current_user_role() IN ('supervisor', 'tu', 'admin')
  );

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Kebijakan: locations (Admin dapat menambah & mengubah/menonaktifkan, tidak menghapus permanen)
DROP POLICY IF EXISTS "locations_select_authenticated" ON public.locations;
CREATE POLICY "locations_select_authenticated"
  ON public.locations FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "locations_admin_insert" ON public.locations;
CREATE POLICY "locations_admin_insert"
  ON public.locations FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "locations_admin_update" ON public.locations;
CREATE POLICY "locations_admin_update"
  ON public.locations FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Kebijakan: instruments (Admin dapat menambah & mengubah/menonaktifkan, tidak menghapus permanen)
DROP POLICY IF EXISTS "instruments_select_authenticated" ON public.instruments;
CREATE POLICY "instruments_select_authenticated"
  ON public.instruments FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "instruments_admin_modify" ON public.instruments;
DROP POLICY IF EXISTS "instruments_admin_insert" ON public.instruments;
CREATE POLICY "instruments_admin_insert"
  ON public.instruments FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "instruments_admin_update" ON public.instruments;
CREATE POLICY "instruments_admin_update"
  ON public.instruments FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Kebijakan: damage_reports (tidak ada DELETE permanen)
DROP POLICY IF EXISTS "damage_reports_select_by_role" ON public.damage_reports;
CREATE POLICY "damage_reports_select_by_role"
  ON public.damage_reports FOR SELECT
  TO authenticated
  USING (
    (public.current_user_role() = 'analis' AND reporter_id = auth.uid())
    OR public.current_user_role() IN ('supervisor', 'admin')
    OR (public.current_user_role() = 'tu' AND status IN ('Diverifikasi', 'Tindak Lanjut', 'Selesai'))
  );

DROP POLICY IF EXISTS "damage_reports_insert_analis" ON public.damage_reports;
CREATE POLICY "damage_reports_insert_analis"
  ON public.damage_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('analis', 'admin')
    AND reporter_id = auth.uid()
    AND status = 'Menunggu Verifikasi'
  );

DROP POLICY IF EXISTS "damage_reports_update_supervisor" ON public.damage_reports;
CREATE POLICY "damage_reports_update_supervisor"
  ON public.damage_reports FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('supervisor', 'admin'))
  WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

-- Kebijakan: report_activity_logs
DROP POLICY IF EXISTS "activity_logs_select_by_role" ON public.report_activity_logs;
CREATE POLICY "activity_logs_select_by_role"
  ON public.report_activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.damage_reports dr
      WHERE dr.id = report_id
        AND (
          (public.current_user_role() = 'analis' AND dr.reporter_id = auth.uid())
          OR public.current_user_role() IN ('supervisor', 'admin')
          OR (public.current_user_role() = 'tu' AND dr.status IN ('Diverifikasi', 'Tindak Lanjut', 'Selesai'))
        )
    )
  );

DROP POLICY IF EXISTS "activity_logs_insert_authenticated" ON public.report_activity_logs;
CREATE POLICY "activity_logs_insert_authenticated"
  ON public.report_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      public.current_user_role() IN ('supervisor', 'admin')
      OR (
        public.current_user_role() = 'analis'
        AND EXISTS (
          SELECT 1 FROM public.damage_reports dr
          WHERE dr.id = report_id AND dr.reporter_id = auth.uid()
        )
      )
    )
  );

-- Kebijakan: physical_checks
DROP POLICY IF EXISTS "physical_checks_select_tu_supervisor" ON public.physical_checks;
CREATE POLICY "physical_checks_select_tu_supervisor"
  ON public.physical_checks FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('tu', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "physical_checks_insert_tu" ON public.physical_checks;
CREATE POLICY "physical_checks_insert_tu"
  ON public.physical_checks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('tu', 'admin')
    AND checked_by = auth.uid()
  );

DROP POLICY IF EXISTS "physical_checks_admin_update" ON public.physical_checks;
CREATE POLICY "physical_checks_admin_update"
  ON public.physical_checks FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'supervisor'))
  WITH CHECK (public.current_user_role() IN ('admin', 'supervisor'));

-- ----------------------------------------------------------------------------
-- DATA DUMMY AWAL (LOKASI & ALAT GELAS)
-- ----------------------------------------------------------------------------
INSERT INTO public.locations (code, name, description)
SELECT v.code, v.name, v.description
FROM (
  VALUES
    ('LAB-DEMO-A', 'Laboratorium Demo A', 'Ruang pengujian kimia dasar (data simulasi akademik)'),
    ('LAB-DEMO-B', 'Laboratorium Demo B', 'Ruang preparasi sampel dan volumetri (data simulasi akademik)')
) AS v(code, name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.locations l WHERE l.name = v.name
);

INSERT INTO public.instruments (code, name, category, capacity, unit, stock, stock_quantity, minimum_stock, condition_summary)
SELECT v.code, v.name, v.category, v.capacity, v.unit, v.stock_quantity, v.stock_quantity, v.minimum_stock, v.condition_summary
FROM (
  VALUES
    ('GLS-BG-250', 'Beaker Glass 250 mL', 'Gelas Kimia', '250 mL', 'Unit', 45, 10, 'Tersedia untuk pengujian'),
    ('GLS-EF-500', 'Erlenmeyer Flask 500 mL', 'Labu Titrasi', '500 mL', 'Unit', 32, 8, 'Tersedia untuk pengujian'),
    ('GLS-MC-100', 'Measuring Cylinder 100 mL', 'Gelas Ukur', '100 mL', 'Unit', 24, 6, 'Tersedia untuk pengujian'),
    ('GLS-VF-100', 'Volumetric Flask 100 mL', 'Labu Ukur', '100 mL', 'Unit', 30, 8, 'Perlu kalibrasi berkala'),
    ('GLS-PG-010', 'Pipette Graduated 10 mL', 'Pipet Ukur', '10 mL', 'Unit', 50, 10, 'Tersedia untuk pengujian')
) AS v(code, name, category, capacity, unit, stock_quantity, minimum_stock, condition_summary)
WHERE NOT EXISTS (
  SELECT 1 FROM public.instruments i WHERE i.name = v.name
);

-- ----------------------------------------------------------------------------
-- SINKRONISASI PROFIL AKUN DEMO (Jalankan setelah user dibuat di Supabase Auth)
-- ----------------------------------------------------------------------------
INSERT INTO public.profiles (id, full_name, email, role)
SELECT id,
  CASE email
    WHEN 'analis.demo@simlab.test' THEN 'Analis Demo'
    WHEN 'supervisor.demo@simlab.test' THEN 'Supervisor Demo'
    WHEN 'tu.demo@simlab.test' THEN 'TU Demo'
  END,
  email,
  CASE email
    WHEN 'analis.demo@simlab.test' THEN 'analis'
    WHEN 'supervisor.demo@simlab.test' THEN 'supervisor'
    WHEN 'tu.demo@simlab.test' THEN 'tu'
  END
FROM auth.users
WHERE email IN ('analis.demo@simlab.test', 'supervisor.demo@simlab.test', 'tu.demo@simlab.test')
ON CONFLICT (id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;

-- ----------------------------------------------------------------------------
-- KOMPATIBILITAS KOLOM & CONSTRAINT
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('damage_reports', 'report_activity_logs', 'physical_checks')
      AND is_nullable = 'NO'
      AND is_generated = 'NEVER'
      AND column_default IS NULL
      AND column_name NOT IN (
        'id',
        'report_code', 'reporter_id', 'reporter_name', 'location_id', 'instrument_id', 'damaged_qty', 'description', 'status',
        'report_id', 'actor_id', 'actor_name', 'activity_type',
        'period', 'check_month', 'check_year', 'system_stock', 'physical_stock', 'checked_by', 'checked_by_name'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL;', rec.table_name, rec.column_name);
  END LOOP;
END $$;

ALTER TABLE public.damage_reports
  DROP CONSTRAINT IF EXISTS damage_reports_status_check;

UPDATE public.damage_reports
SET status = 'Menunggu Verifikasi'
WHERE status IS NULL
   OR status NOT IN ('Menunggu Verifikasi', 'Diverifikasi', 'Ditolak', 'Tindak Lanjut', 'Selesai');

ALTER TABLE public.damage_reports
  ADD CONSTRAINT damage_reports_status_check
  CHECK (status IN ('Menunggu Verifikasi', 'Diverifikasi', 'Ditolak', 'Tindak Lanjut', 'Selesai'));

ALTER TABLE public.damage_reports
  ALTER COLUMN status SET DEFAULT 'Menunggu Verifikasi';

ALTER TABLE public.physical_checks
  DROP CONSTRAINT IF EXISTS physical_checks_period_check,
  DROP CONSTRAINT IF EXISTS physical_checks_check_month_check,
  DROP CONSTRAINT IF EXISTS physical_checks_verification_status_check;

ALTER TABLE public.physical_checks
  ADD CONSTRAINT physical_checks_period_check CHECK (period IN ('Semester 1', 'Semester 2')),
  ADD CONSTRAINT physical_checks_check_month_check CHECK (check_month IN ('Juni', 'Desember')),
  ADD CONSTRAINT physical_checks_verification_status_check
    CHECK (verification_status IN ('Belum Diverifikasi', 'Terverifikasi', 'Perlu Tindak Lanjut'));
