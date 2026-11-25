import React from 'react';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { OrderStatus, RechargeStatus } from '../types';

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({
  status,
}) => {
  const { language } = useApp();
  const isEn = language === 'en';

  switch (status) {
    case 'Pending':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{isEn ? 'Pending' : 'Pending · অপেক্ষমান'}</span>
        </span>
      );
    case 'Processing':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 whitespace-nowrap">
          <Loader2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span>{isEn ? 'Processing' : 'Processing · চলমান'}</span>
        </span>
      );
    case 'Completed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{isEn ? 'Completed' : 'Completed · সম্পন্ন'}</span>
        </span>
      );
    case 'Cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>{isEn ? 'Cancelled' : 'Cancelled · বাতিল'}</span>
        </span>
      );
  }
};

export const RechargeStatusBadge: React.FC<{ status: RechargeStatus }> = ({
  status,
}) => {
  const { language } = useApp();
  const isEn = language === 'en';

  switch (status) {
    case 'Pending':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{isEn ? 'Pending' : 'Pending · যাচাই চলছে'}</span>
        </span>
      );
    case 'Approved':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{isEn ? 'Approved' : 'Approved · অনুমোদিত'}</span>
        </span>
      );
    case 'Rejected':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>{isEn ? 'Rejected' : 'Rejected · বাতিল'}</span>
        </span>
      );
  }
};
