import React from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Globe,
  Headphones,
  Home,
  LogIn,
  Wallet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from './BrandLogo';

export type UserTab = 'home' | 'orders' | 'wallet' | 'support';
export type ViewMode = 'user' | 'admin';

interface NavbarProps {
  activeTab: UserTab;
  onSelectTab: (tab: UserTab) => void;
  viewMode: ViewMode;
  onExitAdmin: () => void;
  onOpenAuth: () => void;
  pendingOrdersCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  viewMode,
  onExitAdmin,
  onOpenAuth,
  pendingOrdersCount,
}) => {
  const { language, toggleLanguage, currentUser } = useApp();
  const isEn = language === 'en';

  const navItems: { id: UserTab; label: string; mobileLabel: string }[] = [
    {
      id: 'home',
      label: isEn ? 'Home & Services' : 'হোম ও সেবা',
      mobileLabel: isEn ? 'Home' : 'হোম',
    },
    {
      id: 'orders',
      label: isEn ? 'My Orders' : 'আমার অর্ডার',
      mobileLabel: isEn ? 'Orders' : 'অর্ডার',
    },
    {
      id: 'wallet',
      label: isEn ? 'Wallet' : 'ওয়ালেট রিচার্জ',
      mobileLabel: isEn ? 'Wallet' : 'ওয়ালেট',
    },
    {
      id: 'support',
      label: isEn ? 'Support' : 'সহায়তা',
      mobileLabel: isEn ? 'Support' : 'সহায়তা',
    },
  ];

  return (
    <>
      {/* Desktop & Mobile Top Header (No Admin button visible to general users) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-2 sm:gap-6">
          {/* Zone 1: Custom Brand Logo */}
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'admin') onExitAdmin();
              onSelectTab('home');
            }}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg shrink-0"
            aria-label="ডিজিটাল সেবা হোম"
          >
            <BrandLogo variant="header" size="sm" />
          </button>

          {/* Zone 2: 4 Single-line Navigation Links (Desktop) */}
          <nav
            aria-label={isEn ? 'Main navigation' : 'প্রধান নেভিগেশন'}
            className="hidden md:flex items-center gap-6 lg:gap-7"
          >
            {navItems.map((item) => {
              const isActive = viewMode === 'user' && activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (viewMode === 'admin') onExitAdmin();
                    onSelectTab(item.id);
                  }}
                  className={`py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? 'text-emerald-700 border-emerald-600'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                  {item.id === 'orders' && pendingOrdersCount > 0 && (
                    <span className="ml-1.5 text-xs font-mono-num text-emerald-700">
                      ({pendingOrdersCount})
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Language Toggle (BN / EN) + Primary User Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={
                isEn ? 'Switch to Bengali' : 'ইংরেজিতে পরিবর্তন করুন'
              }
              className="min-h-[38px] px-3.5 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="font-mono-num">
                <span className={!isEn ? 'text-emerald-700' : 'text-slate-400'}>
                  BN
                </span>
                <span className="text-slate-300 mx-1">/</span>
                <span className={isEn ? 'text-emerald-700' : 'text-slate-400'}>
                  EN
                </span>
              </span>
            </button>

            {viewMode === 'admin' ? (
              <button
                type="button"
                onClick={onExitAdmin}
                className="min-h-[38px] sm:min-h-[40px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>{isEn ? 'Back to App' : 'ইউজার ভিউ'}</span>
              </button>
            ) : !currentUser ? (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[38px] sm:min-h-[40px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs md:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>{isEn ? 'Login' : 'লগইন'}</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar */}
      {viewMode === 'user' && (
        <nav
          aria-label={isEn ? 'Mobile navigation' : 'মোবাইল নেভিগেশন'}
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
        >
          <div className="grid grid-cols-4 h-15 items-center">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              const Icon =
                item.id === 'home'
                  ? Home
                  : item.id === 'orders'
                  ? ClipboardList
                  : item.id === 'wallet'
                  ? Wallet
                  : Headphones;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    active
                      ? 'text-emerald-700'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      active ? 'stroke-[2.25]' : 'stroke-[1.75]'
                    }`}
                  />
                  <span className="text-[11px] font-semibold leading-tight whitespace-nowrap">
                    {item.mobileLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
};
