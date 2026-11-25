import React, { useEffect, useState } from 'react';
import { ImagePlus, Plus, Save, Trash2, X } from 'lucide-react';
import { CATEGORY_LABELS_I18N } from '../data/i18n';
import {
  FieldType,
  FormFieldSchema,
  ServiceCategory,
  ServiceItem,
  ServicePriceOption,
} from '../types';
import { SERVICE_ICON_OPTIONS, ServiceIcon } from './ServiceIcon';

interface AdminServiceEditModalProps {
  isOpen: boolean;
  service: ServiceItem | null; // null = Create mode, ServiceItem = Edit mode
  onClose: () => void;
  onSaveEdit: (updated: ServiceItem) => void;
  onCreateNew: (payload: Omit<ServiceItem, 'id' | 'orderNumber'>) => void;
}

const DEFAULT_ICON_BY_CAT: Record<Exclude<ServiceCategory, 'all'>, string> = {
  social: 'Facebook',
  nid_govt: 'FileCheck2',
  mfs: 'WalletCards',
  mobile_sim: 'Smartphone',
  passport_birth: 'ScrollText',
};

export const AdminServiceEditModal: React.FC<AdminServiceEditModalProps> = ({
  isOpen,
  service,
  onClose,
  onSaveEdit,
  onCreateNew,
}) => {
  const isCreateMode = service === null;

  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [category, setCategory] =
    useState<Exclude<ServiceCategory, 'all'>>('nid_govt');
  const [badgeTag, setBadgeTag] = useState<'' | 'জনপ্রিয়' | 'দ্রুত সেবা'>('');
  const [isDynamic, setIsDynamic] = useState(false);
  const [basePrice, setBasePrice] = useState<number>(500);
  const [active, setActive] = useState(true);
  const [iconName, setIconName] = useState('FileCheck2');
  const [customIconUrl, setCustomIconUrl] = useState('');
  const [options, setOptions] = useState<ServicePriceOption[]>([]);
  const [customFields, setCustomFields] = useState<FormFieldSchema[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (service) {
      setTitle(service.title);
      setTitleEn(service.titleEn || '');
      setDescription(service.description);
      setDescriptionEn(service.descriptionEn || '');
      setCategory(service.category);
      setBadgeTag(service.badgeTag || '');
      setIsDynamic(service.isDynamic);
      setBasePrice(service.basePrice);
      setActive(service.active);
      setIconName(service.iconName || DEFAULT_ICON_BY_CAT[service.category]);
      setCustomIconUrl(service.customIconUrl || '');
      setOptions(service.options ? service.options.map((o) => ({ ...o })) : []);
      setCustomFields(service.fields.map((f) => ({ ...f })));
    } else {
      setTitle('');
      setTitleEn('');
      setDescription('');
      setDescriptionEn('');
      setCategory('nid_govt');
      setBadgeTag('');
      setIsDynamic(false);
      setBasePrice(300);
      setActive(true);
      setIconName(DEFAULT_ICON_BY_CAT.nid_govt);
      setCustomIconUrl('');
      setOptions([
        { id: `opt-${Date.now()}-1`, label: 'সাধারণ সেবা', price: 300 },
        { id: `opt-${Date.now()}-2`, label: 'জরুরি সেবা', price: 500 },
      ]);
      setCustomFields([
        {
          name: 'customer_input_1',
          label: 'প্রয়োজনীয় তথ্য / নম্বর লিখুন',
          type: 'text',
          placeholder: 'এখানে লিখুন...',
          required: true,
          colSpan: 'full',
        },
        {
          name: 'customer_details',
          label: 'বিস্তারিত বিবরণ (ঐচ্ছিক)',
          type: 'textarea',
          placeholder: 'অতিরিক্ত কোনো নির্দেশনা থাকলে লিখুন...',
          required: false,
          colSpan: 'full',
        },
      ]);
    }
  }, [isOpen, service]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;

      if (file.type === 'image/svg+xml') {
        setCustomIconUrl(result);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxSide = 192;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setCustomIconUrl(canvas.toDataURL('image/png'));
        } else {
          setCustomIconUrl(result);
        }
      };
      img.onerror = () => setCustomIconUrl(result);
      img.src = result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  const handleOptionChange = (
    idx: number,
    field: 'label' | 'price',
    value: string
  ) => {
    setOptions((prev) =>
      prev.map((opt, i) => {
        if (i !== idx) return opt;
        if (field === 'price') {
          return { ...opt, price: Math.max(0, Number(value) || 0) };
        }
        return { ...opt, label: value };
      })
    );
  };

  const handleAddOption = () => {
    setOptions((prev) => [
      ...prev,
      {
        id: `opt-${Date.now()}`,
        label: `নতুন অপশন ${prev.length + 1}`,
        price: 500,
      },
    ]);
  };

  const handleRemoveOption = (idx: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddField = () => {
    setCustomFields((prev) => [
      ...prev,
      {
        name: `field_${Date.now()}_${prev.length}`,
        label: 'নতুন তথ্য ফিল্ড',
        type: 'text',
        placeholder: 'তথ্য লিখুন...',
        required: true,
        colSpan: 'full',
      },
    ]);
  };

  const handleFieldChange = (
    idx: number,
    patch: Partial<FormFieldSchema>
  ) => {
    setCustomFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    );
  };

  const handleRemoveField = (idx: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOptions = isDynamic
      ? options.filter((o) => o.label.trim())
      : undefined;
    const computedBasePrice =
      isDynamic && cleanedOptions && cleanedOptions.length > 0
        ? Math.min(...cleanedOptions.map((o) => o.price))
        : Math.max(0, Number(basePrice) || 0);

    // Build final fields: for newly created dynamic services, ensure priceOption select is at top
    let finalFields = customFields;
    if (isCreateMode) {
      const nonPriceFields = customFields.filter((f) => !f.isPriceDriver);
      finalFields = isDynamic
        ? [
            {
              name: 'priceOption',
              label: 'সেবার ধরন নির্বাচন করুন',
              type: 'select',
              required: true,
              isPriceDriver: true,
              colSpan: 'full',
            },
            ...nonPriceFields,
          ]
        : nonPriceFields;
    }

    if (service) {
      const updated: ServiceItem = {
        ...service,
        title: title.trim() || service.title,
        titleEn: titleEn.trim() || undefined,
        description: description.trim() || service.description,
        descriptionEn: descriptionEn.trim() || undefined,
        category,
        badgeTag: badgeTag || undefined,
        isDynamic,
        basePrice: computedBasePrice,
        active,
        iconName: iconName || service.iconName,
        customIconUrl: customIconUrl.trim() || undefined,
        options: cleanedOptions,
        fields: service.id.startsWith('srv-custom-')
          ? finalFields
          : service.fields,
      };
      onSaveEdit(updated);
    } else {
      onCreateNew({
        title: title.trim(),
        titleEn: titleEn.trim() || undefined,
        description: description.trim(),
        descriptionEn: descriptionEn.trim() || undefined,
        category,
        basePrice: computedBasePrice,
        isDynamic,
        options: cleanedOptions,
        active,
        iconName: iconName || DEFAULT_ICON_BY_CAT[category],
        customIconUrl: customIconUrl.trim() || undefined,
        badgeTag: badgeTag || undefined,
        fields: finalFields,
      });
    }
  };

  const categoryChoices: Exclude<ServiceCategory, 'all'>[] = [
    'social',
    'nid_govt',
    'mfs',
    'mobile_sim',
    'passport_birth',
  ];

  const isCustomOrNew = isCreateMode || service?.id.startsWith('srv-custom-');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            {isCreateMode
              ? 'নতুন ডিজিটাল সেবা যোগ করুন'
              : `সেবা সম্পাদনা করুন (#${String(service.orderNumber).padStart(
                  2,
                  '0'
                )})`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  সেবার শিরোনাম (বাংলায়) *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: পুলিশ ক্লিয়ারেন্স সহায়তা"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Service Title (English — Optional)
                </label>
                <input
                  type="text"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="e.g. Police Clearance Support"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  সেবার বিবরণ (বাংলায়) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="সেবার সংক্ষিপ্ত ও স্পষ্ট বিবরণ লিখুন..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description (English — Optional)
                </label>
                <textarea
                  rows={2}
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  placeholder="Short English description..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  ক্যাটাগরি
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value as Exclude<ServiceCategory, 'all'>
                    )
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {categoryChoices.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS_I18N.bn[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  হাইলাইট ট্যাগ (Badge)
                </label>
                <select
                  value={badgeTag}
                  onChange={(e) =>
                    setBadgeTag(
                      e.target.value as '' | 'জনপ্রিয়' | 'দ্রুত সেবা'
                    )
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="">সাধারণ (কোনো ট্যাগ নেই)</option>
                  <option value="জনপ্রিয়">জনপ্রিয় (Popular)</option>
                  <option value="দ্রুত সেবা">দ্রুত সেবা (Fast Service)</option>
                </select>
              </div>
            </div>

            {/* Service Icon / Custom Logo Editor */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                      customIconUrl.trim()
                        ? 'bg-white border border-slate-200 p-0.5 shadow-xs'
                        : 'bg-emerald-600 text-white shadow-sm'
                    }`}
                  >
                    <ServiceIcon
                      name={iconName}
                      customIconUrl={customIconUrl.trim() || undefined}
                      className="w-6 h-6"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900">
                      সার্ভিস আইকন বা লোগো পরিবর্তন করুন
                    </label>
                    <p className="text-xs text-slate-500">
                      কাস্টম লোগো আপলোড করুন অথবা নিচ থেকে আইকন বেছে নিন
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
                    <ImagePlus className="w-4 h-4 shrink-0" />
                    <span>লোগো আপলোড</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                  </label>
                  {customIconUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => setCustomIconUrl('')}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold"
                    >
                      রিসেট
                    </button>
                  )}
                </div>
              </div>

              <div>
                <input
                  type="url"
                  value={customIconUrl.startsWith('data:') ? '' : customIconUrl}
                  onChange={(e) => setCustomIconUrl(e.target.value)}
                  placeholder="অথবা লোগো ইমেজ লিংক (URL) পেস্ট করুন (ঐচ্ছিক)..."
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {SERVICE_ICON_OPTIONS.map((opt) => {
                  const selected = !customIconUrl.trim() && iconName === opt.name;
                  return (
                    <button
                      key={opt.name}
                      type="button"
                      title={opt.label}
                      onClick={() => {
                        setIconName(opt.name);
                        setCustomIconUrl('');
                      }}
                      className={`min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center border transition-colors shrink-0 ${
                        selected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ServiceIcon name={opt.name} className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pricing Mode Switch (available on new services or existing) */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-bold text-slate-900">
                  মূল্য নির্ধারণের ধরন
                </label>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setIsDynamic(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      !isDynamic
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    নির্দিষ্ট মূল্য
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDynamic(true);
                      if (options.length === 0) {
                        setOptions([
                          {
                            id: `opt-${Date.now()}-1`,
                            label: 'স্ট্যান্ডার্ড',
                            price: basePrice || 500,
                          },
                        ]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      isDynamic
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    ডাইনামিক অপশন
                  </button>
                </div>
              </div>

              {!isDynamic ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    সার্ভিস মূল্য (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">
                      সাব-অপশন ও মূল্য তালিকা
                    </span>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>অপশন যোগ করুন</span>
                    </button>
                  </div>
                  {options.map((opt, idx) => (
                    <div
                      key={opt.id}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <input
                        type="text"
                        required
                        value={opt.label}
                        onChange={(e) =>
                          handleOptionChange(idx, 'label', e.target.value)
                        }
                        placeholder="অপশনের নাম"
                        className="col-span-7 min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <div className="col-span-4 relative">
                        <input
                          type="number"
                          min={0}
                          required
                          value={opt.price}
                          onChange={(e) =>
                            handleOptionChange(idx, 'price', e.target.value)
                          }
                          className="w-full min-h-[40px] pl-3 pr-7 py-2 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                          ৳
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        disabled={options.length <= 1}
                        className="col-span-1 min-h-[38px] flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                        aria-label="অপশন মুছুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Form Fields Builder (for New / Custom Services) */}
            {isCustomOrNew && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-900">
                    অর্ডার ফর্মের ফিল্ডসমূহ
                  </label>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ফিল্ড যোগ করুন</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {customFields
                    .filter((f) => !f.isPriceDriver)
                    .map((f, idx) => (
                      <div
                        key={f.name}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-12 gap-2 items-center"
                      >
                        <input
                          type="text"
                          required
                          value={f.label}
                          onChange={(e) =>
                            handleFieldChange(idx, { label: e.target.value })
                          }
                          placeholder="ফিল্ডের নাম (যেমন: মোবাইল নম্বর)"
                          className="col-span-6 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <select
                          value={f.type}
                          onChange={(e) =>
                            handleFieldChange(idx, {
                              type: e.target.value as FieldType,
                            })
                          }
                          className="col-span-3 min-h-[38px] px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                        >
                          <option value="text">Text</option>
                          <option value="tel">Phone / Tel</option>
                          <option value="url">Link / URL</option>
                          <option value="textarea">Textarea</option>
                          <option value="file">Screenshot</option>
                        </select>
                        <label className="col-span-2 flex items-center gap-1 text-[11px] font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!f.required}
                            onChange={(e) =>
                              handleFieldChange(idx, {
                                required: e.target.checked,
                              })
                            }
                            className="rounded border-slate-300 text-emerald-600"
                          />
                          <span>আবশ্যিক</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(idx)}
                          className="col-span-1 min-h-[34px] flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-100"
                          aria-label="ফিল্ড মুছুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-sm font-medium text-slate-700">
                সেবাটি চালু (Active) রাখুন
              </span>
              <button
                type="button"
                onClick={() => setActive((prev) => !prev)}
                className={`min-h-[36px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {active ? 'সক্রিয় (Active)' : 'নিষ্ক্রিয় (Inactive)'}
              </button>
            </div>
          </div>

          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              বাতিল
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>
                {isCreateMode ? 'নতুন সেবা তৈরি করুন' : 'সংরক্ষণ করুন'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
