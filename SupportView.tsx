import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Headphones,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { INITIAL_APP_STATE } from '../data/seedData';

export const SupportView: React.FC = () => {
  const { state, language } = useApp();
  const isEn = language === 'en';
  const waUrl = 'https://wa.me/8801868132145';
  const [openFaqId, setOpenFaqId] = useState<string | null>(
    state.settings.faqs?.[0]?.id || 'faq-1'
  );

  const rawGuidelines = isEn
    ? state.settings.serviceGuidelinesEn ||
      state.settings.serviceGuidelines ||
      INITIAL_APP_STATE.settings.serviceGuidelinesEn ||
      ''
    : state.settings.serviceGuidelines ||
      INITIAL_APP_STATE.settings.serviceGuidelines ||
      '';

  const guidelineLines = rawGuidelines
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const faqItems =
    state.settings.faqs && state.settings.faqs.length > 0
      ? state.settings.faqs
      : INITIAL_APP_STATE.settings.faqs || [];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Redesigned Sleek Dark Admin Support & WhatsApp Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white p-5 sm:p-6 border border-emerald-500/30 ring-1 ring-emerald-400/15 shadow-xl shadow-emerald-950/15">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-12 w-36 h-36 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/40 ring-1 ring-white/20">
              <Headphones className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                {isEn ? 'Admin Support' : 'এডমিন সাপোর্ট'}
              </h1>
              <p className="text-xs text-emerald-300/90 font-medium mt-0.5">
                {isEn
                  ? 'Instant WhatsApp Assistance · 24/7'
                  : 'সরাসরি হোয়াটসঅ্যাপ সহায়তা · ২৪/৭'}
              </p>
            </div>
          </div>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm inline-flex items-center justify-center gap-2.5 transition-all shrink-0 whitespace-nowrap shadow-lg shadow-emerald-950/40 ring-1 ring-white/15 active:scale-[0.99]"
          >
            <span className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4" />
            </span>
            <span>{isEn ? 'WhatsApp Support' : 'হোয়াটসঅ্যাপ সাপোর্ট'}</span>
            <ExternalLink className="w-4 h-4 shrink-0 opacity-90" />
          </a>
        </div>
      </div>

      {/* Service Time, Policies & Guidelines */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {isEn ? 'Service Hours & Guidelines' : 'সেবার সময় ও নিয়মাবলি'}
          </h2>
        </div>

        <ul className="space-y-2.5">
          {guidelineLines.map((line, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed bg-slate-50/80 border border-slate-100 rounded-xl px-3.5 py-2.5"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Collapsible FAQs */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <HelpCircle className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {isEn
              ? 'Frequently Asked Questions'
              : 'সচরাচর জিজ্ঞাসিত প্রশ্নাবলি'}
          </h2>
        </div>

        <div className="space-y-2.5">
          {faqItems.map((faq) => {
            const isOpen = openFaqId === faq.id;
            const question = isEn ? faq.qEn || faq.q : faq.q;
            const answer = isEn ? faq.aEn || faq.a : faq.a;

            return (
              <div
                key={faq.id}
                className={`rounded-xl border transition-colors ${
                  isOpen
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                  className="w-full px-4 py-3 text-left flex items-center justify-between gap-3"
                >
                  <span className="text-sm font-bold text-slate-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{question}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 text-emerald-700' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-3.5 pl-10 text-sm text-slate-600 leading-relaxed">
                    {answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
