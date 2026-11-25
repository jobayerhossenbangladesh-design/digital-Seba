import React, { useState } from 'react';
import { Lock, MessageCircle, User as UserIcon, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from './BrandLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminLoginClick: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAdminLoginClick,
  initialMode = 'login',
}) => {
  const { language, state, login, register } = useApp();
  const isEn = language === 'en';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'login') {
      const res = login(whatsapp, password);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onClose();
    } else {
      const res = register(name, whatsapp, password, agreedToPolicy);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/55 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <BrandLogo variant="light" size="sm" />
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
            aria-label={isEn ? 'Close' : 'বন্ধ করুন'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <h2
              id="auth-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              {mode === 'login'
                ? isEn
                  ? 'Sign In to Your Account'
                  : 'অ্যাকাউন্টে লগইন করুন'
                : isEn
                ? 'Create New Account'
                : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEn
                ? 'Use your WhatsApp number & password to order services and manage wallet'
                : 'সার্ভিস অর্ডার ও ওয়ালেট ব্যালেন্স ব্যবহার করতে WhatsApp নাম্বার দিয়ে প্রবেশ করুন'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`min-h-[40px] text-sm font-semibold rounded-lg transition-colors ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isEn ? 'Login' : 'লগইন'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`min-h-[40px] text-sm font-semibold rounded-lg transition-colors ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isEn ? 'Register' : 'রেজিস্ট্রেশন'}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {isEn ? 'Full Name' : 'নাম'}
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      isEn ? 'e.g. Md. Karim Ullah' : 'আপনার পূর্ণ নাম লিখুন'
                    }
                    className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  {isEn ? 'WhatsApp Number' : 'WhatsApp নাম্বার'}
                </label>
                <span className="text-[11px] font-mono-num text-slate-400">
                  {isEn ? 'Format:' : 'উদাহরণ:'} {state.settings.adminWhatsapp}
                </span>
              </div>
              <div className="relative">
                <MessageCircle className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="8801XXXXXXXXX"
                  className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {isEn ? 'Password' : 'পাসওয়ার্ড'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    isEn ? 'Enter password' : 'কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড'
                  }
                  className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>
            </div>

            {mode === 'register' && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToPolicy}
                  onChange={(e) => setAgreedToPolicy(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 shrink-0"
                />
                <span className="text-xs sm:text-sm font-medium text-slate-700 leading-snug">
                  {isEn
                    ? 'I agree to Digital Sheba Terms & Policies'
                    : 'আমি ডিজিটাল সেবার নীতিমালার সাথে একমত'}
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={mode === 'register' && !agreedToPolicy}
              className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                mode === 'register' && !agreedToPolicy
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {mode === 'login'
                ? isEn
                  ? 'Sign In'
                  : 'লগইন করুন'
                : isEn
                ? 'Create Account'
                : 'অ্যাকাউন্ট খুলুন'}
            </button>
          </form>

          {/* Discreet Demo Login link at the bottom — opens hidden Admin access */}
          {mode === 'login' && (
            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAdminLoginClick();
                }}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors py-1 px-2"
              >
                {isEn ? 'Demo Login' : 'ডেমো লগইন'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
