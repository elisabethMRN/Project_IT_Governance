import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../types/simlab';

const VALID_ROLES: UserRole[] = ['analis', 'supervisor', 'tu', 'admin'];

export type ProfileErrorType =
  | 'missing_profile'
  | 'unknown_role'
  | 'inactive_account'
  | 'fetch_error'
  | null;

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileError: ProfileErrorType;
  profileErrorMessage: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<ProfileErrorType>(null);
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);

  const loadUserProfile = useCallback(async (authUser: User | null) => {
    if (!authUser || !supabase) {
      setProfile(null);
      setProfileError(null);
      setProfileErrorMessage(null);
      return;
    }

    let { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active, created_at')
      .eq('id', authUser.id)
      .maybeSingle();

    // Fallback apabila migrasi kolom email/is_active belum dijalankan di Supabase
    if (error && error.code === '42703') {
      const legacy = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .eq('id', authUser.id)
        .maybeSingle();
      data = legacy.data
        ? { ...legacy.data, email: authUser.email ?? null, is_active: true }
        : null;
      error = legacy.error;
    }

    if (error) {
      setProfile(null);
      setProfileError('fetch_error');
      setProfileErrorMessage('Gagal memuat profil pengguna. Periksa koneksi atau kebijakan akses.');
      return;
    }

    if (!data) {
      setProfile(null);
      setProfileError('missing_profile');
      setProfileErrorMessage('Profil pengguna belum tersedia. Hubungi pengelola demo.');
      return;
    }

    if (data.is_active === false) {
      setProfile(null);
      setProfileError('inactive_account');
      setProfileErrorMessage(
        'Akun Anda sedang dinonaktifkan oleh Administrator. Hubungi pengelola sistem.'
      );
      return;
    }

    if (!VALID_ROLES.includes(data.role as UserRole)) {
      setProfile(null);
      setProfileError('unknown_role');
      setProfileErrorMessage('Peran pengguna tidak dikenal.');
      return;
    }

    setProfile({
      ...(data as Profile),
      email: (data as Profile).email || authUser.email || null,
    });
    setProfileError(null);
    setProfileErrorMessage(null);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        if (sessionUser) {
          await loadUserProfile(sessionUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initSession();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        setLoading(true);
        loadUserProfile(nextUser).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setProfile(null);
        setProfileError(null);
        setProfileErrorMessage(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        error:
          'Layanan autentikasi Supabase belum terkonfigurasi. Pastikan environment variable VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY telah diisi.',
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
        return { error: 'Email atau password salah. Silakan periksa kembali.' };
      }
      if (msg.includes('email not confirmed')) {
        return { error: 'Akun email belum dikonfirmasi pada sistem autentikasi.' };
      }
      return { error: 'Tidak dapat masuk ke sistem. Periksa kembali email dan password Anda.' };
    }

    if (data.user) {
      setUser(data.user);
      await loadUserProfile(data.user);
    }

    return { error: null };
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setProfileErrorMessage(null);
  };

  const sendPasswordReset = async (email: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        error: 'Layanan autentikasi Supabase belum terkonfigurasi.',
      };
    }
    const trimmed = email.trim();
    if (!trimmed) {
      return { error: 'Masukkan alamat email terlebih dahulu.' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: window.location.origin,
    });

    if (error) {
      return { error: 'Gagal mengirim tautan pengaturan ulang password. Pastikan email valid.' };
    }
    return { error: null };
  };

  const refreshProfile = async () => {
    await loadUserProfile(user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileError,
        profileErrorMessage,
        signIn,
        signOut,
        sendPasswordReset,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }
  return ctx;
}
