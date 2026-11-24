import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'login';
}

export function PWAInstallButton({ variant = 'header' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    if (isIOS) {
      setShowGuideModal(true);
    }
  };

  const buttonClasses =
    variant === 'sidebar'
      ? 'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400'
      : variant === 'login'
        ? 'inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600'
        : 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Aplikasi web yang dapat dipasang sebagai PWA"
        className={buttonClasses}
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Install SIMLAB</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="pwa-guide-title" className="text-base font-bold text-[#0F2744]">
                  Install SIMLAB
                </h3>
                <p className="text-xs text-teal-700 font-medium mt-0.5">
                  Aplikasi web yang dapat dipasang sebagai PWA
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                aria-label="Tutup petunjuk instalasi"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <ol className="mt-4 space-y-2.5 text-sm text-slate-700 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="font-mono text-xs font-bold text-[#0F2744] mt-0.5">1.</span>
                <span>
                  Ketuk ikon{' '}
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                    <Share className="h-3.5 w-3.5" aria-hidden="true" />
                    Bagikan (Share)
                  </span>{' '}
                  pada bilah browser Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-xs font-bold text-[#0F2744] mt-0.5">2.</span>
                <span>
                  Pilih menu <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>, lalu
                  ketuk <strong>Tambah</strong>.
                </span>
              </li>
            </ol>

            <p className="mt-4 text-xs text-slate-500 leading-relaxed">
              SIMLAB berjalan sebagai aplikasi web yang dapat dipasang sebagai PWA melalui browser,
              bukan aplikasi resmi Android atau iOS di toko aplikasi.
            </p>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-lg bg-[#0F2744] hover:bg-[#16365E] py-2 text-xs font-semibold text-white transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
