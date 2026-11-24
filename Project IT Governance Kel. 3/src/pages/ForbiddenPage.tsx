import { ShieldAlert } from 'lucide-react';

interface ForbiddenPageProps {
  onBackToHome: () => void;
}

export function ForbiddenPage({ onBackToHome }: ForbiddenPageProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-10 text-center max-w-lg mx-auto mt-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 border border-red-200 text-red-700">
        <ShieldAlert className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-[#0F2744]">Akses tidak diizinkan</h2>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
        Peran akun Anda tidak memiliki hak akses untuk membuka halaman ini.
      </p>
      <button
        type="button"
        onClick={onBackToHome}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#0F2744] hover:bg-[#16365E] px-4 py-2.5 text-sm font-semibold text-white transition-colors"
      >
        Kembali ke Beranda Peran Saya
      </button>
    </div>
  );
}
