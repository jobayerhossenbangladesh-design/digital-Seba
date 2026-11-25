import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileImage,
  LogIn,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLocalizedService } from '../data/i18n';
import { formatBDT } from '../data/seedData';
import {
  FormFieldSchema,
  OrderAttachment,
  OrderFieldEntry,
  ServiceItem,
} from '../types';
import { ServiceIcon } from './ServiceIcon';

interface ServiceOrderModalProps {
  service: ServiceItem | null;
  onClose: () => void;
  onGoToRecharge: () => void;
  onGoToOrders: () => void;
  onOpenAuth: () => void;
}

export const ServiceOrderModal: React.FC<ServiceOrderModalProps> = ({
  service,
  onClose,
  onGoToRecharge,
  onGoToOrders,
  onOpenAuth,
}) => {
  const { currentUser, state, language, placeOrder } = useApp();
  const isEn = language === 'en';
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<OrderAttachment[]>([]);
  const [error, setError] = useState('');
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!service) return;
    const defaults: Record<string, string> = {};
    if (service.isDynamic && service.options && service.options.length > 0) {
      defaults['priceOption'] = service.options[0].label;
    }
    service.fields.forEach((f) => {
      if (f.defaultValue !== undefined) {
        defaults[f.name] = f.defaultValue;
      } else if (f.type === 'select' && !f.isPriceDriver && f.options?.length) {
        defaults[f.name] = f.options[0];
      } else if (!f.isPriceDriver) {
        defaults[f.name] = '';
      }
    });
    setFormValues(defaults);
    setAttachments([]);
    setError('');
    setSuccessOrderId(null);
  }, [service]);

  const selectedOptionLabel = formValues['priceOption'] || '';

  const selectedOptionObj = useMemo(() => {
    if (!service || !service.isDynamic || !service.options?.length) return null;
    return (
      service.options.find((opt) => opt.label === selectedOptionLabel) ||
      service.options[0]
    );
  }, [service, selectedOptionLabel]);

  const currentPrice = selectedOptionObj
    ? selectedOptionObj.price
    : service?.basePrice || 0;

  const visibleFields = useMemo(() => {
    if (!service) return [];
    return service.fields.filter((field) => {
      const hasOptionIds =
        field.showWhenOptionIds && field.showWhenOptionIds.length > 0;
      const hasOptionLabels =
        field.showWhenOptions && field.showWhenOptions.length > 0;
      if (!hasOptionIds && !hasOptionLabels) {
        return true;
      }
      if (
        hasOptionIds &&
        selectedOptionObj &&
        field.showWhenOptionIds!.includes(selectedOptionObj.id)
      ) {
        return true;
      }
      if (hasOptionLabels && field.showWhenOptions!.includes(selectedOptionLabel)) {
        return true;
      }
      return false;
    });
  }, [service, selectedOptionLabel, selectedOptionObj]);

  const groupedSections = useMemo(() => {
    const groups: { title: string | null; fields: FormFieldSchema[] }[] = [];
    visibleFields.forEach((field) => {
      const secTitle = field.sectionTitle || null;
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.title !== secTitle) {
        groups.push({ title: secTitle, fields: [field] });
      } else {
        lastGroup.fields.push(field);
      }
    });
    return groups;
  }, [visibleFields]);

  if (!service) return null;

  const loc = getLocalizedService(service, language);
  const isInsufficient = currentUser
    ? currentUser.balance < currentPrice
    : false;
  const shortfall = currentUser
    ? Math.max(0, currentPrice - currentUser.balance)
    : 0;

  const handleFieldChange = (name: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (
    field: FormFieldSchema,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError(
        isEn
          ? 'File size must be under 3MB.'
          : 'ফাইলের সাইজ ৩ মেগাবাইটের কম হতে হবে।'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setAttachments((prev) => [
        ...prev.filter((a) => a.fieldName !== field.name),
        {
          fieldName: field.name,
          label: field.label,
          fileName: file.name,
          dataUrl,
        },
      ]);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (fieldName: string) => {
    setAttachments((prev) => prev.filter((a) => a.fieldName !== fieldName));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentUser) {
      onOpenAuth();
      return;
    }

    for (const field of visibleFields) {
      if (field.type === 'file') {
        if (
          field.required &&
          !attachments.some((a) => a.fieldName === field.name)
        ) {
          setError(
            isEn
              ? `Please attach "${field.label}".`
              : `অনুগ্রহ করে "${field.label}" যুক্ত করুন।`
          );
          return;
        }
        continue;
      }
      const val = (formValues[field.name] || '').trim();
      if (field.required && !val) {
        setError(
          isEn
            ? `Please fill in "${field.label}".`
            : `অনুগ্রহ করে "${field.label}" পূরণ করুন।`
        );
        return;
      }
    }

    const entries: OrderFieldEntry[] = visibleFields
      .filter((f) => f.type !== 'file')
      .map((f) => ({
        key: f.name,
        label: f.label,
        value:
          (formValues[f.name] || '').trim() ||
          (isEn ? 'Not provided' : 'প্রদান করা হয়নি'),
        sectionTitle: f.sectionTitle,
      }));

    const res = placeOrder({
      service,
      selectedOptionLabel: service.isDynamic ? selectedOptionLabel : undefined,
      totalPrice: currentPrice,
      entries,
      attachments,
    });

    if (!res.ok) {
      setError(res.message);
      return;
    }

    setSuccessOrderId(res.orderId || 'ORD');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-white shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 overflow-hidden ${
                service.customIconUrl
                  ? 'bg-white border border-slate-200 p-0.5'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <ServiceIcon
                name={service.iconName}
                customIconUrl={service.customIconUrl}
                className="w-5 h-5"
              />
            </div>
            <div className="min-w-0">
              <h2
                id="order-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 leading-snug"
              >
                {loc.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
                {loc.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close' : 'বন্ধ করুন'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {successOrderId ? (
          <div className="p-6 sm:p-8 text-center space-y-5 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-slate-900">
                {isEn
                  ? 'Order Placed Successfully!'
                  : 'অর্ডার সফলভাবে গৃহীত হয়েছে!'}
              </h3>
              <p className="text-sm text-slate-600">
                {isEn ? 'Order ID:' : 'আপনার অর্ডার আইডি:'}{' '}
                <span className="font-mono-num font-bold text-slate-900">
                  {successOrderId}
                </span>
              </p>
              <p className="text-sm text-slate-600">
                {isEn ? 'Paid from wallet:' : 'ওয়ালেট থেকে'}{' '}
                <span className="font-mono-num font-semibold text-emerald-700">
                  {formatBDT(currentPrice)}
                </span>{' '}
                {isEn ? '' : 'সফলভাবে পরিশোধ হয়েছে।'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToOrders();
                }}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
              >
                {isEn ? 'View My Orders' : 'আমার অর্ডার দেখুন'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium transition-colors"
              >
                {isEn ? 'Back to Home' : 'হোমে ফিরে যান'}
              </button>
            </div>
          </div>
        ) : (
          /* Order Form Body */
          <form
            onSubmit={handleSubmit}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {/* Live Price & Wallet Bar */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-slate-500 block">
                    {isEn ? 'Selected Service Fee' : 'নির্বাচিত সার্ভিস ফি'}
                  </span>
                  <span className="text-2xl font-bold font-mono-num text-emerald-700 tabular-nums">
                    {formatBDT(currentPrice)}
                  </span>
                </div>

                {currentUser ? (
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">
                      {isEn ? 'Your Wallet Balance' : 'আপনার ওয়ালেট ব্যালেন্স'}
                    </span>
                    <span
                      className={`text-base font-bold font-mono-num tabular-nums ${
                        isInsufficient ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {formatBDT(currentUser.balance)}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Login' : 'লগইন করুন'}</span>
                  </button>
                )}
              </div>

              {/* Insufficient Balance Warning */}
              {currentUser && isInsufficient && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-rose-900">
                      <p className="font-bold">
                        {isEn ? 'Insufficient Balance!' : 'অপর্যাপ্ত ব্যালেন্স!'}
                      </p>
                      <p className="text-xs text-rose-800 mt-0.5">
                        {isEn ? 'You need' : 'এই অর্ডারটি করতে আরও'}{' '}
                        <span className="font-mono-num font-bold">
                          {formatBDT(shortfall)}
                        </span>{' '}
                        {isEn
                          ? 'more. Please recharge your wallet.'
                          : 'প্রয়োজন। অনুগ্রহ করে ওয়ালেট রিচার্জ করুন।'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGoToRecharge();
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>
                      {isEn ? 'Recharge Wallet' : 'ওয়ালেট রিচার্জ করুন'}
                    </span>
                  </button>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm text-rose-800">
                  {error}
                </div>
              )}

              {/* Dynamic Grouped Form Fields */}
              <div className="space-y-6">
                {groupedSections.map((group, idx) => (
                  <div
                    key={`${group.title || 'general'}-${idx}`}
                    className={
                      group.title
                        ? 'pt-4 border-t border-slate-200 space-y-4'
                        : 'space-y-4'
                    }
                  >
                    {group.title && (
                      <h3 className="text-sm font-bold text-slate-900">
                        {group.title}
                      </h3>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {group.fields.map((field) => {
                        const colClass =
                          field.colSpan === 'half'
                            ? 'sm:col-span-1'
                            : 'sm:col-span-2';
                        const val = formValues[field.name] ?? '';

                        if (field.type === 'select') {
                          const opts = field.isPriceDriver
                            ? service.options || []
                            : (field.options || []).map((o) => ({
                                id: o,
                                label: o,
                                price: null as number | null,
                              }));

                          return (
                            <div key={field.name} className={colClass}>
                              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                {field.label}
                                {field.required && (
                                  <span className="text-rose-600 ml-1">*</span>
                                )}
                              </label>
                              <select
                                value={val}
                                required={field.required}
                                onChange={(e) =>
                                  handleFieldChange(field.name, e.target.value)
                                }
                                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                              >
                                {opts.map((opt) => (
                                  <option key={opt.id} value={opt.label}>
                                    {opt.price !== null
                                      ? `${opt.label} — ${formatBDT(opt.price)}`
                                      : opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        }

                        if (field.type === 'textarea') {
                          return (
                            <div key={field.name} className={colClass}>
                              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                {field.label}
                                {field.required && (
                                  <span className="text-rose-600 ml-1">*</span>
                                )}
                              </label>
                              <textarea
                                rows={4}
                                value={val}
                                required={field.required}
                                placeholder={field.placeholder}
                                onChange={(e) =>
                                  handleFieldChange(field.name, e.target.value)
                                }
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                              />
                            </div>
                          );
                        }

                        if (field.type === 'file') {
                          const existing = attachments.find(
                            (a) => a.fieldName === field.name
                          );
                          return (
                            <div key={field.name} className={colClass}>
                              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                {field.label}
                                {field.required && (
                                  <span className="text-rose-600 ml-1">*</span>
                                )}
                              </label>

                              {existing ? (
                                <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 bg-slate-50">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <img
                                      src={existing.dataUrl}
                                      alt={existing.fileName}
                                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-slate-900 truncate">
                                        {existing.fileName}
                                      </p>
                                      <p className="text-xs text-emerald-700">
                                        {isEn
                                          ? 'Screenshot attached'
                                          : 'স্ক্রিনশট যুক্ত হয়েছে'}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeAttachment(field.name)}
                                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"
                                    aria-label={isEn ? 'Remove' : 'ছবি মুছুন'}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <label className="flex items-center justify-center gap-2.5 min-h-[56px] px-4 py-3 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer transition-colors">
                                  <Upload className="w-4 h-4 text-slate-500" />
                                  <span className="text-sm text-slate-600">
                                    {isEn
                                      ? 'Click to upload screenshot (JPG/PNG)'
                                      : 'স্ক্রিনশট আপলোড করতে ক্লিক করুন (JPG/PNG)'}
                                  </span>
                                  <FileImage className="w-4 h-4 text-slate-400" />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(field, e)}
                                  />
                                </label>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div key={field.name} className={colClass}>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              {field.label}
                              {field.required && (
                                <span className="text-rose-600 ml-1">*</span>
                              )}
                            </label>
                            <input
                              type={field.type}
                              value={val}
                              required={field.required}
                              placeholder={field.placeholder}
                              onChange={(e) =>
                                handleFieldChange(field.name, e.target.value)
                              }
                              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mandatory Disclaimer Box for Service 18 */}
              {service.hasDisclaimer && (
                <div className="rounded-xl bg-amber-50 border border-rose-300 p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm font-medium text-rose-900 leading-relaxed">
                    সঠিক তথ্য দিয়ে সহযোগিতা করুন। আপনার তথ্য ভুল প্রদান করলে সে দায়ভার আপনার। পুনরায় সংশোধন গ্রহণযোগ্য নয়। জন্মনিবন্ধন সংশ্লিষ্ট সকল ডকুমেন্ট এডমিনের হোয়াটস অ্যাপে (
                    <span className="font-mono-num font-bold">
                      {state.settings.adminWhatsapp}
                    </span>
                    ) অবশ্যই প্রদান করবেন।
                  </p>
                </div>
              )}
            </div>

            {/* Sticky Modal Footer */}
            <div className="px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-xs text-slate-500 block">
                  {isEn ? 'Total Payable' : 'মোট প্রদেয়'}
                </span>
                <span className="text-lg font-bold font-mono-num text-slate-900 tabular-nums">
                  {formatBDT(currentPrice)}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors"
                >
                  {isEn ? 'Cancel' : 'বাতিল'}
                </button>
                {currentUser ? (
                  <button
                    type="submit"
                    disabled={isInsufficient}
                    className={`min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                      isInsufficient
                        ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isEn ? 'Confirm Order' : 'অর্ডার কনফার্ম করুন'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    {isEn ? 'Login to Order' : 'লগইন করে অর্ডার করুন'}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
