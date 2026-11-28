/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AlertTriangle, Megaphone, MessageCircle, RefreshCw } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { AdminPinModal } from './components/AdminPinModal';
import { AuthModal } from './components/AuthModal';
import { Navbar, UserTab, ViewMode } from './components/Navbar';
import { OrdersView } from './components/OrdersView';
import { ServiceCatalog } from './components/ServiceCatalog';
import { ServiceOrderModal } from './components/ServiceOrderModal';
import { SupportView } from './components/SupportView';
import { UserDashboard } from './components/UserDashboard';
import { WalletView } from './components/WalletView';
import { AppProvider, useApp } from './context/AppContext';
import { normalizeWhatsappNumber } from './data/seedData';
import { ServiceItem } from './types';

const DigitalShebaShell: React.FC = () => {
  const {
    state,
    language,
    currentUser,
    bootstrapError,
    isSyncing,
    retryBootstrap,
    refreshUserState,
  } = useApp();
  const isEn = language === 'en';
  const [viewMode, setViewMode] = useState<ViewMode>('user');
  const [activeTab, setActiveTab] = useState<UserTab>('home');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(
    null
  );
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAdminPinOpen, setIsAdminPinOpen] = useState(false);
  const lastUserSyncRef = useRef<number>(0);

  const handleSelectTab = (tab: UserTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Visibility-aware background sync for signed-in users so approved recharges/order notes appear live
  useEffect(() => {
    if (!currentUser || viewMode !== 'user') return;

    const triggerSync = () => {
      const now = Date.now();
      if (now - lastUserSyncRef.current < 10_000) return;
      lastUserSyncRef.current = now;
      void refreshUserState();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerSync();
      }
    };

    window.addEventListener('focus', triggerSync);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', triggerSync);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser, viewMode, refreshUserState]);

  const pendingOrdersCount = currentUser
    ? state.orders.filter(
        (o) =>
          o.userId === currentUser.id &&
          (o.status === 'Pending' || o.status === 'Processing')
      ).length
    : 0;

  const normalizedAdminWa =
    normalizeWhatsappNumber(state.settings.adminWhatsapp || '8801868132145') ||
    '8801868132145';
  const waLink = `https://wa.me/${normalizedAdminWa}`;

  const announcement = (
    isEn
      ? state.settings.announcementTextEn || state.settings.announcementText
      : state.settings.announcementText
  ).trim();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        viewMode={viewMode}
        onExitAdmin={() => setViewMode('user')}
        onOpenAuth={() => setIsAuthOpen(true)}
        pendingOrdersCount={pendingOrdersCount}
      />

      {/* Running Marquee Notice Bar — Positioned right below main header */}
      {viewMode === 'user' &&
        state.settings.showAnnouncement &&
        announcement && (
          <div
            role="region"
            aria-label={isEn ? 'Live Notice' : 'জরুরি নোটিশ'}
            className="bg-amber-50/90 border-b border-amber-200/80 text-amber-950"
          >
            <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 flex items-stretch">
              <div className="bg-orange-500 text-white px-3 sm:px-3.5 py-1.5 flex items-center gap-1.5 shrink-0 z-10 my-1.5 rounded-lg shadow-2xs">
                <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold whitespace-nowrap tracking-wide">
                  {isEn ? 'Notice' : 'নোটিশ'}
                </span>
              </div>
              <div className="flex-1 overflow-hidden marquee-wrapper flex items-center py-2 pl-2">
                <div className="animate-ds-marquee text-xs sm:text-sm font-semibold text-amber-950">
                  {[0, 1, 2, 3].map((idx) => (
                    <span
                      key={idx}
                      aria-hidden={idx > 0}
                      className="inline-flex items-center gap-3 pr-12 shrink-0 whitespace-nowrap"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>{announcement}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Main Content Container */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-5 pb-24 md:pb-12">
        {bootstrapError && (
          <div className="mb-4 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 flex flex-wrap items-center justify-between gap-3 text-rose-900">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {isEn
                  ? 'Unable to reach server. Please check your connection and retry.'
                  : 'সার্ভারের সাথে সংযোগ করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void retryBootstrap()}
              disabled={isSyncing}
              className="min-h-[34px] px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
              />
              <span>{isEn ? 'Retry' : 'পুনরায় চেষ্টা'}</span>
            </button>
          </div>
        )}

        {viewMode === 'admin' ? (
          <AdminPanel onExitAdmin={() => setViewMode('user')} />
        ) : (
          <div className="space-y-5 sm:space-y-6">
            {activeTab === 'home' && (
              <>
                <UserDashboard onNavigateTab={handleSelectTab} />

                <ServiceCatalog
                  services={state.services}
                  onSelectService={(srv) => setSelectedService(srv)}
                />
              </>
            )}

            {activeTab === 'orders' && (
              <OrdersView
                onOpenAuth={() => setIsAuthOpen(true)}
                onGoHome={() => handleSelectTab('home')}
              />
            )}

            {activeTab === 'wallet' && (
              <WalletView onOpenAuth={() => setIsAuthOpen(true)} />
            )}

            {activeTab === 'support' && <SupportView />}
          </div>
        )}
      </div>

      {/* Quiet Footer */}
      <footer className="hidden md:block border-t border-slate-200 bg-white py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-slate-500">
          <span>
            {isEn
              ? '© 2026 Digital Sheba · All rights reserved'
              : '© ২০২৬ ডিজিটাল সেবা (Digital Sheba) · সর্বস্বত্ব সংরক্ষিত'}
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setViewMode('user');
                handleSelectTab('wallet');
              }}
              className="hover:text-slate-900"
            >
              {isEn ? 'Wallet Recharge' : 'ওয়ালেট রিচার্জ'}
            </button>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-700"
            >
              {isEn ? 'WhatsApp Support' : 'হোয়াটসঅ্যাপ সাপোর্ট'}
            </a>
          </div>
        </div>
      </footer>

      {/* Working Floating WhatsApp Support Button across all screens */}
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={isEn ? 'WhatsApp Support' : 'হোয়াটসঅ্যাপ সাপোর্ট'}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 min-h-[48px] px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/25 flex items-center gap-2 transition-transform active:scale-95"
      >
        <MessageCircle className="w-5 h-5 shrink-0" />
        <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
          {isEn ? 'WhatsApp' : 'সাপোর্ট'}
        </span>
      </a>

      {/* Service Order Modal */}
      {selectedService && (
        <ServiceOrderModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onGoToRecharge={() => handleSelectTab('wallet')}
          onGoToOrders={() => handleSelectTab('orders')}
          onOpenAuth={() => setIsAuthOpen(true)}
        />
      )}

      {/* Auth Modal */}
      {isAuthOpen && (
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onAdminLoginClick={() => setIsAdminPinOpen(true)}
        />
      )}

      {/* Secure Admin PIN Verification Modal */}
      {isAdminPinOpen && (
        <AdminPinModal
          isOpen={isAdminPinOpen}
          onClose={() => setIsAdminPinOpen(false)}
          onSuccess={() => {
            setIsAdminPinOpen(false);
            setViewMode('admin');
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <DigitalShebaShell />
      <SpeedInsights />
    </AppProvider>
  );
}
