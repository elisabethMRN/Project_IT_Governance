-- ============================================================================
-- SIMLAB — Data Dummy Demo (Laporan Kerusakan, Log Aktivitas & Pemeriksaan)
-- Jalankan di Supabase SQL Editor setelah akun demo & tabel tersedia.
-- Aman dijalankan ulang (idempotent).
-- ============================================================================

-- 1. Sinkronkan nilai kolom lama 'stock' ke 'stock_quantity' bila kolom 'stock' ada
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

-- 2. Isi data dummy laporan kerusakan, riwayat aktivitas, dan pemeriksaan fisik
DO $$
DECLARE
  v_analis_id public.profiles.id%TYPE;
  v_supervisor_id public.profiles.id%TYPE;
  v_tu_id public.profiles.id%TYPE;
  v_loc_a public.locations.id%TYPE;
  v_loc_b public.locations.id%TYPE;
  v_inst_beaker public.instruments.id%TYPE;
  v_inst_erlen public.instruments.id%TYPE;
  v_inst_cyl public.instruments.id%TYPE;
  v_inst_vol public.instruments.id%TYPE;
  v_r1 public.damage_reports.id%TYPE;
  v_r2 public.damage_reports.id%TYPE;
  v_r3 public.damage_reports.id%TYPE;
  v_r4 public.damage_reports.id%TYPE;
  v_beaker_stock INT := 30;
  v_erlen_stock INT := 50;
