import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  LogIn,
  RotateCcw,
  Send,
  Wallet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatBDT, formatDateTimeBn } from '../data/seedData';
import { RechargeMethod } from '../types';
import { RechargeStatusBadge } from './StatusBadge';

interface WalletViewProps {
  onOpenAuth: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ onOpenAuth }) => {
  const { currentUser, state, language, submitRecharge } = useApp();
  const isEn = language === 'en';
  const [method, setMethod] = useState<RechargeMethod>('bKash');
  const [amount, setAmount] = useState('');
  const [senderNumber, setSenderNumber] = useState(
    currentUser?.mobile || ''
  );
  const [trxId, setTrxId] = useState('');
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [historyTab, setHistoryTab] = useState<'recharges' | 'ledger'>(
    'recharges'
  );

  const rechargeNumber = state.settings.rechargeNumber;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rechargeNumber);
    } catch {
      // ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const numAmount = Number(amount);
    const res = submitRecharge({
      method,
      amount: numAmount,
      senderNumber,
      trxId,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.message });
      return;
    }
    setFeedback({ type: 'success', text: res.message });
    setAmount('');
    setTrxId('');
  };

  if (!currentUser) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center max-w-xl mx-auto">
        <Wallet className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {isEn
            ? 'Sign in to access Wallet & Recharge'
            : 'ওয়ালেট ও রিচার্জ ব্যবহার করতে লগইন করুন'}
        </h2>
        <p className="text-sm text-slate-600 mb-5">
          {isEn
            ? 'Check your balance, request bKash/Nagad top-ups, and track transactions.'
            : 'আপনার বর্তমান ব্যালেন্স দেখতে, টাকা যোগ করতে এবং সকল লেনদেনের হিসাব রাখতে অ্যাকাউন্টে লগইন করুন।'}
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-2"
        >
          <LogIn className="w-4 h-4" />
          <span>{isEn ? 'Login / Register' : 'লগইন / রেজিস্ট্রেশন'}</span>
        </button>
      </div>
    );
  }

  const userRecharges = state.recharges.filter(
    (r) => r.userId === currentUser.id
  );
  const userTransactions = state.transactions.filter(
    (t) => t.userId === currentUser.id
  );

  const totalDeposited = userTransactions
    .filter((t) => t.type === 'credit')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalSpent = userTransactions
    .filter((t) => t.type === 'debit')
    .reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Top Wallet Balance & Volume Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-900 text-white p-5">
          <span className="text-xs text-slate-400 block mb-1">
            {isEn ? 'Current Wallet Balance' : 'বর্তমান ওয়ালেট ব্যালেন্স'}
          </span>
          <div className="text-3xl font-bold font-mono-num text-emerald-400 tabular-nums">
            {formatBDT(currentUser.balance)}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {isEn ? 'Account:' : 'অ্যাকাউন্ট:'} {currentUser.name} ·{' '}
            <span className="font-mono-num">{currentUser.mobile}</span>
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col justify-between">
          <span className="text-xs text-slate-500">
            {isEn ? 'Total Approved Deposits' : 'মোট অনুমোদিত রিচার্জ'}
          </span>
          <div className="text-2xl font-bold font-mono-num text-slate-900 tabular-nums mt-1">
            {formatBDT(totalDeposited)}
          </div>
          <span className="text-xs text-emerald-700 mt-2">
            {isEn ? 'Total Cash In' : 'সর্বমোট ক্যাশ ইন'}
          </span>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col justify-between">
          <span className="text-xs text-slate-500">
            {isEn ? 'Total Order Spend' : 'মোট অর্ডার খরচ'}
          </span>
          <div className="text-2xl font-bold font-mono-num text-slate-900 tabular-nums mt-1">
            {formatBDT(totalSpent)}
          </div>
          <span className="text-xs text-slate-500 mt-2">
            {isEn ? 'Spent on Services' : 'সেবা গ্রহণে ব্যয়িত'}
          </span>
        </div>
      </div>

      {/* Main Grid: Payment Instructions + Form | History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEn ? 'Wallet Recharge / Add Money' : 'ওয়ালেট রিচার্জ / টাকা যোগ করুন'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {isEn
                ? 'Send Money to the Personal number below and submit your TrxID.'
                : 'নিচের পার্সোনাল নম্বরে Send Money করে ট্রানজেকশন আইডি দিয়ে ফর্মটি জমা দিন।'}
            </p>
          </div>

          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-emerald-900">
                bKash / Nagad (Personal · Send Money)
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 bg-white rounded-xl px-3.5 py-2.5 border border-emerald-200">
              <span className="text-lg sm:text-xl font-bold font-mono-num text-slate-900 tracking-wide select-all">
                {rechargeNumber}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Copied' : 'কপি হয়েছে'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Copy Number' : 'নম্বর কপি করুন'}</span>
                  </>
                )}
              </button>
            </div>

            <ol className="text-xs text-emerald-900 space-y-1 list-decimal list-inside">
              {isEn ? (
                <>
                  <li>Open bKash or Nagad app and select "Send Money".</li>
                  <li>Send your desired amount to the Personal number above.</li>
                  <li>Submit the Sender Number & Transaction ID (TrxID) below.</li>
                </>
              ) : (
                <>
                  <li>বিকাশ বা নগদ অ্যাপ থেকে "Send Money" সিলেক্ট করুন।</li>
                  <li>উপরের নম্বরে আপনার কাঙ্ক্ষিত টাকা পাঠান।</li>
                  <li>সফল হলে প্রাপ্ত Transaction ID (TrxID) নিচে সাবমিট করুন।</li>
                </>
              )}
            </ol>
          </div>

          {feedback && (
            <div
              className={`rounded-xl p-3.5 text-sm border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {isEn ? 'Payment Method' : 'পেমেন্ট মাধ্যম নির্বাচন করুন'}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(['bKash', 'Nagad'] as RechargeMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold border transition-colors ${
                      method === m
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {m === 'bKash'
                      ? isEn
                        ? 'bKash'
                        : 'বিকাশ (bKash)'
                      : isEn
                      ? 'Nagad'
                      : 'নগদ (Nagad)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {isEn ? 'Amount (৳ BDT)' : 'টাকার পরিমাণ (৳)'}
              </label>
              <input
                type="number"
                min={10}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={isEn ? 'e.g. 500 or 1000' : 'যেমন: 500 বা 1000'}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {isEn
                  ? 'Sender Number'
                  : 'যে নম্বর থেকে টাকা পাঠিয়েছেন (Sender Number)'}
              </label>
              <input
                type="tel"
                required
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {isEn ? 'Transaction ID (TrxID)' : 'ট্রানজেকশন আইডি (TrxID)'}
              </label>
              <input
                type="text"
                required
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                placeholder={isEn ? 'e.g. BKS9X4M291' : 'যেমন: BKS9X4M291'}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono-num uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>
                {isEn
                  ? 'Submit Recharge Request'
                  : 'রিচার্জ রিকোয়েস্ট জমা দিন'}
              </span>
            </button>
          </form>
        </div>

        {/* Right: Recharge History & Transaction Ledger */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900">
              {isEn
                ? 'Recharge & Transaction History'
                : 'রিচার্জ ও লেনদেনের ইতিহাস'}
            </h3>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setHistoryTab('recharges')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  historyTab === 'recharges'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isEn ? 'Recharges' : 'রিচার্জ রিকোয়েস্ট'} ({userRecharges.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('ledger')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  historyTab === 'ledger'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isEn ? 'Wallet Ledger' : 'ওয়ালেট লেজার'} ({userTransactions.length})
              </button>
            </div>
          </div>

          {historyTab === 'recharges' ? (
            userRecharges.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                {isEn
                  ? 'No recharge requests submitted yet.'
                  : 'এখনো কোনো রিচার্জ রিকোয়েস্ট জমা দেওয়া হয়নি।'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {userRecharges.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {req.method === 'bKash'
                            ? isEn
                              ? 'bKash'
                              : 'বিকাশ'
                            : isEn
                            ? 'Nagad'
                            : 'নগদ'}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-mono-num text-slate-600">
                          TrxID: {req.trxId}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-mono-num text-slate-500">
                          {req.senderNumber}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatDateTimeBn(req.createdAt, language)}
                        {req.adminNote ? ` · ${req.adminNote}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span className="text-base font-bold font-mono-num text-slate-900 tabular-nums">
                        +{formatBDT(req.amount)}
                      </span>
                      <RechargeStatusBadge status={req.status} />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : userTransactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {isEn ? 'No transactions yet.' : 'কোনো লেনদেনের তথ্য পাওয়া যায়নি।'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {userTransactions.map((txn) => {
                const isCredit =
                  txn.type === 'credit' || txn.type === 'refund';
                return (
                  <div
                    key={txn.id}
                    className="p-4 sm:px-5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          txn.type === 'refund'
                            ? 'bg-sky-50 text-sky-600'
                            : isCredit
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {txn.type === 'refund' ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : isCredit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {txn.description}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatDateTimeBn(txn.createdAt, language)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-sm sm:text-base font-bold font-mono-num tabular-nums shrink-0 ${
                        isCredit ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {formatBDT(txn.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
