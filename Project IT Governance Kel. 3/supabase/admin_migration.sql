-- ============================================================================
-- SIMLAB — Migrasi Tambahan Fitur Dashboard Admin
-- Jalankan di SQL Editor Supabase pada proyek yang sudah berjalan.
-- Aman dijalankan ulang (idempotent).
-- ============================================================================

-- 1. Tambah kolom email & status aktif pada public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('analis', 'supervisor', 'tu', 'admin'));

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR BTRIM(p.email) = '');

-- 2. Tambah status aktif pada public.locations
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Tambah kategori, stok minimum, lokasi alat, dan status aktif pada public.instruments
ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS minimum_stock INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Pastikan location_id cocok dengan tipe data locations.id (UUID atau BIGINT/INTEGER)
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

-- Sinkronkan stock <-> stock_quantity jika kolom stock ada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'instruments' AND column_name = 'stock'
  ) THEN
    EXECUTE '
      UPDATE public.instruments
      SET stock_quantity = COALESCE(stock, stock_quantity, 0)
      WHERE stock IS NOT NULL AND (stock_quantity IS NULL OR stock_quantity = 0);
    ';
  END IF;
END $$;

-- 4. Tambah kolom verifikasi pada public.physical_checks
ALTER TABLE public.physical_checks
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'Belum Diverifikasi',
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_by_name TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

ALTER TABLE public.physical_checks
  DROP CONSTRAINT IF EXISTS physical_checks_verification_status_check;

ALTER TABLE public.physical_checks
  ADD CONSTRAINT physical_checks_verification_status_check
  CHECK (verification_status IN ('Belum Diverifikasi', 'Terverifikasi', 'Perlu Tindak Lanjut'));

-- 5. Perbarui fungsi current_user_role agar mengecek akun aktif
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND COALESCE(is_active, TRUE) = TRUE;
$$;

-- 6. Kebijakan RLS khusus Admin (tanpa izin DELETE permanen)
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

DROP POLICY IF EXISTS "physical_checks_admin_update" ON public.physical_checks;
CREATE POLICY "physical_checks_admin_update"
  ON public.physical_checks FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'supervisor'))
  WITH CHECK (public.current_user_role() IN ('admin', 'supervisor'));