BEGIN
  SELECT id INTO v_analis_id FROM public.profiles WHERE role = 'analis' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_supervisor_id FROM public.profiles WHERE role = 'supervisor' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_tu_id FROM public.profiles WHERE role = 'tu' ORDER BY created_at LIMIT 1;

  SELECT id INTO v_loc_a FROM public.locations WHERE name = 'Laboratorium Demo A' LIMIT 1;
  SELECT id INTO v_loc_b FROM public.locations WHERE name = 'Laboratorium Demo B' LIMIT 1;
  IF v_loc_a IS NULL THEN SELECT id INTO v_loc_a FROM public.locations ORDER BY id ASC LIMIT 1; END IF;
  IF v_loc_b IS NULL THEN SELECT id INTO v_loc_b FROM public.locations ORDER BY id DESC LIMIT 1; END IF;

  SELECT id INTO v_inst_beaker FROM public.instruments WHERE name ILIKE '%Beaker%' LIMIT 1;
  SELECT id INTO v_inst_erlen FROM public.instruments WHERE name ILIKE '%Erlenmeyer%' LIMIT 1;
  SELECT id INTO v_inst_cyl FROM public.instruments WHERE name ILIKE '%Measuring Cylinder%' LIMIT 1;
  SELECT id INTO v_inst_vol FROM public.instruments WHERE name ILIKE '%Volumetric%' LIMIT 1;

  IF v_inst_beaker IS NULL THEN SELECT id INTO v_inst_beaker FROM public.instruments ORDER BY id ASC LIMIT 1; END IF;
  IF v_inst_erlen IS NULL THEN v_inst_erlen := v_inst_beaker; END IF;
  IF v_inst_cyl IS NULL THEN v_inst_cyl := v_inst_beaker; END IF;
  IF v_inst_vol IS NULL THEN v_inst_vol := v_inst_beaker; END IF;

  IF v_analis_id IS NULL OR v_loc_a IS NULL OR v_inst_beaker IS NULL THEN
    RAISE NOTICE 'Lewati seed dummy: pastikan akun demo dan lokasi/alat sudah ada.';
    RETURN;
  END IF;

  SELECT COALESCE(stock_quantity, 30) INTO v_beaker_stock FROM public.instruments WHERE id = v_inst_beaker;
  SELECT COALESCE(stock_quantity, 50) INTO v_erlen_stock FROM public.instruments WHERE id = v_inst_erlen;

  -- SIM-DEMO-001 (Diverifikasi)
  IF NOT EXISTS (SELECT 1 FROM public.damage_reports WHERE report_code = 'SIM-DEMO-001') THEN
    INSERT INTO public.damage_reports (
      report_code, reporter_id, reporter_name, location_id, instrument_id,
      damaged_qty, description, testing_impact, status,
      verifier_id, verifier_name, verified_at, verification_notes, created_at
    ) VALUES (
      'SIM-DEMO-001', v_analis_id, 'Analis Demo', v_loc_a, v_inst_beaker,
      2, 'Bibir gelas retak saat proses pencucian setelah preparasi larutan standar.',
      'Pengujian tetap berjalan menggunakan unit cadangan.', 'Diverifikasi',
      v_supervisor_id, 'Supervisor Demo', NOW() - INTERVAL '2 days',
      'Laporan lengkap dan telah diverifikasi QA.', NOW() - INTERVAL '3 days'
    ) RETURNING id INTO v_r1;

    INSERT INTO public.report_activity_logs (report_id, actor_id, actor_name, activity_type, notes, created_at)
    VALUES
      (v_r1, v_analis_id, 'Analis Demo', 'Laporan dibuat', 'Melaporkan kerusakan 2 unit alat gelas.', NOW() - INTERVAL '3 days'),
      (v_r1, COALESCE(v_supervisor_id, v_analis_id), 'Supervisor Demo', 'Laporan diverifikasi', 'Laporan lengkap dan telah diverifikasi QA.', NOW() - INTERVAL '2 days');
  END IF;

  -- SIM-DEMO-002 (Tindak Lanjut)
  IF NOT EXISTS (SELECT 1 FROM public.damage_reports WHERE report_code = 'SIM-DEMO-002') THEN
    INSERT INTO public.damage_reports (
      report_code, reporter_id, reporter_name, location_id, instrument_id,
      damaged_qty, description, testing_impact, status,
      verifier_id, verifier_name, verified_at, verification_notes,
      pic_id, pic_name, follow_up_deadline, follow_up_notes, created_at
    ) VALUES (
      'SIM-DEMO-002', v_analis_id, 'Analis Demo', v_loc_b, v_inst_erlen,
      1, 'Labu Erlenmeyer pecah di bagian dasar akibat benturan ringan pada rak pengering.',
      'Perlu penggantian unit dari stok cadangan.', 'Tindak Lanjut',
      v_supervisor_id, 'Supervisor Demo', NOW() - INTERVAL '4 days',
      'Disetujui untuk pengajuan penggantian alat.',
      COALESCE(v_tu_id, v_supervisor_id), 'TU Demo', (CURRENT_DATE + INTERVAL '7 days')::DATE,
      'Catat pada rekap pengadaan triwulan berikutnya.', NOW() - INTERVAL '5 days'
    ) RETURNING id INTO v_r2;

    INSERT INTO public.report_activity_logs (report_id, actor_id, actor_name, activity_type, notes, created_at)
    VALUES
      (v_r2, v_analis_id, 'Analis Demo', 'Laporan dibuat', 'Melaporkan kerusakan 1 unit Erlenmeyer Flask.', NOW() - INTERVAL '5 days'),
      (v_r2, COALESCE(v_supervisor_id, v_analis_id), 'Supervisor Demo', 'Laporan diverifikasi', 'Disetujui untuk pengajuan penggantian alat.', NOW() - INTERVAL '4 days'),
      (v_r2, COALESCE(v_supervisor_id, v_analis_id), 'Supervisor Demo', 'Tindak lanjut ditetapkan', 'PIC: TU Demo • Catat pada rekap pengadaan triwulan berikutnya.', NOW() - INTERVAL '4 days');
  END IF;

  -- SIM-DEMO-003 (Selesai)
  IF NOT EXISTS (SELECT 1 FROM public.damage_reports WHERE report_code = 'SIM-DEMO-003') THEN
    INSERT INTO public.damage_reports (
      report_code, reporter_id, reporter_name, location_id, instrument_id,
      damaged_qty, description, testing_impact, status,
      verifier_id, verifier_name, verified_at, verification_notes,
      pic_id, pic_name, follow_up_deadline, follow_up_notes, created_at
    ) VALUES (
      'SIM-DEMO-003', v_analis_id, 'Analis Demo', v_loc_a, v_inst_vol,
      1, 'Tutup asah labu ukur retak sehingga tidak dapat menutup rapat saat homogenisasi.',
      'Tidak menghambat jadwal uji harian.', 'Selesai',
      v_supervisor_id, 'Supervisor Demo', NOW() - INTERVAL '9 days',
      'Terverifikasi sesuai catatan laboratorium.',
      COALESCE(v_tu_id, v_supervisor_id), 'TU Demo', (CURRENT_DATE - INTERVAL '1 day')::DATE,
      'Penggantian tutup asah selesai didokumentasikan.', NOW() - INTERVAL '10 days'
    ) RETURNING id INTO v_r3;

    INSERT INTO public.report_activity_logs (report_id, actor_id, actor_name, activity_type, notes, created_at)
    VALUES
      (v_r3, v_analis_id, 'Analis Demo', 'Laporan dibuat', 'Melaporkan kerusakan 1 unit Volumetric Flask.', NOW() - INTERVAL '10 days'),
      (v_r3, COALESCE(v_supervisor_id, v_analis_id), 'Supervisor Demo', 'Laporan diverifikasi', 'Terverifikasi sesuai catatan laboratorium.', NOW() - INTERVAL '9 days'),
      (v_r3, COALESCE(v_supervisor_id, v_analis_id), 'Supervisor Demo', 'Tindak lanjut ditetapkan', 'PIC: TU Demo', NOW() - INTERVAL '9 days'),
      (v_r3, COALESCE(v_supervisor_id, v_analis_id), 'Supervisor Demo', 'Status berubah', 'Status diubah menjadi Selesai. Penggantian tutup asah selesai didokumentasikan.', NOW() - INTERVAL '2 days');
  END IF;

  -- SIM-DEMO-004 (Menunggu Verifikasi)
  IF NOT EXISTS (SELECT 1 FROM public.damage_reports WHERE report_code = 'SIM-DEMO-004') THEN
    INSERT INTO public.damage_reports (
      report_code, reporter_id, reporter_name, location_id, instrument_id,
      damaged_qty, description, testing_impact, status, created_at
    ) VALUES (
      'SIM-DEMO-004', v_analis_id, 'Analis Demo', v_loc_b, v_inst_cyl,
      1, 'Gelas ukur terjatuh di meja preparasi sehingga skala bagian bawah retak.',
      'Dialihkan ke gelas ukur cadangan.', 'Menunggu Verifikasi', NOW() - INTERVAL '4 hours'
    ) RETURNING id INTO v_r4;

    INSERT INTO public.report_activity_logs (report_id, actor_id, actor_name, activity_type, notes, created_at)
    VALUES
      (v_r4, v_analis_id, 'Analis Demo', 'Laporan dibuat', 'Melaporkan kerusakan 1 unit Measuring Cylinder.', NOW() - INTERVAL '4 hours');
  END IF;

  -- Rekap Pemeriksaan Fisik Semesteran contoh (Juni)
  IF v_tu_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.physical_checks LIMIT 1) THEN
    INSERT INTO public.physical_checks (
      period, check_month, check_year, location_id, instrument_id,
      system_stock, physical_stock, notes, checked_by, checked_by_name
    ) VALUES
      ('Semester 1', 'Juni', EXTRACT(YEAR FROM CURRENT_DATE)::INT, v_loc_a, v_inst_beaker,
       v_beaker_stock, GREATEST(v_beaker_stock - 2, 0), 'Selisih 2 unit sesuai laporan SIM-DEMO-001 (menunggu proses administrasi).', v_tu_id, 'TU Demo'),
      ('Semester 1', 'Juni', EXTRACT(YEAR FROM CURRENT_DATE)::INT, v_loc_b, v_inst_erlen,
       v_erlen_stock, GREATEST(v_erlen_stock - 1, 0), 'Selisih 1 unit sesuai laporan SIM-DEMO-002.', v_tu_id, 'TU Demo');
  END IF;
END $$;
