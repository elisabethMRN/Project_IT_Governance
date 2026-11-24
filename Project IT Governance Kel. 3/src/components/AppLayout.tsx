import React, { useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRoleLabel } from '../lib/format';
import { PWAInstallButton } from './PWAInstallButton';
import { SimlabLogo } from './SimlabLogo';

export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon:
    | 'dashboard'
    | 'create'
    | 'verify'
    | 'export'
    | 'stock'
    | 'check'
    | 'users'
    | 'locations'
    | 'reports';
}

interface AppLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  pageTitle: string;
  pageSubtitle?: string;
  navItems: NavItem[];
  children: React.ReactNode;
}

function renderNavIcon(icon: NavItem['icon']) {
  const cls = 'h-4 w-4 shrink-0';
  switch (icon) {
    case 'dashboard':
      return <LayoutDashboard className={cls} aria-hidden="true" />;
    case 'create':
      return <FilePlus2 className={cls} aria-hidden="true" />;
    case 'verify':
      return <ShieldCheck className={cls} aria-hidden="true" />;
    case 'export':
      return <FileSpreadsheet className={cls} aria-hidden="true" />;
    case 'stock':
      return <Package className={cls} aria-hidden="true" />;
    case 'check':
      return <ClipboardCheck className={cls} aria-hidden="true" />;
    case 'users':
      return <Users className={cls} aria-hidden="true" />;
    case 'locations':
      return <Building2 className={cls} aria-hidden="true" />;
    case 'reports':
      return <FileText className={cls} aria-hidden="true" />;
  }
}

export function AppLayout({
  currentPath,
  onNavigate,
  pageTitle,
  pageSubtitle,
  navItems,
  children,
}: AppLayoutProps) {
  const { profile, user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const handleNavClick = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-[264px] lg:flex-col lg:fixed lg:inset-y-0 bg-[#0F2744] text-white border-r border-[#1B3A5F]">
        <div className="px-6 py-5 border-b border-white/10">
          <SimlabLogo variant="light" />
          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
            Manajemen Alat Gelas Laboratorium
          </p>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Menu utama">
          {navItems.map((item) => {
            const active = currentPath === item.path;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                  active
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                {renderNavIcon(item.icon)}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 bg-[#0B1F37]">
          <div className="mb-3">
            <p className="text-sm font-semibold text-white truncate">
              {profile?.full_name || 'Pengguna'}
            </p>
            <p className="text-xs text-teal-300 mt-0.5 truncate">
              {getRoleLabel(profile?.role)}
            </p>
            {user?.email && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{user.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <PWAInstallButton variant="sidebar" />
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-colors disabled:opacity-60 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{signingOut ? 'Keluar...' : 'Keluar'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="lg:hidden sticky top-0 z-30 bg-[#0F2744] text-white border-b border-[#1B3A5F] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-1 rounded-lg text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            aria-label="Buka menu navigasi"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <SimlabLogo variant="light" />
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white border border-white/15 whitespace-nowrap shrink-0"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Keluar</span>
        </button>
      </header>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0F2744] text-white flex flex-col h-full shadow-xl">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <SimlabLogo variant="light" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
                aria-label="Tutup menu navigasi"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = currentPath === item.path;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleNavClick(item.path)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                      active
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {renderNavIcon(item.icon)}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/10 bg-[#0B1F37]">
              <p className="text-sm font-semibold text-white truncate">
                {profile?.full_name || 'Pengguna'}
              </p>
              <p className="text-xs text-teal-300 mt-0.5 truncate">
                {getRoleLabel(profile?.role)}
              </p>
              <div className="mt-3 space-y-2">
                <PWAInstallButton variant="sidebar" />
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white border border-white/15"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{signingOut ? 'Keluar...' : 'Keluar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[264px] flex flex-col min-w-0">
        {/* Desktop Top Bar */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#0F2744] truncate">
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                {pageSubtitle}
              </p>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <PWAInstallButton variant="header" />
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                {profile?.full_name || 'Pengguna'}
              </p>
              <p className="text-xs text-teal-700 font-medium whitespace-nowrap">
                {getRoleLabel(profile?.role)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{signingOut ? 'Keluar...' : 'Keluar'}</span>
            </button>
          </div>
        </div>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-7xl w-full mx-auto">
          {children}
        </main>

        <footer className="px-4 sm:px-8 py-4 border-t border-slate-200 bg-white text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>
            SIMLAB — Prototype akademik • Data dummy • Belum terintegrasi langsung dengan SAKTI
          </span>
          <span>Aplikasi web yang dapat dipasang sebagai PWA • Data siap ekspor untuk proses administrasi berikutnya</span>
        </footer>
      </div>
    </div>
  );
}
