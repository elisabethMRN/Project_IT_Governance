import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { SimlabLogo } from '../components/SimlabLogo';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { signIn, sendPasswordReset, profileErrorMessage, user, signOut } = useAuth();

  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Email dan password wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setErrorMessage(error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetSuccess(null);

    if (!email.trim()) {
      setErrorMessage('Masukkan alamat email Anda terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await sendPasswordReset(email);
      if (error) {
        setErrorMessage(error);
      } else {
        setResetSuccess(
          'Jika email terdaftar, tautan pengaturan ulang password telah dikirim ke alamat email Anda.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeError = errorMessage || profileErrorMessage;

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col items-center text-center mb-7">
            <SimlabLogo variant="dark" compact />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#0F2744]">
              {mode === 'login' ? 'Masuk ke SIMLAB' : 'Lupa Password'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed max-w-xs">
              Sistem Informasi Manajemen Alat Gelas Laboratorium
            </p>
          </div>

          {activeError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p>{activeError}</p>
                {user && profileErrorMessage && (
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="mt-2 text-xs font-semibold text-red-700 underline hover:text-red-900"
                  >
                    Keluar dari sesi saat ini
                  </button>
                )}
              </div>
            </div>
          )}

          {resetSuccess && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-3 text-sm text-teal-900"
            >
              <MailCheck className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
              <p>{resetSuccess}</p>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@instansi.test"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                      setResetSuccess(null);
                    }}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
                  >
                    Lupa password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full rounded-lg border border-slate-300 bg-white pl-3.5 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2744] hover:bg-[#16365E] text-white font-semibold text-sm px-4 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>{submitting ? 'Memproses...' : 'Masuk'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotSubmit} noValidate className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Masukkan alamat email akun Anda untuk menerima tautan pengaturan ulang password.
              </p>
              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@instansi.test"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-4 py-2.5 transition-colors disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>{submitting ? 'Mengirim...' : 'Kirim Tautan Reset'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setResetSuccess(null);
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 py-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Kembali ke halaman masuk</span>
              </button>
            </form>
          )}

          <div className="mt-7 pt-5 border-t border-slate-200 text-center space-y-2.5">
            <p className="text-xs text-slate-500">
              Prototype akademik • Data dummy • Belum terintegrasi langsung dengan SAKTI
            </p>
            <p className="text-xs text-slate-400">
              Aplikasi web yang dapat dipasang sebagai PWA
            </p>
            <div className="flex justify-center">
              <PWAInstallButton variant="login" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
