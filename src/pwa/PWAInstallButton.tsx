import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-950/70 border border-emerald-500/40 text-[10px] font-arcade text-emerald-400">
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        <span>INSTALLED</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 px-3 py-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/80 text-cyan-300 font-arcade text-[10px] tracking-wider transition-all shadow-[0_0_12px_rgba(34,211,238,0.3)] hover:shadow-[0_0_18px_rgba(34,211,238,0.6)] active:scale-95 cursor-pointer"
        title="Install RetroArcade as an offline PWA"
      >
        <Download className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
        <span>INSTALL APP</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/80 text-cyan-300 font-arcade text-[10px] tracking-wider transition-all shadow-[0_0_12px_rgba(34,211,238,0.3)] hover:shadow-[0_0_18px_rgba(34,211,238,0.6)] active:scale-95 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          <span>INSTALL ON iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-xl bg-[#090d16] border-2 border-cyan-400 p-6 shadow-[0_0_30px_rgba(6,182,212,0.4)] text-left relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-arcade text-cyan-300 tracking-wider">INSTALL ON iPHONE/iPAD</h3>
              </div>
              
              <div className="space-y-3 text-xs text-gray-300 font-sans leading-relaxed">
                <p className="flex items-start gap-2">
                  <span className="font-arcade text-pink-500 font-bold">1.</span>
                  <span>Tap the <strong>Share</strong> button (box with upward arrow) in the Safari toolbar.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-arcade text-pink-500 font-bold">2.</span>
                  <span>Scroll down the action list and select <strong>Add to Home Screen</strong>.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-arcade text-pink-500 font-bold">3.</span>
                  <span>Launch <strong>RetroArcade</strong> from your home screen for full-screen arcade play offline!</span>
                </p>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-arcade text-xs font-bold tracking-wider transition-colors shadow-[0_0_15px_rgba(6,182,212,0.5)]"
              >
                GOT IT
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
