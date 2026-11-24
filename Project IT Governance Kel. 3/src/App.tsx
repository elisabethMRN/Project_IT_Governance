import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppLayout, type NavItem } from './components/AppLayout';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { AdminExportPage } from './pages/AdminExportPage';
import { AdminInstrumentsPage } from './pages/AdminInstrumentsPage';
import { AdminLocationsPage } from './pages/AdminLocationsPage';
import { AdminOverviewPage } from './pages/AdminOverviewPage';
import { AdminPhysicalChecksPage } from './pages/AdminPhysicalChecksPage';
import { AdminReportsPage } from './pages/AdminReportsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AnalystDashboard } from './pages/AnalystDashboard';
import { CreateReportPage } from './pages/CreateReportPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { LoginPage } from './pages/LoginPage';
import { SupervisorDashboard } from './pages/SupervisorDashboard';
import { TuDashboard } from './pages/TuDashboard';
import { TuPhysicalCheckPage } from './pages/TuPhysicalCheckPage';
import { TuStockPage } from './pages/TuStockPage';
import type { DamageReport } from './types/simlab';

function getDefaultRouteForRole(role?: string): string {
  switch (role) {
    case 'analis':
      return '/analis';
    case 'supervisor':
      return '/supervisor';
    case 'tu':
      return '/tu';
    case 'admin':
      return '/admin';
    default:
      return '/login';
  }
}

function getNavItemsForRole(role?: string): NavItem[] {
  switch (role) {
    case 'analis':
      return [
        { key: 'analis-home', label: 'Laporan Saya', path: '/analis', icon: 'dashboard' },
        {
          key: 'analis-create',
          label: 'Buat Laporan',
          path: '/analis/buat-laporan',
          icon: 'create',
        },
      ];
    case 'supervisor':
      return [
        {
          key: 'supervisor-queue',
          label: 'Antrean Verifikasi',
          path: '/supervisor',
          icon: 'verify',
        },
        {
          key: 'supervisor-all',
          label: 'Semua Laporan',
          path: '/supervisor/semua',
          icon: 'dashboard',
        },
      ];
    case 'tu':
      return [
        {
          key: 'tu-reports',
          label: 'Laporan & Ekspor',
          path: '/tu',
          icon: 'export',
        },
        {
          key: 'tu-stock',
          label: 'Stok & Kondisi Alat',
          path: '/tu/stok',
          icon: 'stock',
        },
        {
          key: 'tu-check',
          label: 'Pemeriksaan Semesteran',
          path: '/tu/pemeriksaan',
          icon: 'check',
        },
      ];
    case 'admin':
      return [
        {
          key: 'admin-overview',
          label: 'Ringkasan Sistem',
          path: '/admin',
          icon: 'dashboard',
        },
        {
          key: 'admin-users',
          label: 'Manajemen Pengguna',
          path: '/admin/pengguna',
          icon: 'users',
        },
        {
          key: 'admin-locations',
          label: 'Manajemen Lokasi',
          path: '/admin/lokasi',
          icon: 'locations',
        },
        {
          key: 'admin-instruments',
          label: 'Manajemen Alat & Stok',
          path: '/admin/alat',
          icon: 'stock',
        },
        {
          key: 'admin-reports',
          label: 'Manajemen Laporan',
          path: '/admin/laporan',
          icon: 'reports',
        },
        {
          key: 'admin-checks',
          label: 'Pemeriksaan Semesteran',
          path: '/admin/pemeriksaan',
          icon: 'check',
        },
        {
          key: 'admin-export',
          label: 'Ekspor Data',
          path: '/admin/ekspor',
          icon: 'export',
        },
      ];
    default:
      return [];
  }
}

function canRoleAccessPath(role: string, path: string): boolean {
  if (role === 'admin') {
    return (
      path === '/admin' ||
      path === '/admin/pengguna' ||
      path === '/admin/lokasi' ||
      path === '/admin/alat' ||
      path === '/admin/laporan' ||
      path === '/admin/pemeriksaan' ||
      path === '/admin/ekspor'
    );
  }
  if (role === 'analis') {
    return path === '/analis' || path === '/analis/buat-laporan';
  }
  if (role === 'supervisor') {
    return path === '/supervisor' || path === '/supervisor/semua';
  }
  if (role === 'tu') {
    return path === '/tu' || path === '/tu/stok' || path === '/tu/pemeriksaan';
  }
  return false;
}

