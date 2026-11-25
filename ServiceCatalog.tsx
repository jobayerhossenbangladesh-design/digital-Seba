import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Flame,
  Search,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  CATEGORY_LABELS_I18N,
  getLocalizedService,
  SERVICE_EN_MAP,
} from '../data/i18n';
import { formatBDT } from '../data/seedData';
import { ServiceCategory, ServiceItem } from '../types';
import { ServiceIcon } from './ServiceIcon';

interface ServiceCatalogProps {
  services: ServiceItem[];
  onSelectService: (service: ServiceItem) => void;
}

const CATEGORY_GRADIENTS: Record<Exclude<ServiceCategory, 'all'>, string> = {
  social: 'from-blue-600 to-indigo-600 shadow-blue-600/20',
  nid_govt: 'from-emerald-600 to-teal-700 shadow-emerald-600/20',
  mfs: 'from-rose-600 to-pink-600 shadow-rose-600/20',
  mobile_sim: 'from-violet-600 to-purple-700 shadow-violet-600/20',
  passport_birth: 'from-amber-600 to-orange-600 shadow-amber-600/20',
};

export const ServiceCatalog: React.FC<ServiceCatalogProps> = ({
  services,
  onSelectService,
}) => {
  const { language } = useApp();
  const isEn = language === 'en';
  const categoryLabels = CATEGORY_LABELS_I18N[language];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<ServiceCategory>('all');

  const activeServices = useMemo(
    () => services.filter((s) => s.active),
    [services]
  );

  const filteredServices = useMemo(() => {
    const rawQuery = searchQuery.trim().normalize('NFC').toLowerCase();
    const tokens = rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];

    return activeServices.filter((service) => {
      const matchesCat =
        selectedCategory === 'all' || service.category === selectedCategory;
      if (!matchesCat) return false;
      if (tokens.length === 0) return true;

      const enMapped = SERVICE_EN_MAP[service.id];
      const searchableText = [
        service.title,
        service.description,
        service.titleEn || '',
        service.descriptionEn || '',
        enMapped?.title || '',
        enMapped?.description || '',
        CATEGORY_LABELS_I18N.bn[service.category] || '',
        CATEGORY_LABELS_I18N.en[service.category] || '',
        ...(service.options ? service.options.map((o) => o.label) : []),
      ]
        .join(' ')
        .normalize('NFC')
        .toLowerCase();

      return tokens.every((token) => searchableText.includes(token));
    });
  }, [activeServices, searchQuery, selectedCategory]);

  const categories: ServiceCategory[] = [
    'all',
    'social',
    'nid_govt',
    'mfs',
    'mobile_sim',
    'passport_birth',
  ];

  const getPriceDisplay = (service: ServiceItem): string => {
    if (service.isDynamic && service.options && service.options.length > 0) {
      const prices = service.options.map((o) => o.price);
      const min = Math.min(...prices);
      return isEn
        ? `From ${formatBDT(min)}`
        : `${formatBDT(min)} থেকে শুরু`;
    }
    return formatBDT(service.basePrice);
  };

  return (
    <section className="space-y-4 sm:space-y-5">
      {/* Section Header & Live Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isEn ? 'All Digital Services' : 'সকল ডিজিটাল সেবাসমূহ'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            {isEn
              ? 'Select a service, fill out the dynamic form, and place your order instantly.'
              : 'প্রয়োজনীয় সেবাটি বেছে নিন এবং সহজ ফর্ম পূরণ করে তাৎক্ষণিক অর্ডার করুন।'}
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim() && selectedCategory !== 'all') {
                setSelectedCategory('all');
              }
            }}
            placeholder={
              isEn
                ? 'Search services (e.g., Server Copy, bKash)...'
                : 'সেবা খুঁজুন (যেমন: সার্ভার কপি, বিকাশ)...'
            }
            className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={isEn ? 'Clear search' : 'খোঁজা মুছুন'}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Category Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {categories.map((cat) => {
          const active = selectedCategory === cat;
          const count =
            cat === 'all'
              ? activeServices.length
              : activeServices.filter((s) => s.category === cat).length;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                active
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{categoryLabels[cat]}</span>
              <span
                className={`text-xs font-mono-num ${
                  active ? 'text-emerald-100' : 'text-slate-400'
                }`}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Strict 2-Column Service Grid (grid-cols-2 on both Mobile and Desktop) */}
      {filteredServices.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
          <SlidersHorizontal className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {isEn ? 'No services found' : 'কোনো সেবা পাওয়া যায়নি'}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {isEn
              ? 'Try changing your search query or category filter.'
              : 'আপনার অনুসন্ধান বা ক্যাটাগরি পরিবর্তন করে আবার চেষ্টা করুন।'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            {isEn ? 'View All Services' : 'সকল সেবা দেখুন'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
          {filteredServices.map((service) => {
            const gradient =
              CATEGORY_GRADIENTS[service.category] ||
              'from-emerald-600 to-teal-700 shadow-emerald-600/20';
            const loc = getLocalizedService(service, language);

            return (
              <div
                key={service.id}
                onClick={() => onSelectService(service)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectService(service);
                  }
                }}
                className="group cursor-pointer text-left rounded-2xl bg-white border border-slate-200 hover:border-emerald-500/70 hover:shadow-lg transition-all p-3.5 sm:p-5 flex flex-col justify-between gap-3 sm:gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <div className="space-y-2.5 sm:space-y-3 min-w-0">
                  {/* Top Row: Vibrant Gradient Icon Badge + Popular/Fast Tag */}
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 overflow-hidden ${
                        service.customIconUrl
                          ? 'bg-white border border-slate-200 shadow-sm p-0.5'
                          : `bg-gradient-to-br ${gradient} text-white shadow-md`
                      }`}
                    >
                      <ServiceIcon
                        name={service.iconName}
                        customIconUrl={service.customIconUrl}
                        className="w-5 h-5 sm:w-6 sm:h-6"
                      />
                    </div>

                    {loc.badgeTag ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold whitespace-nowrap shrink-0 ${
                          service.badgeTag === 'জনপ্রিয়'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {service.badgeTag === 'জনপ্রিয়' ? (
                          <Flame className="w-3 h-3 text-amber-600 shrink-0" />
                        ) : (
                          <Zap className="w-3 h-3 text-emerald-600 shrink-0" />
                        )}
                        <span>{loc.badgeTag}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono-num text-slate-400 shrink-0 pt-1">
                        #{String(service.orderNumber).padStart(2, '0')}
                      </span>
                    )}
                  </div>

                  {/* Category line + Bold Title + 2-Line Description */}
                  <div className="min-w-0">
                    <div className="text-[11px] sm:text-xs text-slate-500 truncate mb-0.5">
                      {categoryLabels[service.category]}
                    </div>
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug line-clamp-2">
                      {loc.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {loc.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Row: Highlighted Price Tag + Order CTA Button */}
                <div className="pt-2.5 sm:pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-xs sm:text-sm font-bold font-mono-num text-emerald-800 tabular-nums whitespace-nowrap">
                      {getPriceDisplay(service)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectService(service);
                    }}
                    className="w-full sm:w-auto min-h-[38px] sm:min-h-[40px] px-3 sm:px-4 py-1.5 rounded-xl bg-slate-900 group-hover:bg-emerald-600 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{isEn ? 'Order Now' : 'অর্ডার করুন'}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
