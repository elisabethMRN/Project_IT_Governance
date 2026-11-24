import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Shield, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatDate, getRoleLabel } from '../lib/format';
import { adminUpdateUserProfile, fetchAssignableProfiles } from '../lib/simlabApi';
import type { Profile, UserRole } from '../types/simlab';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'analis', label: 'Analis Laboratorium' },
  { value: 'supervisor', label: 'Supervisor / QA' },
  { value: 'tu', label: 'Tata Usaha (TU)' },
  { value: 'admin', label: 'Administrator' },
];

export function AdminUsersPage() {
  const { profile: currentUser } = useAuth();
  const { showNotification } = useNotification();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchAssignableProfiles()
      .then((rows) => {
        if (!mounted) return;
        setUsers(rows);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      const active = u.is_active !== false;
      if (statusFilter === 'active' && !active) return false;
      if (statusFilter === 'inactive' && active) return false;
      if (!q) return true;
      return [u.full_name, u.email, getRoleLabel(u.role)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleRoleChange = async (target: Profile, nextRole: UserRole) => {
    if (target.role === nextRole) return;
    if (currentUser && String(target.id) === String(currentUser.id) && nextRole !== 'admin') {
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: 'Anda tidak dapat menurunkan peran akun Administrator yang sedang digunakan.',
      });
      return;
    }

    setError(null);
    setSavingId(target.id);

    try {
      const updated = await adminUpdateUserProfile({
        userId: target.id,
        role: nextRole,
        isActive: target.is_active !== false,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      showNotification({
        variant: 'success',
        title: 'Peran Pengguna Diperbarui',
        message: 'Peran pengguna berhasil diperbarui.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah peran pengguna.';
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => handleRoleChange(target, nextRole),
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (target: Profile) => {
    const nextActive = target.is_active === false;
    if (currentUser && String(target.id) === String(currentUser.id) && !nextActive) {
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: 'Anda tidak dapat menonaktifkan akun Administrator yang sedang login.',
      });
      return;
    }

    setError(null);
    setSavingId(target.id);

    try {
      const updated = await adminUpdateUserProfile({
        userId: target.id,
        role: (target.role as UserRole) || 'analis',
        isActive: nextActive,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      showNotification({
        variant: 'success',
        title: nextActive ? 'Akun Diaktifkan' : 'Akun Dinonaktifkan',
        message: nextActive
          ? `Akun ${updated.full_name} berhasil diaktifkan kembali.`
          : `Akun ${updated.full_name} berhasil dinonaktifkan.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah status akun.';
      showNotification({
        variant: 'error',
        title: 'Terjadi Kesalahan',
        message: msg,
        primaryLabel: 'Coba Lagi',
        onPrimaryAction: () => handleToggleActive(target),
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#0F2744]">Manajemen Pengguna</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola peran dan status aktif pengguna. Penghapusan akun permanen dan pengubahan
            password pengguna lain dinonaktifkan demi keamanan sistem.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 shrink-0">
          <Shield className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
          <span>{users.length} Pengguna Terdaftar</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau email pengguna..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
            aria-label="Filter peran pengguna"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          >
            <option value="all">Semua Peran</option>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            aria-label="Filter status akun"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600">
            Tidak ada pengguna yang sesuai dengan filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nama Pengguna</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Peran</th>
                  <th className="py-3 px-4">Status Akun</th>
                  <th className="py-3 px-4 whitespace-nowrap">Terdaftar</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredUsers.map((u) => {
                  const isActive = u.is_active !== false;
                  const isSelf = currentUser && String(u.id) === String(currentUser.id);
                  const isSaving = savingId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {u.full_name}
                          {isSelf && (
                            <span className="ml-2 text-xs font-medium text-teal-700">
                              (Anda)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs sm:text-sm">
                        {u.email || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          aria-label={`Ubah peran ${u.full_name}`}
                          value={u.role}
                          disabled={isSaving}
                          onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:opacity-60"
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              disabled={Boolean(isSelf && opt.value !== 'admin')}
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 whitespace-nowrap">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 whitespace-nowrap">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={Boolean(isSaving || (isSelf && isActive))}
                          onClick={() => handleToggleActive(u)}
                          title={
                            isSelf && isActive
                              ? 'Akun yang sedang login tidak dapat dinonaktifkan'
                              : undefined
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-50 ${
                            isActive
                              ? 'border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900'
                              : 'border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-900'
                          }`}
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : isActive ? (
                            <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>{isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                        </button>
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