function getPageMeta(path: string): { title: string; subtitle: string } {
  switch (path) {
    case '/analis':
      return {
        title: 'Dashboard Analis Laboratorium',
        subtitle: 'Kelola dan pantau laporan kerusakan alat gelas milik Anda',
      };
    case '/analis/buat-laporan':
      return {
        title: 'Buat Laporan Kerusakan',
        subtitle: 'Pengajuan laporan kerusakan alat gelas laboratorium untuk verifikasi QA',
      };
    case '/supervisor':
      return {
        title: 'Dashboard Supervisor / QA',
        subtitle: 'Antrean verifikasi laporan dan penetapan tindak lanjut',
      };
    case '/supervisor/semua':
      return {
        title: 'Daftar Seluruh Laporan Kerusakan',
        subtitle: 'Pemantauan menyeluruh status verifikasi, penolakan, dan tindak lanjut',
      };
    case '/tu':
      return {
        title: 'Dashboard Tata Usaha (TU)',
        subtitle: 'Rekapitulasi laporan terverifikasi dan penyiapan ekspor data',
      };
    case '/tu/stok':
      return {
        title: 'Stok & Kondisi Alat Gelas',
        subtitle: 'Pemantauan ketersediaan stok sistem alat gelas laboratorium',
      };
    case '/tu/pemeriksaan':
      return {
        title: 'Rekap Pemeriksaan Semesteran',
        subtitle: 'Pemeriksaan fisik berkala bulan Juni dan Desember',
      };
    case '/admin':
      return {
        title: 'Dashboard Administrator SIMLAB',
        subtitle: 'Ringkasan sistem, data master, dan pemantauan aktivitas pelaporan',
      };
    case '/admin/pengguna':
      return {
        title: 'Manajemen Pengguna',
        subtitle: 'Pengaturan peran dan status aktif akun pengguna SIMLAB',
      };
    case '/admin/lokasi':
      return {
        title: 'Manajemen Lokasi Laboratorium',
        subtitle: 'Pengelolaan daftar ruang dan lokasi laboratorium pengujian',
      };
    case '/admin/alat':
      return {
        title: 'Manajemen Alat Gelas & Stok',
        subtitle: 'Pengelolaan master alat gelas, stok sistem, stok minimum, dan kondisi',
      };
    case '/admin/laporan':
      return {
        title: 'Manajemen Seluruh Laporan',
        subtitle: 'Pemantauan laporan, perubahan status administratif, dan riwayat aktivitas',
      };
    case '/admin/pemeriksaan':
      return {
        title: 'Pemeriksaan Semesteran (Admin)',
        subtitle: 'Pemantauan selisih stok dan verifikasi pemeriksaan fisik Juni & Desember',
      };
    case '/admin/ekspor':
      return {
        title: 'Pusat Ekspor Data SIMLAB',
        subtitle: 'Ekspor laporan kerusakan, data alat & stok, serta rekap pemeriksaan ke Excel/CSV',
      };
    default:
      return {
        title: 'Akses tidak diizinkan',
        subtitle: 'Pemeriksaan otorisasi peran pengguna',
      };
  }
}

function readRouteFromLocation(): string {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('/')) return hash;
  const pathname = window.location.pathname;
  if (pathname && pathname !== '/') return pathname;
  return '';
}

function AppRouter() {
  const { user, profile, loading, profileError } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => readRouteFromLocation());
  const [pendingReportToOpen, setPendingReportToOpen] = useState<DamageReport | null>(null);

  const navigate = useCallback((path: string) => {
    window.location.hash = `#${path}`;
    setCurrentPath(path);
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setCurrentPath(readRouteFromLocation());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Reset path on sign-out and direct authenticated user to their role's dashboard
  useEffect(() => {
    if (!loading && !user) {
      setCurrentPath('');
      return;
    }
    if (!loading && user && profile) {
      const defaultRoute = getDefaultRouteForRole(profile.role);
      if (!currentPath || currentPath === '/' || currentPath === '/login') {
        navigate(defaultRoute);
      }
    }
  }, [loading, user, profile, currentPath, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-medium text-[#0F2744]">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" />
          <span>Memuat sesi SIMLAB...</span>
        </div>
      </div>
    );
  }

  if (!user || !profile || profileError) {
    return <LoginPage />;
  }

  const defaultRoute = getDefaultRouteForRole(profile.role);
  const activePath = currentPath && currentPath !== '/' ? currentPath : defaultRoute;
  const isAuthorized = canRoleAccessPath(profile.role, activePath);
  const navItems = getNavItemsForRole(profile.role);
  const pageMeta = isAuthorized
    ? getPageMeta(activePath)
    : { title: 'Akses tidak diizinkan', subtitle: 'Halaman di luar kewenangan peran Anda' };

  return (
    <AppLayout
      currentPath={activePath}
      onNavigate={navigate}
      pageTitle={pageMeta.title}
      pageSubtitle={pageMeta.subtitle}
      navItems={navItems}
    >
      {!isAuthorized ? (
        <ForbiddenPage onBackToHome={() => navigate(defaultRoute)} />
      ) : activePath === '/analis' ? (
        <AnalystDashboard
          onCreateClick={() => navigate('/analis/buat-laporan')}
          initialReportToOpen={pendingReportToOpen}
          onInitialReportHandled={() => setPendingReportToOpen(null)}
        />
      ) : activePath === '/analis/buat-laporan' ? (
        <CreateReportPage
          onSuccessBack={() => navigate('/analis')}
          onViewCreatedReport={(created) => {
            setPendingReportToOpen(created);
            navigate('/analis');
          }}
        />
      ) : activePath === '/supervisor' ? (
        <SupervisorDashboard initialTab="queue" />
      ) : activePath === '/supervisor/semua' ? (
        <SupervisorDashboard initialTab="all" />
      ) : activePath === '/tu' ? (
        <TuDashboard />
      ) : activePath === '/tu/stok' ? (
        <TuStockPage />
      ) : activePath === '/tu/pemeriksaan' ? (
        <TuPhysicalCheckPage />
      ) : activePath === '/admin' ? (
        <AdminOverviewPage onNavigate={navigate} />
      ) : activePath === '/admin/pengguna' ? (
        <AdminUsersPage />
      ) : activePath === '/admin/lokasi' ? (
        <AdminLocationsPage />
      ) : activePath === '/admin/alat' ? (
        <AdminInstrumentsPage />
      ) : activePath === '/admin/laporan' ? (
        <AdminReportsPage />
      ) : activePath === '/admin/pemeriksaan' ? (
        <AdminPhysicalChecksPage />
      ) : activePath === '/admin/ekspor' ? (
        <AdminExportPage />
      ) : (
        <ForbiddenPage onBackToHome={() => navigate(defaultRoute)} />
      )}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppRouter />
        <OfflineIndicator />
      </NotificationProvider>
    </AuthProvider>
  );
}
