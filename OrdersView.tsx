import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Download,
  LogIn,
  MessageSquareText,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatBDT, formatDateTimeBn } from '../data/seedData';
import { Order, OrderStatus } from '../types';
import { OrderStatusBadge } from './StatusBadge';

interface OrdersViewProps {
  onOpenAuth: () => void;
  onGoHome: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  onOpenAuth,
  onGoHome,
}) => {
  const { currentUser, state, language } = useApp();
  const isEn = language === 'en';
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const userOrders = useMemo(() => {
    if (!currentUser) return [];
    return state.orders.filter((o) => o.userId === currentUser.id);
  }, [currentUser, state.orders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return userOrders;
    return userOrders.filter((o) => o.status === statusFilter);
  }, [userOrders, statusFilter]);

  const handleCopyNote = async (order: Order) => {
    if (!order.adminNote) return;
    try {
      await navigator.clipboard.writeText(order.adminNote);
    } catch {
      // ignore clipboard errors
    }
    setCopiedOrderId(order.id);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const handleDownloadReceipt = (order: Order) => {
    const lines = [
      `=== ডিজিটাল সেবা (Digital Sheba) — অর্ডার রসিদ ===`,
      `Order ID: ${order.id}`,
      `Service: ${order.serviceTitle}`,
      order.selectedOptionLabel ? `Option: ${order.selectedOptionLabel}` : '',
      `Price: ${order.totalPrice} BDT`,
      `Status: ${order.status}`,
      `Date: ${formatDateTimeBn(order.createdAt, language)}`,
      ``,
      `--- Submitted Details ---`,
      ...order.entries.map((e) => `${e.label}: ${e.value}`),
      ``,
      `--- Admin Delivery Note ---`,
      order.adminNote || 'No delivery note added yet.',
    ]
      .filter(Boolean)
      .join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${order.id}-receipt.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!currentUser) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center max-w-xl mx-auto">
        <ClipboardList className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {isEn
            ? 'Login to view your order history'
            : 'অর্ডার হিস্ট্রি দেখতে লগইন করুন'}
        </h2>
        <p className="text-sm text-slate-600 mb-5">
          {isEn
            ? 'Sign in to check live order statuses and Admin delivery notes.'
            : 'আপনার জমাকৃত সকল অর্ডারের স্ট্যাটাস ও অ্যাডমিন ডেলিভারি নোট দেখতে লগইন করুন।'}
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-2"
        >
          <LogIn className="w-4 h-4" />
          <span>{isEn ? 'Login' : 'লগইন করুন'}</span>
        </button>
      </div>
    );
  }

  const filterTabs: { id: 'all' | OrderStatus; label: string }[] = [
    { id: 'all', label: isEn ? 'All Orders' : 'সকল অর্ডার' },
    { id: 'Pending', label: 'Pending' },
    { id: 'Processing', label: 'Processing' },
    { id: 'Completed', label: 'Completed' },
    { id: 'Cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isEn ? 'My Orders' : 'আমার অর্ডারসমূহ'}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {isEn
              ? 'Track live status and view Admin delivery notes for your orders.'
              : 'প্রতিটি অর্ডারের বর্তমান অবস্থা এবং অ্যাডমিন ডেলিভারি নোট এখান থেকে দেখুন।'}
          </p>
        </div>
      </div>

      {/* Status Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filterTabs.map((tab) => {
          const active = statusFilter === tab.id;
          const count =
            tab.id === 'all'
              ? userOrders.length
              : userOrders.filter((o) => o.status === tab.id).length;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}{' '}
              <span
                className={`font-mono-num ml-1 ${
                  active ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
          <ClipboardList className="w-9 h-9 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {isEn ? 'No orders found' : 'কোনো অর্ডার পাওয়া যায়নি'}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {isEn
              ? 'Place an order from our digital service catalog to get started.'
              : 'নতুন কোনো ডিজিটাল সেবা নিতে সেবাসমূহের তালিকা থেকে অর্ডার করুন।'}
          </p>
          <button
            type="button"
            onClick={onGoHome}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
          >
            {isEn ? 'Browse Services' : 'সেবাসমূহ দেখুন'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isExpanded = expandedId === order.id;
            return (
              <div
                key={order.id}
                className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
              >
                {/* Header Row */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : order.id)
                  }
                  className="w-full text-left p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono-num font-bold text-slate-900">
                        {order.id}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTimeBn(order.createdAt, language)}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {order.serviceTitle}
                    </h3>
                    {order.selectedOptionLabel && (
                      <p className="text-xs font-medium text-emerald-700">
                        {isEn ? 'Option:' : 'ধরন:'} {order.selectedOptionLabel}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="text-base font-bold font-mono-num text-slate-900 tabular-nums">
                      {formatBDT(order.totalPrice)}
                    </span>
                    <OrderStatusBadge status={order.status} />
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Admin Note Highlight */}
                {order.adminNote && (
                  <div className="mx-4 sm:mx-5 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <MessageSquareText className="w-4 h-4 text-emerald-700" />
                        {isEn
                          ? 'Admin Delivery Note / Reply'
                          : 'অ্যাডমিন ডেলিভারি নোট / উত্তর'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyNote(order)}
                        className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
                      >
                        {copiedOrderId === order.id ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Copied' : 'কপি হয়েছে'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Copy' : 'কপি'}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-emerald-950 leading-relaxed whitespace-pre-wrap">
                      {order.adminNote}
                    </p>
                  </div>
                )}

                {/* Expanded Submitted Form Details */}
                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-5 pt-3 border-t border-slate-100 bg-slate-50/60 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700">
                        {isEn ? 'Submitted Information' : 'জমাকৃত তথ্যসমূহ'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(order)}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>
                          {isEn ? 'Download Receipt' : 'রসিদ ডাউনলোড'}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {order.entries.map((entry, idx) => (
                        <div
                          key={`${entry.key}-${idx}`}
                          className="rounded-xl bg-white border border-slate-200 px-3.5 py-2.5"
                        >
                          {entry.sectionTitle && (
                            <span className="text-[11px] font-semibold text-emerald-700 block mb-0.5">
                              {entry.sectionTitle}
                            </span>
                          )}
                          <span className="text-xs text-slate-500 block">
                            {entry.label}
                          </span>
                          <p className="text-sm font-medium text-slate-900 mt-0.5 whitespace-pre-wrap break-words">
                            {entry.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {order.attachments.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-700 block">
                          {isEn ? 'Attached Screenshots' : 'সংযুক্ত স্ক্রিনশট'}
                        </span>
                        <div className="flex flex-wrap gap-3">
                          {order.attachments.map((att, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-slate-200 bg-white p-2 flex items-center gap-2.5"
                            >
                              <img
                                src={att.dataUrl}
                                alt={att.fileName}
                                className="w-14 h-14 rounded-lg object-cover border border-slate-100"
                              />
                              <div className="text-xs">
                                <p className="font-medium text-slate-900 max-w-[160px] truncate">
                                  {att.fileName}
                                </p>
                                <a
                                  href={att.dataUrl}
                                  download={att.fileName}
                                  className="text-emerald-700 font-semibold hover:underline mt-0.5 inline-block"
                                >
                                  {isEn ? 'Download' : 'ডাউনলোড করুন'}
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
  );
};
