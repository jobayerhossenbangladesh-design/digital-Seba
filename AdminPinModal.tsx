import React, { useEffect, useState } from 'react';
import { KeyRound, Lock, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { language, unlockAdmin } = useApp();
  const isEn = language === 'en';
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = unlockAdmin(pin);
    if (!res.ok) {
      setError(
        isEn
          ? 'Incorrect Admin PIN. Please try again.'
          : 'ভুল অ্যাডমিন পিন! অনুগ্রহ করে সঠিক পিন দিন।'
      );
      return;
    }
    setPin('');
    onSuccess();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/65 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-pin-modal-title"
    >
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2
              id="admin-pin-modal-title"
              className="text-sm sm:text-base font-bold"
            >
              {isEn ? 'Admin Verification' : 'অ্যাডমিন পিন যাচাইকরণ'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label={isEn ? 'Close' : 'বন্ধ করুন'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {isEn
              ? 'Enter the Admin PIN / Password to access the management dashboard.'
              : 'অ্যাডমিন কন্ট্রোল প্যানেলে প্রবেশ করতে সঠিক অ্যাডমিন পিন / পাসওয়ার্ড লিখুন।'}
          </p>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs sm:text-sm text-rose-800 text-center font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
              {isEn ? 'Admin PIN / Password' : 'অ্যাডমিন পিন (PIN)'}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-center text-lg font-mono-num tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              {isEn ? 'Cancel' : 'বাতিল'}
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>{isEn ? 'Verify & Login' : 'প্রবেশ করুন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
