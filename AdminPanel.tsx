import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardList,
  Edit3,
  KeyRound,
  LayoutDashboard,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sliders,
  Trash2,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CATEGORY_LABELS_I18N } from '../data/i18n';
import { formatBDT, formatDateTimeBn, INITIAL_APP_STATE } from '../data/seedData';
import { FaqItem, Order, OrderStatus, ServiceItem } from '../types';
import { AdminServiceEditModal } from './AdminServiceEditModal';
import { ServiceIcon } from './ServiceIcon';
import { OrderStatusBadge, RechargeStatusBadge } from './StatusBadge';

type AdminTab =
  | 'overview'
  | 'orders'
  | 'recharges'
  | 'services'
  | 'users'
  | 'settings';

interface AdminPanelProps {
  onExitAdmin?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onExitAdmin }) => {
  const {
    state,
    language,
    isAdminUnlocked,
    unlockAdmin,
    lockAdmin,
    approveRecharge,
    rejectRecharge,
    updateOrderStatus,
    updateOrderNote,
    addService,
    updateService,
    deleteService,
    toggleServiceActive,
    adjustUserBalance,
    deleteUser,
    updateSettings,
    resetDemoData,
  } = useApp();

  const isEn = language === 'en';
  const categoryLabels = CATEGORY_LABELS_I18N[language];

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [toast, setToast] = useState<string | null>(null);

  // Orders Tab State
  const [orderFilter, setOrderFilter] = useState<'all' | OrderStatus>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  // Recharges Tab State
  const [rechargeFilter, setRechargeFilter] = useState<'Pending' | 'all'>(
    'Pending'
  );

  // Services Tab State
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(
    null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Users Tab State
  const [userSearch, setUserSearch] = useState('');
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>(
    {}
  );
  const [balanceNotes, setBalanceNotes] = useState<Record<string, string>>({});
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(
    null
  );

  // Settings Tab State
  const [rechargeNumberDraft, setRechargeNumberDraft] = useState(
    state.settings.rechargeNumber
  );
  const [whatsappDraft, setWhatsappDraft] = useState(
    state.settings.adminWhatsapp
  );
  const [adminPinDraft, setAdminPinDraft] = useState(state.settings.adminPin);
  const [announcementDraft, setAnnouncementDraft] = useState(
    state.settings.announcementText
  );
  const [announcementEnDraft, setAnnouncementEnDraft] = useState(
    state.settings.announcementTextEn
  );
  const [showAnnouncementDraft, setShowAnnouncementDraft] = useState(
    state.settings.showAnnouncement
  );
  const [bannerTitleDraft, setBannerTitleDraft] = useState(
    state.settings.bannerTitle
  );
  const [bannerTitleEnDraft, setBannerTitleEnDraft] = useState(
    state.settings.bannerTitleEn
  );
  const [bannerSubtitleDraft, setBannerSubtitleDraft] = useState(
    state.settings.bannerSubtitle
  );
  const [bannerSubtitleEnDraft, setBannerSubtitleEnDraft] = useState(
    state.settings.bannerSubtitleEn
  );
  const [serviceGuidelinesDraft, setServiceGuidelinesDraft] = useState(
    state.settings.serviceGuidelines ||
      INITIAL_APP_STATE.settings.serviceGuidelines ||
      ''
  );
  const [serviceGuidelinesEnDraft, setServiceGuidelinesEnDraft] = useState(
    state.settings.serviceGuidelinesEn ||
      INITIAL_APP_STATE.settings.serviceGuidelinesEn ||
      ''
  );
  const [faqsDraft, setFaqsDraft] = useState<FaqItem[]>(
    state.settings.faqs || INITIAL_APP_STATE.settings.faqs || []
  );
  const [supportTaglineDraft, setSupportTaglineDraft] = useState(
    state.settings.supportTagline ||
      INITIAL_APP_STATE.settings.supportTagline ||
      ''
  );
  const [supportTaglineEnDraft, setSupportTaglineEnDraft] = useState(
    state.settings.supportTaglineEn ||
      INITIAL_APP_STATE.settings.supportTaglineEn ||
      ''
  );
  const [confirmReset, setConfirmReset] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  // Dashboard Metrics
  const metrics = useMemo(() => {
    const totalUsers = state.users.length;
    const totalOrders = state.orders.length;
    const pendingRecharges = state.recharges.filter(
      (r) => r.status === 'Pending'
    ).length;
    const totalRevenue = state.orders
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + o.totalPrice, 0);

    const totalApprovedDeposits = state.recharges
      .filter((r) => r.status === 'Approved')
      .reduce((sum, r) => sum + r.amount, 0);
    const totalOrderSpend = state.transactions
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalRefunds = state.transactions
      .filter((t) => t.type === 'refund')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalUserWalletBalance = state.users.reduce(
      (sum, u) => sum + u.balance,
      0
    );

    return {
      totalUsers,
      totalOrders,
      pendingRecharges,
      totalRevenue,
      totalApprovedDeposits,
      totalOrderSpend,
      totalRefunds,
      totalUserWalletBalance,
    };
  }, [state]);

  // PIN Gate Screen
  if (!isAdminUnlocked) {
    const handlePinSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setPinError('');
      const res = unlockAdmin(pinInput);
      if (!res.ok) {
        setPinError(res.message);
        return;
      }
      setPinInput('');
    };

    return (
      <div className="max-w-md mx-auto py-8 sm:py-12">
        <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-slate-900">
              {isEn ? 'Admin Panel Login' : 'অ্যাডমিন প্যানেল লগইন'}
            </h1>
            <p className="text-sm text-slate-600">
              {isEn
                ? 'Enter your 4-digit Admin PIN to manage services, recharges, and orders.'
                : 'সার্ভিস, রিচার্জ এবং অর্ডার পরিচালনা করতে ৪ ডিজিটের অ্যাডমিন পিন দিন।'}
            </p>
          </div>

          {pinError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800 text-center">
              {pinError}
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {isEn ? 'Admin PIN' : 'অ্যাডমিন পিন (PIN)'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                required
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder={
                  isEn
                    ? 'Enter PIN (Default: 1234)'
                    : 'পিন লিখুন (ডিফল্ট: 1234)'
                }
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-200 text-center text-lg font-mono-num tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors"
            >
              {isEn ? 'Unlock Panel' : 'প্যানেল আনলক করুন'}
            </button>
          </form>

          <div className="flex items-center justify-end pt-1 text-xs text-slate-500">
            {onExitAdmin && (
              <button
                type="button"
                onClick={onExitAdmin}
                className="font-semibold text-emerald-700 hover:text-emerald-800"
              >
                {isEn ? 'Back to App' : 'অ্যাপে ফিরে যান'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const navTabs: {
    id: AdminTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    {
      id: 'overview',
      label: isEn ? 'Dashboard' : 'ড্যাশবোর্ড',
      icon: LayoutDashboard,
    },
    {
      id: 'orders',
      label: isEn ? 'Orders' : 'অর্ডার ম্যানেজমেন্ট',
      icon: ClipboardList,
      badge: state.orders.filter((o) => o.status === 'Pending').length,
    },
    {
      id: 'recharges',
      label: isEn ? 'Recharges' : 'রিচার্জ অনুমোদন',
      icon: Wallet,
      badge: metrics.pendingRecharges,
    },
    {
      id: 'services',
      label: isEn ? 'Service Manager' : 'সেবা ম্যানেজার',
      icon: Sliders,
    },
    {
      id: 'users',
      label: isEn ? 'Users & Balance' : 'ইউজার ও ব্যালেন্স',
      icon: Users,
    },
    {
      id: 'settings',
      label: isEn ? 'App Settings' : 'অ্যাপ সেটিংস',
      icon: Settings,
    },
  ];

  const filteredOrders = state.orders.filter((o) => {
    if (orderFilter !== 'all' && o.status !== orderFilter) return false;
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      o.id.toLowerCase().includes(q) ||
      o.userName.toLowerCase().includes(q) ||
      o.userMobile.includes(q) ||
      o.serviceTitle.toLowerCase().includes(q)
    );
  });

  const filteredRecharges = state.recharges.filter((r) =>
    rechargeFilter === 'Pending' ? r.status === 'Pending' : true
  );

  const filteredServices = state.services.filter((s) => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.titleEn || '').toLowerCase().includes(q)
    );
  });

  const filteredUsers = state.users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.mobile.includes(q);
  });

  const inspectOrder: Order | null =
    state.orders.find((o) => o.id === selectedOrderId) || null;

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-medium shadow-lg flex items-center gap-2 border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Admin Top Bar */}
      <div className="rounded-2xl bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold">
            {isEn ? 'Admin Control Panel' : 'অ্যাডমিন কন্ট্রোল প্যানেল'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            {isEn
              ? 'Manage services, approve recharges, deliver orders, and customize app content.'
              : 'সার্ভিস যোগ/সম্পাদনা, রিচার্জ অনুমোদন, অর্ডার ডেলিভারি এবং অ্যাপ কন্টেন্ট পরিচালনা করুন।'}
          </p>
        </div>

        <button
          type="button"
          onClick={lockAdmin}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{isEn ? 'Lock Panel' : 'প্যানেল লক করুন'}</span>
        </button>
      </div>

      {/* Layout: Sidebar on Desktop, Horizontal Scroll Tabs on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between gap-2 transition-colors whitespace-nowrap shrink-0 lg:w-full ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-mono-num font-bold ${
                      active
                        ? 'bg-emerald-700 text-white'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Main Workspace */}
        <main className="lg:col-span-9 space-y-6 min-w-0">
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
                  <span className="text-xs text-slate-500 block">
                    {isEn ? 'Total Users' : 'মোট ইউজার'}
                  </span>
                  <span className="text-2xl font-bold font-mono-num text-slate-900 tabular-nums mt-1 block">
                    {metrics.totalUsers}
                  </span>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
                  <span className="text-xs text-slate-500 block">
                    {isEn ? 'Total Orders' : 'মোট অর্ডার'}
                  </span>
                  <span className="text-2xl font-bold font-mono-num text-slate-900 tabular-nums mt-1 block">
                    {metrics.totalOrders}
                  </span>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
                  <span className="text-xs text-slate-500 block">
                    {isEn ? 'Pending Recharges' : 'পেন্ডিং রিচার্জ'}
                  </span>
                  <span className="text-2xl font-bold font-mono-num text-amber-600 tabular-nums mt-1 block">
                    {metrics.pendingRecharges}
                  </span>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
                  <span className="text-xs text-slate-500 block">
                    {isEn ? 'Total Revenue' : 'মোট আয় (অর্ডার)'}
                  </span>
                  <span className="text-2xl font-bold font-mono-num text-emerald-700 tabular-nums mt-1 block">
                    {formatBDT(metrics.totalRevenue)}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
                <h2 className="text-base font-bold text-slate-900">
                  {isEn
                    ? 'Wallet Transactions & Volume Summary'
                    : 'ওয়ালেট লেনদেন ও ভলিউম সারসংক্ষেপ'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-xs text-slate-500 block">
                      {isEn ? 'Approved Deposits' : 'মোট অনুমোদিত ডিপোজিট'}
                    </span>
                    <span className="text-lg font-bold font-mono-num text-emerald-700 tabular-nums">
                      {formatBDT(metrics.totalApprovedDeposits)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">
                      {isEn ? 'Order Payments' : 'মোট অর্ডার পেমেন্ট'}
                    </span>
                    <span className="text-lg font-bold font-mono-num text-slate-900 tabular-nums">
                      {formatBDT(metrics.totalOrderSpend)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">
                      {isEn ? 'Total Refunds' : 'মোট অর্ডার রিফান্ড'}
                    </span>
                    <span className="text-lg font-bold font-mono-num text-sky-700 tabular-nums">
                      {formatBDT(metrics.totalRefunds)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">
                      {isEn ? 'Total User Balance' : 'সকল ইউজারের মোট ব্যালেন্স'}
                    </span>
                    <span className="text-lg font-bold font-mono-num text-slate-900 tabular-nums">
                      {formatBDT(metrics.totalUserWalletBalance)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    {isEn
                      ? 'Recent Wallet Transactions'
                      : 'সাম্প্রতিক ওয়ালেট লেনদেনসমূহ'}
                  </h2>
                  <span className="text-xs text-slate-500 font-mono-num">
                    {isEn
                      ? `${state.transactions.length} total`
                      : `সর্বমোট ${state.transactions.length}টি লেনদেন`}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">
                          {isEn ? 'ID & Time' : 'আইডি ও সময়'}
                        </th>
                        <th className="py-3 px-4">
                          {isEn ? 'User' : 'ইউজার'}
                        </th>
                        <th className="py-3 px-4">
                          {isEn ? 'Description' : 'বিবরণ'}
                        </th>
                        <th className="py-3 px-4 text-right">
                          {isEn ? 'Amount' : 'পরিমাণ'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {state.transactions.slice(0, 12).map((txn) => {
                        const isPositive =
                          txn.type === 'credit' || txn.type === 'refund';
                        return (
                          <tr key={txn.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono-num text-xs font-semibold text-slate-900 block">
                                {txn.id}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatDateTimeBn(txn.createdAt, language)}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                              {txn.userName}
                            </td>
                            <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                              {txn.description}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono-num font-bold tabular-nums whitespace-nowrap ${
                                isPositive
                                  ? 'text-emerald-700'
                                  : 'text-slate-900'
                              }`}
                            >
                              {isPositive ? '+' : '-'}
                              {formatBDT(txn.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. ORDERS MANAGEMENT TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {(
                    [
                      'all',
                      'Pending',
                      'Processing',
                      'Completed',
                      'Cancelled',
                    ] as const
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOrderFilter(st)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                        orderFilter === st
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {st === 'all'
                        ? isEn
                          ? 'All Orders'
                          : 'সকল অর্ডার'
                        : st}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder={
                      isEn
                        ? 'Search Order ID or name...'
                        : 'অর্ডার আইডি বা নাম খুঁজুন...'
                    }
                    className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center text-sm text-slate-500">
                  {isEn ? 'No orders found.' : 'কোনো অর্ডার পাওয়া যায়নি।'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map((order) => {
                    const noteValue =
                      noteDrafts[order.id] !== undefined
                        ? noteDrafts[order.id]
                        : order.adminNote;

                    return (
                      <div
                        key={order.id}
                        className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono-num font-bold text-slate-900">
                                {order.id}
                              </span>
                              <span>·</span>
                              <span className="font-medium text-slate-800">
                                {order.userName} ({order.userMobile})
                              </span>
                              <span>·</span>
                              <span>
                                {formatDateTimeBn(order.createdAt, language)}
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-slate-900">
                              {order.serviceTitle}
                            </h3>
                            {order.selectedOptionLabel && (
                              <p className="text-xs font-medium text-emerald-700">
                                {isEn ? 'Option:' : 'অপশন:'}{' '}
                                {order.selectedOptionLabel}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                            <span className="text-base font-bold font-mono-num text-slate-900 tabular-nums">
                              {formatBDT(order.totalPrice)}
                            </span>
                            <OrderStatusBadge status={order.status} />
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                          <div className="md:col-span-4 space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-600">
                              {isEn ? 'Update Status' : 'স্ট্যাটাস পরিবর্তন করুন'}
                            </label>
                            <select
                              value={order.status}
                              onChange={(e) => {
                                const next = e.target.value as OrderStatus;
                                const res = updateOrderStatus(
                                  order.id,
                                  next,
                                  noteValue
                                );
                                showToast(res.message);
                              }}
                              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            >
                              <option value="Pending">Pending (অপেক্ষমান)</option>
                              <option value="Processing">
                                Processing (চলমান)
                              </option>
                              <option value="Completed">
                                Completed (সম্পন্ন)
                              </option>
                              <option value="Cancelled">
                                Cancelled (বাতিল ও রিফান্ড)
                              </option>
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedOrderId(
                                  selectedOrderId === order.id ? null : order.id
                                )
                              }
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 transition-colors"
                            >
                              {selectedOrderId === order.id
                                ? isEn
                                  ? 'Hide Details'
                                  : 'বিস্তারিত লুকান'
                                : isEn
                                ? `View Form Data (${order.entries.length})`
                                : `ফর্মের তথ্য ও স্ক্রিনশট দেখুন (${order.entries.length})`}
                            </button>
                          </div>

                          <div className="md:col-span-8 space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-600">
                              {isEn
                                ? 'Admin Delivery Note / Reply'
                                : 'অ্যাডমিন ডেলিভারি নোট / উত্তর'}
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <textarea
                                rows={2}
                                value={noteValue}
                                onChange={(e) =>
                                  setNoteDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: e.target.value,
                                  }))
                                }
                                placeholder={
                                  isEn
                                    ? 'Add delivery note, PIN, or instructions...'
                                    : 'গ্রাহকের জন্য ডেলিভারি তথ্য, পিন বা নির্দেশনা লিখুন...'
                                }
                                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const res = updateOrderNote(
                                    order.id,
                                    noteValue
                                  );
                                  showToast(res.message);
                                }}
                                className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 self-end sm:self-stretch"
                              >
                                {isEn ? 'Save Note' : 'নোট সেভ করুন'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {inspectOrder && inspectOrder.id === order.id && (
                          <div className="pt-3 border-t border-slate-200 space-y-3 bg-slate-50 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 p-4 sm:p-5 rounded-b-2xl">
                            <h4 className="text-xs font-bold text-slate-800">
                              {isEn
                                ? 'Submitted Customer Details:'
                                : 'গ্রাহকের জমাকৃত সম্পূর্ণ তথ্য:'}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {order.entries.map((entry, i) => (
                                <div
                                  key={`${entry.key}-${i}`}
                                  className="rounded-xl bg-white border border-slate-200 px-3 py-2"
                                >
                                  {entry.sectionTitle && (
                                    <span className="text-[11px] font-semibold text-emerald-700 block">
                                      {entry.sectionTitle}
                                    </span>
                                  )}
                                  <span className="text-xs text-slate-500 block">
                                    {entry.label}
                                  </span>
                                  <p className="text-xs sm:text-sm font-medium text-slate-900 mt-0.5 whitespace-pre-wrap break-words">
                                    {entry.value}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {order.attachments.length > 0 && (
                              <div className="space-y-2 pt-1">
                                <span className="text-xs font-bold text-slate-800 block">
                                  {isEn
                                    ? 'Uploaded Screenshots:'
                                    : 'আপলোডকৃত স্ক্রিনশট:'}
                                </span>
                                <div className="flex flex-wrap gap-3">
                                  {order.attachments.map((att, idx) => (
                                    <div
                                      key={idx}
                                      className="rounded-xl bg-white border border-slate-200 p-2.5 space-y-2"
                                    >
                                      <img
                                        src={att.dataUrl}
                                        alt={att.fileName}
                                        className="w-40 h-40 object-cover rounded-lg border border-slate-100"
                                      />
                                      <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="truncate max-w-[100px] text-slate-600">
                                          {att.fileName}
                                        </span>
                                        <a
                                          href={att.dataUrl}
                                          download={att.fileName}
                                          className="font-semibold text-emerald-700 hover:underline"
                                        >
                                          {isEn ? 'Download' : 'ডাউনলোড'}
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. RECHARGE APPROVALS TAB */}
          {activeTab === 'recharges' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900">
                  {isEn
                    ? 'bKash & Nagad Recharge Requests'
                    : 'বিকাশ ও নগদ রিচার্জ রিকোয়েস্ট'}
                </h2>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRechargeFilter('Pending')}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold ${
                      rechargeFilter === 'Pending'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Pending ({metrics.pendingRecharges})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRechargeFilter('all')}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold ${
                      rechargeFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    {isEn ? 'All' : 'সকল'} ({state.recharges.length})
                  </button>
                </div>
              </div>

              {filteredRecharges.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center text-sm text-slate-500">
                  {isEn
                    ? 'No pending recharge requests.'
                    : 'কোনো পেন্ডিং রিচার্জ রিকোয়েস্ট নেই।'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRecharges.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono-num font-bold text-slate-900">
                            {req.id}
                          </span>
                          <span>·</span>
                          <span className="font-semibold text-slate-800">
                            {req.userName} ({req.userMobile})
                          </span>
                          <span>·</span>
                          <span>
                            {formatDateTimeBn(req.createdAt, language)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <span className="text-lg font-bold font-mono-num text-emerald-700 tabular-nums">
                            {formatBDT(req.amount)}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">
                            {req.method}
                          </span>
                          <span className="text-xs font-mono-num text-slate-600">
                            {isEn ? 'Sender:' : 'প্রেরক:'} {req.senderNumber}
                          </span>
                          <span className="text-xs font-mono-num font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            TrxID: {req.trxId}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {req.status === 'Pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const res = approveRecharge(req.id);
                                showToast(res.message);
                              }}
                              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4" />
                              <span>
                                {isEn ? 'Approve' : 'অনুমোদন (Approve)'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const res = rejectRecharge(req.id);
                                showToast(res.message);
                              }}
                              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>{isEn ? 'Reject' : 'বাতিল'}</span>
                            </button>
                          </>
                        ) : (
                          <RechargeStatusBadge status={req.status} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. SERVICE MANAGER (ADD / EDIT / DELETE / TOGGLE) TAB */}
          {activeTab === 'services' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isEn
                      ? `Service Manager (${state.services.length})`
                      : `সেবা তালিকা ও মূল্য নিয়ন্ত্রণ (${state.services.length}টি)`}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isEn
                      ? 'Add new services, edit titles/descriptions/prices, or delete services.'
                      : 'নতুন সেবা যোগ করুন অথবা যেকোনো সেবার নাম, বিবরণ, মূল্য পরিবর্তন ও ডিলিট করুন।'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative w-full sm:w-56">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder={isEn ? 'Search services...' : 'সেবা খুঁজুন...'}
                      className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingService(null);
                      setServiceModalOpen(true);
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {isEn ? 'Add New Service' : 'নতুন সেবা যোগ করুন'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {filteredServices.map((srv) => (
                  <div
                    key={srv.id}
                    className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 overflow-hidden ${
                          srv.customIconUrl
                            ? 'bg-white border border-slate-200 p-0.5'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <ServiceIcon
                          name={srv.iconName}
                          customIconUrl={srv.customIconUrl}
                          className="w-5 h-5"
                        />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono-num font-semibold">
                            #{String(srv.orderNumber).padStart(2, '0')}
                          </span>
                          <span>·</span>
                          <span>{categoryLabels[srv.category]}</span>
                          <span>·</span>
                          <span
                            className={
                              srv.active
                                ? 'text-emerald-700 font-semibold'
                                : 'text-rose-600 font-semibold'
                            }
                          >
                            {srv.active
                              ? isEn
                                ? 'Active'
                                : 'সক্রিয়'
                              : isEn
                              ? 'Inactive'
                              : 'নিষ্ক্রিয়'}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          {srv.title}
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-1">
                          {srv.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="text-sm font-bold font-mono-num text-slate-900 tabular-nums mr-1">
                        {srv.isDynamic && srv.options && srv.options.length > 0
                          ? `${Math.min(...srv.options.map((o) => o.price))}৳ – ${Math.max(...srv.options.map((o) => o.price))}৳`
                          : formatBDT(srv.basePrice)}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          toggleServiceActive(srv.id);
                          showToast(
                            `"${srv.title}" ${srv.active ? 'নিষ্ক্রিয়' : 'সক্রিয়'} করা হয়েছে।`
                          );
                        }}
                        className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          srv.active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {srv.active
                          ? isEn
                            ? 'On'
                            : 'চালু'
                          : isEn
                          ? 'Off'
                          : 'বন্ধ'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingService(srv);
                          setServiceModalOpen(true);
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Edit' : 'এডিট'}</span>
                      </button>

                      {confirmDeleteId === srv.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const res = deleteService(srv.id);
                              setConfirmDeleteId(null);
                              showToast(res.message);
                            }}
                            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                          >
                            {isEn ? 'Confirm' : 'নিশ্চিত'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[36px] px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
                          >
                            {isEn ? 'No' : 'না'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(srv.id)}
                          aria-label={isEn ? 'Delete service' : 'সেবা মুছুন'}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Delete' : 'মুছুন'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. USERS & BALANCE MANAGEMENT TAB */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isEn
                      ? 'Users & Wallet Balance'
                      : 'নিবন্ধিত ইউজার ও ব্যালেন্স ব্যবস্থাপনা'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isEn
                      ? 'Manually add (+) or deduct (-) user wallet balance.'
                      : 'ম্যানুয়ালি যেকোনো ইউজারের ওয়ালেটে টাকা যোগ (+) বা কর্তন (-) করুন।'}
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={
                      isEn ? 'Name or WhatsApp...' : 'নাম বা WhatsApp নম্বর...'
                    }
                    className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredUsers.map((u) => {
                  const amtStr = balanceInputs[u.id] || '';
                  const noteStr = balanceNotes[u.id] || '';
                  const userOrderCount = state.orders.filter(
                    (o) => o.userId === u.id
                  ).length;

                  return (
                    <div
                      key={u.id}
                      className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            {u.name}
                          </h3>
                          <p className="text-xs text-slate-500">
                            <span className="font-mono-num">{u.mobile}</span> ·{' '}
                            {isEn ? 'Orders:' : 'মোট অর্ডার:'} {userOrderCount}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs text-slate-500 block">
                              {isEn ? 'Current Balance' : 'বর্তমান ব্যালেন্স'}
                            </span>
                            <span className="text-xl font-bold font-mono-num text-emerald-700 tabular-nums">
                              {formatBDT(u.balance)}
                            </span>
                          </div>

                          {confirmDeleteUserId === u.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const res = deleteUser(u.id);
                                  setConfirmDeleteUserId(null);
                                  showToast(res.message);
                                }}
                                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                              >
                                {isEn ? 'Confirm' : 'নিশ্চিত'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserId(null)}
                                className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                              >
                                {isEn ? 'No' : 'না'}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserId(u.id)}
                              aria-label={isEn ? 'Delete user' : 'ইউজার মুছুন'}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{isEn ? 'Delete' : 'মুছুন'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                        <input
                          type="number"
                          min={1}
                          value={amtStr}
                          onChange={(e) =>
                            setBalanceInputs((prev) => ({
                              ...prev,
                              [u.id]: e.target.value,
                            }))
                          }
                          placeholder={
                            isEn ? 'Amount (৳)' : 'টাকার পরিমাণ (৳)'
                          }
                          className="sm:col-span-3 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <input
                          type="text"
                          value={noteStr}
                          onChange={(e) =>
                            setBalanceNotes((prev) => ({
                              ...prev,
                              [u.id]: e.target.value,
                            }))
                          }
                          placeholder={
                            isEn ? 'Note (optional)' : 'কারণ/নোট (ঐচ্ছিক)'
                          }
                          className="sm:col-span-5 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <div className="sm:col-span-4 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.abs(Number(amtStr));
                              const res = adjustUserBalance(
                                u.id,
                                val,
                                noteStr
                              );
                              showToast(res.message);
                              if (res.ok) {
                                setBalanceInputs((p) => ({
                                  ...p,
                                  [u.id]: '',
                                }));
                                setBalanceNotes((p) => ({ ...p, [u.id]: '' }));
                              }
                            }}
                            className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Add' : 'যোগ করুন'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const val = -Math.abs(Number(amtStr));
                              const res = adjustUserBalance(
                                u.id,
                                val,
                                noteStr
                              );
                              showToast(res.message);
                              if (res.ok) {
                                setBalanceInputs((p) => ({
                                  ...p,
                                  [u.id]: '',
                                }));
                                setBalanceNotes((p) => ({ ...p, [u.id]: '' }));
                              }
                            }}
                            className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center justify-center gap-1"
                          >
                            <Minus className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Deduct' : 'কাটুন'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. APP SETTINGS & CONTENT CUSTOMIZATION TAB */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const res = updateSettings({
                    rechargeNumber: rechargeNumberDraft,
                    adminWhatsapp: whatsappDraft,
                    adminPin: adminPinDraft,
                    announcementText: announcementDraft,
                    announcementTextEn: announcementEnDraft,
                    showAnnouncement: showAnnouncementDraft,
                    bannerTitle: bannerTitleDraft,
                    bannerTitleEn: bannerTitleEnDraft,
                    bannerSubtitle: bannerSubtitleDraft,
                    bannerSubtitleEn: bannerSubtitleEnDraft,
                    serviceGuidelines: serviceGuidelinesDraft,
                    serviceGuidelinesEn: serviceGuidelinesEnDraft,
                    supportTagline: supportTaglineDraft,
                    supportTaglineEn: supportTaglineEnDraft,
                    faqs: faqsDraft.filter((f) => f.q.trim() && f.a.trim()),
                  });
                  showToast(res.message);
                }}
                className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-6"
              >
                {/* Payment & Contact Settings */}
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-slate-900">
                    {isEn
                      ? 'Contact, Payment & Security Settings'
                      : 'পেমেন্ট, সাপোর্ট ও নিরাপত্তা সেটিংস'}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {isEn
                          ? 'bKash / Nagad Number'
                          : 'বিকাশ / নগদ রিচার্জ নম্বর'}
                      </label>
                      <input
                        type="text"
                        required
                        value={rechargeNumberDraft}
                        onChange={(e) => setRechargeNumberDraft(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {isEn
                          ? 'Admin WhatsApp (with 88)'
                          : 'অ্যাডমিন হোয়াটসঅ্যাপ (৮৮ সহ)'}
                      </label>
                      <input
                        type="text"
                        required
                        value={whatsappDraft}
                        onChange={(e) => setWhatsappDraft(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {isEn ? 'Admin PIN' : 'অ্যাডমিন পিন (PIN)'}
                      </label>
                      <input
                        type="text"
                        required
                        minLength={4}
                        value={adminPinDraft}
                        onChange={(e) => setAdminPinDraft(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Announcements & Notice Customization */}
                <div className="pt-5 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {isEn
                          ? 'App Notice & Announcement Bar'
                          : 'অ্যাপ নোটিশ ও ঘোষণা বার'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isEn
                          ? 'Shown at the top of the user homepage.'
                          : 'হোমপেজের একদম উপরে গুরুত্বপূর্ণ নোটিশ হিসেবে প্রদর্শিত হয়।'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAnnouncementDraft((prev) => !prev)}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        showAnnouncementDraft
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {showAnnouncementDraft
                        ? isEn
                          ? 'Visible'
                          : 'চালু আছে'
                        : isEn
                        ? 'Hidden'
                        : 'বন্ধ আছে'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        নোটিশ / ঘোষণা (বাংলায়)
                      </label>
                      <textarea
                        rows={2}
                        value={announcementDraft}
                        onChange={(e) => setAnnouncementDraft(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Announcement Text (English)
                      </label>
                      <textarea
                        rows={2}
                        value={announcementEnDraft}
                        onChange={(e) => setAnnouncementEnDraft(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Banner Text Customization */}
                <div className="pt-5 border-t border-slate-100 space-y-4">
                  <h3 className="text-base font-bold text-slate-900">
                    {isEn
                      ? 'Welcome Banner Text Customization'
                      : 'ওয়েলকাম ব্যানার টেক্সট কাস্টমাইজেশন'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        ব্যানার শিরোনাম (বাংলায়)
                      </label>
                      <input
                        type="text"
                        value={bannerTitleDraft}
                        onChange={(e) => setBannerTitleDraft(e.target.value)}
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Banner Title (English)
                      </label>
                      <input
                        type="text"
                        value={bannerTitleEnDraft}
                        onChange={(e) => setBannerTitleEnDraft(e.target.value)}
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        ব্যানার বিবরণ (বাংলায়)
                      </label>
                      <textarea
                        rows={2}
                        value={bannerSubtitleDraft}
                        onChange={(e) => setBannerSubtitleDraft(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Banner Subtitle (English)
                      </label>
                      <textarea
                        rows={2}
                        value={bannerSubtitleEnDraft}
                        onChange={(e) =>
                          setBannerSubtitleEnDraft(e.target.value)
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Policies, Guidelines & FAQ Management */}
                <div className="pt-5 border-t border-slate-100 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {isEn
                        ? 'Support Policies, Guidelines & FAQs'
                        : 'সাপোর্ট নীতিমালা, নিয়মাবলি ও প্রশ্নোত্তর (FAQ)'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isEn
                        ? 'Displayed on the Support page. Write each guideline on a separate line.'
                        : 'সহায়তা (Support) পেজে প্রদর্শিত হয়। প্রতিটি নিয়ম আলাদা লাইনে লিখুন।'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        সাপোর্ট হাইলাইট ট্যাগলাইন (বাংলায়)
                      </label>
                      <input
                        type="text"
                        value={supportTaglineDraft}
                        onChange={(e) => setSupportTaglineDraft(e.target.value)}
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Support Highlight Tagline (English)
                      </label>
                      <input
                        type="text"
                        value={supportTaglineEnDraft}
                        onChange={(e) =>
                          setSupportTaglineEnDraft(e.target.value)
                        }
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        সেবার সময় ও নিয়মাবলি (বাংলায় — প্রতি লাইনে ১টি)
                      </label>
                      <textarea
                        rows={4}
                        value={serviceGuidelinesDraft}
                        onChange={(e) =>
                          setServiceGuidelinesDraft(e.target.value)
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Service Hours & Guidelines (English — 1 per line)
                      </label>
                      <textarea
                        rows={4}
                        value={serviceGuidelinesEnDraft}
                        onChange={(e) =>
                          setServiceGuidelinesEnDraft(e.target.value)
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">
                        {isEn
                          ? 'Frequently Asked Questions (FAQ)'
                          : 'সচরাচর জিজ্ঞাসিত প্রশ্নাবলি (FAQ)'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setFaqsDraft((prev) => [
                            ...prev,
                            {
                              id: `faq-${Date.now()}`,
                              q: '',
                              a: '',
                              qEn: '',
                              aEn: '',
                            },
                          ])
                        }
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {isEn ? 'Add FAQ' : 'নতুন প্রশ্ন যোগ করুন'}
                        </span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {faqsDraft.map((faq, idx) => (
                        <div
                          key={faq.id}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-600">
                              FAQ #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setFaqsDraft((prev) =>
                                  prev.filter((item) => item.id !== faq.id)
                                )
                              }
                              className="min-h-[30px] px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{isEn ? 'Remove' : 'মুছুন'}</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input
                              type="text"
                              value={faq.q}
                              onChange={(e) =>
                                setFaqsDraft((prev) =>
                                  prev.map((item) =>
                                    item.id === faq.id
                                      ? { ...item, q: e.target.value }
                                      : item
                                  )
                                )
                              }
                              placeholder="প্রশ্ন (বাংলায়)"
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                            <input
                              type="text"
                              value={faq.qEn || ''}
                              onChange={(e) =>
                                setFaqsDraft((prev) =>
                                  prev.map((item) =>
                                    item.id === faq.id
                                      ? { ...item, qEn: e.target.value }
                                      : item
                                  )
                                )
                              }
                              placeholder="Question (English - Optional)"
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                            <textarea
                              rows={2}
                              value={faq.a}
                              onChange={(e) =>
                                setFaqsDraft((prev) =>
                                  prev.map((item) =>
                                    item.id === faq.id
                                      ? { ...item, a: e.target.value }
                                      : item
                                  )
                                )
                              }
                              placeholder="উত্তর (বাংলায়)"
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                            <textarea
                              rows={2}
                              value={faq.aEn || ''}
                              onChange={(e) =>
                                setFaqsDraft((prev) =>
                                  prev.map((item) =>
                                    item.id === faq.id
                                      ? { ...item, aEn: e.target.value }
                                      : item
                                  )
                                )
                              }
                              placeholder="Answer (English - Optional)"
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
                  >
                    {isEn ? 'Save All Settings' : 'সেটিংস ও কন্টেন্ট সংরক্ষণ করুন'}
                  </button>
                </div>
              </form>

              <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {isEn ? 'Reset Demo Data' : 'ডেমো ডেটা রিসেট'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isEn
                      ? 'Restore all orders, users, recharges, and services to initial state.'
                      : 'সকল অর্ডার, ইউজার, রিচার্জ এবং সার্ভিস মূল্য প্রাথমিক অবস্থায় ফিরিয়ে আনুন।'}
                  </p>
                </div>

                {confirmReset ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetDemoData();
                        setConfirmReset(false);
                        const s = INITIAL_APP_STATE.settings;
                        setRechargeNumberDraft(s.rechargeNumber);
                        setWhatsappDraft(s.adminWhatsapp);
                        setAdminPinDraft(s.adminPin);
                        setAnnouncementDraft(s.announcementText);
                        setAnnouncementEnDraft(s.announcementTextEn);
                        setShowAnnouncementDraft(s.showAnnouncement);
                        setBannerTitleDraft(s.bannerTitle);
                        setBannerTitleEnDraft(s.bannerTitleEn);
                        setBannerSubtitleDraft(s.bannerSubtitle);
                        setBannerSubtitleEnDraft(s.bannerSubtitleEn);
                        setServiceGuidelinesDraft(s.serviceGuidelines || '');
                        setServiceGuidelinesEnDraft(
                          s.serviceGuidelinesEn || ''
                        );
                        setSupportTaglineDraft(s.supportTagline || '');
                        setSupportTaglineEnDraft(s.supportTaglineEn || '');
                        setFaqsDraft(s.faqs || []);
                        showToast('ডেমো ডেটা সফলভাবে রিসেট হয়েছে।');
                      }}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                    >
                      {isEn ? 'Yes, Reset' : 'হ্যাঁ, রিসেট করুন'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                    >
                      {isEn ? 'Cancel' : 'বাতিল'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="min-h-[40px] px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {isEn ? 'Reset Demo Data' : 'ডেমো ডেটা রিসেট করুন'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add / Edit Service Modal */}
      <AdminServiceEditModal
        isOpen={serviceModalOpen}
        service={editingService}
        onClose={() => {
          setServiceModalOpen(false);
          setEditingService(null);
        }}
        onSaveEdit={(updated) => {
          const res = updateService(updated);
          setServiceModalOpen(false);
          setEditingService(null);
          showToast(res.message);
        }}
        onCreateNew={(payload) => {
          const res = addService(payload);
          setServiceModalOpen(false);
          setEditingService(null);
          showToast(res.message);
        }}
      />
    </div>
  );
};
