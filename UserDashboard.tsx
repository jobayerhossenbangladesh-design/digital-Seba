import React from 'react';
import {
  ArrowUpRight,
  ClipboardList,
  Download,
  LogOut,
  PlusCircle,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatBDT } from '../data/seedData';
import { useAppInstall } from '../hooks/useAppInstall';
import { BrandLogo } from './BrandLogo';
import { UserTab } from './Navbar';

interface UserDashboardProps {
  onNavigateTab: (tab: UserTab) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  onNavigateTab,
}) => {
  const { currentUser, state, language, logout } = useApp();
  const { isInstalledMode, isInstalling, installUnsupported, installApp } =
    useAppInstall();
  const isEn = language === 'en';

  const userOrders = currentUser
    ? state.orders.filter((o) => o.userId === currentUser.id)
    : [];
  const pendingOrders = userOrders.filter(
    (o) => o.status === 'Pending' || o.status === 'Processing'
  ).length;
  const completedOrders = userOrders.filter(
    (o) => o.status === 'Completed'
  ).length;
  const pendingRecharges = currentUser
    ? state.recharges.filter(
        (r) => r.userId === currentUser.id && r.status === 'Pending'
      ).length
    : 0;

  const bannerSubtitle = isEn
    ? state.settings.bannerSubtitleEn || state.settings.bannerSubtitle
    : state.settings.bannerSubtitle;

  const renderDownloadButton = () => {
    if (isInstalledMode) return null;
    return (
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <button
          type="button"
          disabled={isInstalling}
          onClick={installApp}
          className="min-h-[42px] sm:min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl bg-[#0F2E28] hover:bg-[#133A32] disabled:opacity-70 text-emerald-300 border border-emerald-500/40 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>
            {isInstalling
              ? isEn
                ? 'Installing...'
                : 'ইনস্টল হচ্ছে...'
              : isEn
              ? 'Install App'
              : 'অ্যাপ ইনস্টল করুন'}
          </span>
        </button>
        {installUnsupported && (
          <p
            role="status"
            className="text-[11px] text-amber-300/95 text-right max-w-[220px] leading-snug"
          >
            {isEn
              ? 'Direct install is currently not supported in this browser.'
              : 'সরাসরি ইনস্টল বর্তমানে এই ব্রাউজারে সমর্থিত নয়।'}
          </p>
        )}
      </div>
    );
  };

  if (!currentUser) {
    return (
      <section className="rounded-3xl bg-gradient-to-br from-[#0A191E] via-[#0B2021] to-[#0D2622] text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border border-emerald-900/40 shadow-xl shadow-slate-900/10">
        <div className="max-w-xl space-y-3">
          <BrandLogo variant="dark" size="lg" />
          <p className="text-sm md:text-base text-slate-300 leading-relaxed pt-1">
            {bannerSubtitle}
          </p>
        </div>
        {!isInstalledMode && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {renderDownloadButton()}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-gradient-to-br from-[#0A191E] via-[#0B2021] to-[#0D2622] text-white p-5 sm:p-7 overflow-hidden border border-emerald-900/40 shadow-xl shadow-slate-900/10 space-y-5">
      {/* Row 1: Top Brand Logo + Dark Rounded Logout Button */}
      <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-white/10">
        <BrandLogo variant="dark" size="sm" />
        <button
          type="button"
          onClick={logout}
          className="min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{isEn ? 'Logout' : 'লগআউট'}</span>
        </button>
      </div>

      {/* Row 2: User Info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
          <UserCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400">
            {isEn ? 'Welcome back' : 'স্বাগতম'}
          </p>
          <h1 className="text-base sm:text-xl font-bold text-white truncate">
            {currentUser.name}
            <span className="text-xs sm:text-sm font-normal font-mono-num text-slate-300 ml-1.5">
              • {currentUser.mobile}
            </span>
          </h1>
        </div>
      </div>

      {/* Row 3: Wallet Balance & Download App Button */}
      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs text-slate-400 block mb-1">
            {isEn ? 'Current Wallet Balance' : 'বর্তমান ওয়ালেট ব্যালেন্স'}
          </span>
          <div className="text-3xl sm:text-4xl font-bold font-mono-num tracking-tight text-emerald-400 tabular-nums">
            {formatBDT(currentUser.balance)}
          </div>
        </div>

        {renderDownloadButton()}
      </div>

      {/* Row 4: Primary Action Buttons (Side-by-Side) */}
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => onNavigateTab('wallet')}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-md shadow-emerald-950/40"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>{isEn ? 'Add Money' : 'টাকা যোগ করুন'}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigateTab('orders')}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-slate-100 text-xs sm:text-sm font-semibold border border-white/10 flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <ClipboardList className="w-4 h-4 shrink-0" />
          <span>{isEn ? 'Order History' : 'অর্ডার হিস্ট্রি'}</span>
        </button>
      </div>

      {/* Row 5: 3-Column Stats Row at the bottom of the card */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-1">
        <button
          type="button"
          onClick={() => onNavigateTab('orders')}
          className="text-left p-3 sm:p-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] transition-colors"
        >
          <span className="text-[11px] sm:text-xs text-slate-300/90 block mb-1.5 truncate">
            {isEn ? 'Active Orders' : 'চলমান অর্ডার'}
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono-num text-white tabular-nums flex items-center justify-between">
            {pendingOrders}
            <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('orders')}
          className="text-left p-3 sm:p-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] transition-colors"
        >
          <span className="text-[11px] sm:text-xs text-slate-300/90 block mb-1.5 truncate">
            {isEn ? 'Completed' : 'সম্পন্ন সেবা'}
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono-num text-emerald-400 tabular-nums flex items-center justify-between">
            {completedOrders}
            <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('wallet')}
          className="text-left p-3 sm:p-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] transition-colors"
        >
          <span className="text-[11px] sm:text-xs text-slate-300/90 block mb-1.5 truncate">
            {isEn ? 'Pending Top-up' : 'পেন্ডিং রিচার্জ'}
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono-num text-amber-400 tabular-nums flex items-center justify-between">
            {pendingRecharges}
            <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
          </span>
        </button>
      </div>
    </section>
  );
};
