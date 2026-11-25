import { Language, ServiceCategory, ServiceItem } from '../types';

export const CATEGORY_LABELS_I18N: Record<
  Language,
  Record<ServiceCategory, string>
> = {
  bn: {
    all: 'সকল সেবা',
    social: 'ফেসবুক ও সোশ্যাল',
    nid_govt: 'এনআইডি ও সরকারি',
    mfs: 'বিকাশ ও নগদ',
    mobile_sim: 'সিম ও IMEI সেবা',
    passport_birth: 'পাসপোর্ট ও নিবন্ধন',
  },
  en: {
    all: 'All Services',
    social: 'Social & Facebook',
    nid_govt: 'NID & Govt',
    mfs: 'bKash & Nagad',
    mobile_sim: 'SIM & IMEI',
    passport_birth: 'Passport & Birth Reg',
  },
};

export const SERVICE_EN_MAP: Record<
  string,
  { title: string; description: string }
> = {
  'srv-1': {
    title: 'Page & Profile Support',
    description:
      'Facebook profile & page admin access recovery, professional setup, and bio optimization.',
  },
  'srv-2': {
    title: 'Facebook Account Security Support',
    description:
      'Recovery and security assistance for hacked, suspended, or 2FA locked Facebook accounts.',
  },
  'srv-3': {
    title: 'Monetization Issue Support',
    description:
      'Resolution for Facebook & digital platform monetization policy issues and payout setup.',
  },
  'srv-4': {
    title: 'NID Server Copy Support',
    description:
      'Fastest retrieval assistance for online verified NID server copy.',
  },
  'srv-5': {
    title: 'Lost TIN Certificate Recovery',
    description:
      'Retrieve your lost e-TIN certificate quickly using TIN or NID number.',
  },
  'srv-6': {
    title: 'Passport Info Check',
    description:
      'Verify current passport status and official details using passport number.',
  },
  'srv-7': {
    title: 'bKash Account Issue Support',
    description:
      'Urgent assistance for bKash balance check, PIN reset, statement, and account info.',
  },
  'srv-8': {
    title: 'Nagad Account Issue Support',
    description:
      'Urgent assistance for Nagad balance check, PIN reset, statement, and account info.',
  },
  'srv-9': {
    title: 'NID User & Password Setup',
    description:
      'Election Commission NID portal user account and password setup assistance.',
  },
  'srv-10': {
    title: 'Phone IMEI Service',
    description:
      'IMEI tracking, active number lookup, and device info for lost or used phones.',
  },
  'srv-11': {
    title: 'Number to Location',
    description:
      'Last known location information support for urgent mobile number lookup.',
  },
  'srv-12': {
    title: 'Number to ID Card Info',
    description:
      'Operator-wise SIM registration & ID card verification support.',
  },
  'srv-13': {
    title: 'NID to All Numbers Support',
    description:
      'Retrieve the complete list of SIM numbers registered against an NID card.',
  },
  'srv-14': {
    title: 'Lost Call & SMS List Support',
    description:
      'Retrieve last 6 months call history or SMS list for your mobile number.',
  },
  'srv-15': {
    title: 'Passport SB Copy Support',
    description:
      'Passport police verification / Special Branch (SB) copy information support.',
  },
  'srv-16': {
    title: 'Lost Birth Registration Support',
    description:
      'Find and recover your lost birth registration number and records.',
  },
  'srv-17': {
    title: 'Birth Registration OTP Change',
    description:
      'Mobile number or OTP change support for birth registration applications.',
  },
  'srv-18': {
    title: 'Birth & Death Registration Support',
    description:
      'New birth registration, Ministry approval, foreign birthplace, and birth-death registration.',
  },
};

export function getLocalizedService(service: ServiceItem, lang: Language) {
  if (lang === 'bn') {
    return {
      title: service.title,
      description: service.description,
      badgeTag: service.badgeTag,
    };
  }
  const fallback = SERVICE_EN_MAP[service.id];
  return {
    title: service.titleEn || fallback?.title || service.title,
    description:
      service.descriptionEn || fallback?.description || service.description,
    badgeTag:
      service.badgeTag === 'জনপ্রিয়'
        ? 'Popular'
        : service.badgeTag === 'দ্রুত সেবা'
        ? 'Fast Service'
        : undefined,
  };
}
