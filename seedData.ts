import { AppState } from '../types';
import { INITIAL_SERVICES } from './services';

export const INITIAL_APP_STATE: AppState = {
  language: 'bn',
  users: [
    {
      id: 'usr-demo-1',
      name: 'রাফি আহমেদ',
      mobile: '8801711223344',
      password: '123456',
      balance: 2450,
      agreedToPolicy: true,
      createdAt: '2026-11-18T10:15:00.000Z',
    },
    {
      id: 'usr-demo-2',
      name: 'সাদিয়া ইসলাম',
      mobile: '8801912345678',
      password: '123456',
      balance: 4200,
      agreedToPolicy: true,
      createdAt: '2026-11-19T14:30:00.000Z',
    },
    {
      id: 'usr-demo-3',
      name: 'তানভীর হাসান',
      mobile: '8801819887766',
      password: '123456',
      balance: 850,
      agreedToPolicy: true,
      createdAt: '2026-11-20T09:00:00.000Z',
    },
  ],
  currentUserId: 'usr-demo-1',
  services: INITIAL_SERVICES,
  orders: [
    {
      id: 'ORD-1042',
      userId: 'usr-demo-1',
      userName: 'রাফি আহমেদ',
      userMobile: '8801711223344',
      serviceId: 'srv-4',
      serviceTitle: 'সার্ভার কপি সহায়তা',
      totalPrice: 150,
      entries: [
        {
          key: 'nidNumber',
          label: 'NID Number (10 or 17 digits)',
          value: '19962614285900124',
        },
        {
          key: 'dob',
          label: 'Date of Birth (YYYY-MM-DD)',
          value: '1996-08-14',
        },
      ],
      attachments: [],
      status: 'Completed',
      adminNote:
        'আপনার ভেরিফাইড এনআইডি সার্ভার কপি তৈরি সম্পন্ন হয়েছে। পিডিএফ ডেলিভারি পেতে হোয়াটসঅ্যাপে অর্ডার নং ORD-1042 দিন অথবা নিচের তথ্য সংরক্ষণ করুন: Verified Status — Active.',
      createdAt: '2026-11-21T08:40:00.000Z',
      updatedAt: '2026-11-21T11:10:00.000Z',
    },
    {
      id: 'ORD-1043',
      userId: 'usr-demo-1',
      userName: 'রাফি আহমেদ',
      userMobile: '8801711223344',
      serviceId: 'srv-2',
      serviceTitle: 'ফেসবুক অ্যাকাউন্ট নিরাপত্তা সাপোর্ট',
      selectedOptionLabel: 'টু-ফ্যাক্টর (2FA) কোড সমস্যা',
      totalPrice: 800,
      entries: [
        { key: 'accountName', label: 'অ্যাকাউন্টের নাম', value: 'Rafi Ahmed' },
        {
          key: 'priceOption',
          label: 'সমস্যার ধরন নির্বাচন করুন',
          value: 'টু-ফ্যাক্টর (2FA) কোড সমস্যা',
        },
        {
          key: 'profileLink',
          label: 'প্রোফাইল লিংক',
          value: 'https://facebook.com/rafi.ahmed.demo',
        },
        {
          key: 'description',
          label: 'সমস্যার একটি স্পষ্ট বর্ণনা দিন',
          value:
            'ফোন হারিয়ে যাওয়ার পর থেকে 2FA অথেনটিকেটর কোড পাওয়া যাচ্ছে না।',
        },
      ],
      attachments: [],
      status: 'Processing',
      adminNote:
        'রিকভারি টিকেট সাবমিট করা হয়েছে। ফেসবুক সাপোর্ট রেসপন্স পেলেই আপডেট দেওয়া হবে।',
      createdAt: '2026-11-23T14:20:00.000Z',
      updatedAt: '2026-11-23T15:05:00.000Z',
    },
    {
      id: 'ORD-1044',
      userId: 'usr-demo-2',
      userName: 'সাদিয়া ইসলাম',
      userMobile: '8801912345678',
      serviceId: 'srv-6',
      serviceTitle: 'পাসপোর্ট ইনফো চেক',
      totalPrice: 199,
      entries: [
        {
          key: 'passportNumber',
          label: 'পাসপোর্ট নং (যেমন: B12345678)',
          value: 'A04829114',
        },
      ],
      attachments: [],
      status: 'Pending',
      adminNote: '',
      createdAt: '2026-11-24T06:50:00.000Z',
      updatedAt: '2026-11-24T06:50:00.000Z',
    },
  ],
  recharges: [
    {
      id: 'RCH-501',
      userId: 'usr-demo-1',
      userName: 'রাফি আহমেদ',
      userMobile: '8801711223344',
      method: 'bKash',
      amount: 3400,
      senderNumber: '01711223344',
      trxId: 'BKS9X4M291',
      status: 'Approved',
      adminNote: 'পেমেন্ট যাচাই সম্পন্ন ও ওয়ালেটে যুক্ত করা হয়েছে।',
      createdAt: '2026-11-20T09:15:00.000Z',
      processedAt: '2026-11-20T09:22:00.000Z',
    },
    {
      id: 'RCH-502',
      userId: 'usr-demo-2',
      userName: 'সাদিয়া ইসলাম',
      userMobile: '8801912345678',
      method: 'Nagad',
      amount: 1500,
      senderNumber: '01912345678',
      trxId: 'NGD77P88Q1',
      status: 'Pending',
      createdAt: '2026-11-24T07:10:00.000Z',
    },
    {
      id: 'RCH-503',
      userId: 'usr-demo-3',
      userName: 'তানভীর হাসান',
      userMobile: '8801819887766',
      method: 'bKash',
      amount: 2000,
      senderNumber: '01819887766',
      trxId: 'BKS4Z11K89',
      status: 'Pending',
      createdAt: '2026-11-24T08:05:00.000Z',
    },
  ],
  transactions: [
    {
      id: 'TXN-901',
      userId: 'usr-demo-1',
      userName: 'রাফি আহমেদ',
      type: 'credit',
      amount: 3400,
      description: 'বিকাশ ওয়ালেট রিচার্জ অনুমোদিত (TrxID: BKS9X4M291)',
      createdAt: '2026-11-20T09:22:00.000Z',
    },
    {
      id: 'TXN-902',
      userId: 'usr-demo-1',
      userName: 'রাফি আহমেদ',
      type: 'debit',
      amount: 150,
      description: 'অর্ডার পেমেন্ট: সার্ভার কপি সহায়তা (ORD-1042)',
      createdAt: '2026-11-21T08:40:00.000Z',
    },
    {
      id: 'TXN-903',
      userId: 'usr-demo-1',
      userName: 'রাফি আহমেদ',
      type: 'debit',
      amount: 800,
      description:
        'অর্ডার পেমেন্ট: ফেসবুক অ্যাকাউন্ট নিরাপত্তা সাপোর্ট (ORD-1043)',
      createdAt: '2026-11-23T14:20:00.000Z',
    },
    {
      id: 'TXN-904',
      userId: 'usr-demo-2',
      userName: 'সাদিয়া ইসলাম',
      type: 'credit',
      amount: 4399,
      description: 'প্রাথমিক ওয়ালেট রিচার্জ',
      createdAt: '2026-11-19T14:35:00.000Z',
    },
    {
      id: 'TXN-905',
      userId: 'usr-demo-2',
      userName: 'সাদিয়া ইসলাম',
      type: 'debit',
      amount: 199,
      description: 'অর্ডার পেমেন্ট: পাসপোর্ট ইনফো চেক (ORD-1044)',
      createdAt: '2026-11-24T06:50:00.000Z',
    },
  ],
  settings: {
    rechargeNumber: '01868132145',
    adminWhatsapp: '8801868132145',
    adminPin: '1234',
    announcementText:
      'সকল ডিজিটাল সেবা ২৪/৭ চালু রয়েছে। দ্রুত ডেলিভারির জন্য সঠিক তথ্য দিয়ে অর্ডার করুন এবং প্রয়োজনে হোয়াটসঅ্যাপে যোগাযোগ করুন।',
    announcementTextEn:
      'All digital services are active 24/7. Please submit accurate details for fastest delivery and reach us on WhatsApp if needed.',
    showAnnouncement: true,
    bannerTitle: '',
    bannerTitleEn: '',
    bannerSubtitle:
      'সার্ভার কপি, জন্ম নিবন্ধন, পাসপোর্ট তথ্য, ফেসবুক রিকভারি এবং বিকাশ-নগদ সহায়তা পেতে লগইন বা নতুন অ্যাকাউন্ট তৈরি করুন।',
    bannerSubtitleEn:
      'Log in or create an account for NID Server Copy, Birth Registration, Passport Info, Facebook Recovery, and bKash/Nagad assistance.',
    serviceGuidelines: [
      'সকল ডিজিটাল সেবার অর্ডার ২৪ ঘণ্টাই গ্রহণ করা হয় এবং সাধারণত ১–২৪ ঘণ্টার মধ্যে ডেলিভারি দেওয়া হয়।',
      'অর্ডার কনফার্ম করার আগে এনআইডি, পাসপোর্ট বা জন্ম নিবন্ধনের তথ্য ভালোভাবে যাচাই করে নিন।',
      'ভুল তথ্য দিলে অর্ডার সংশোধন বা রিফান্ড প্রযোজ্য নাও হতে পারে।',
      'সাপোর্টে যোগাযোগ করার সময় অবশ্যই আপনার অর্ডার আইডি (Order ID) উল্লেখ করুন।',
    ].join('\n'),
    serviceGuidelinesEn: [
      'Orders can be placed 24/7 and are typically delivered within 1–24 hours.',
      'Please carefully verify NID, Passport, and Birth Registration details before confirming.',
      'Incorrectly submitted details may not be eligible for modification or refund.',
      'Always keep your Order ID ready when contacting WhatsApp admin support.',
    ].join('\n'),
    supportTagline:
      'দ্রুত, নিরাপদ এবং বিশ্বস্ত ডিজিটাল সেবার নির্ভরযোগ্য মাধ্যম — ২৪/৭ আপনার পাশে।',
    supportTaglineEn:
      'Fast, safe, and trusted digital service platform — by your side 24/7.',
    faqs: [
      {
        id: 'faq-1',
        q: 'ওয়ালেটে টাকা রিচার্জ হতে কতক্ষণ সময় লাগে?',
        a: 'বিকাশ বা নগদ Send Money করার পর সঠিক TrxID দিয়ে রিকোয়েস্ট পাঠালে সাধারণত ৫ থেকে ১৫ মিনিটের মধ্যে ব্যালেন্স যুক্ত করা হয়।',
        qEn: 'How long does wallet recharge approval take?',
        aEn: 'After sending money via bKash/Nagad and submitting the TrxID, your wallet is typically credited within 5–15 minutes.',
      },
      {
        id: 'faq-2',
        q: 'কোনো অর্ডার বাতিল (Cancelled) হলে কি টাকা ফেরত পাব?',
        a: 'হ্যাঁ, কোনো কারণে আপনার অর্ডার সম্পন্ন করা সম্ভব না হলে সম্পূর্ণ টাকা স্বয়ংক্রিয়ভাবে আপনার ওয়ালেটে রিফান্ড হয়ে যাবে।',
        qEn: 'Will I get a refund if an order is cancelled?',
        aEn: 'Yes! If an order cannot be completed and is cancelled, the full fee is automatically refunded to your wallet.',
      },
      {
        id: 'faq-3',
        q: 'জন্ম নিবন্ধন বা জরুরি ডকুমেন্ট কোথায় পাঠাব?',
        a: 'জন্ম নিবন্ধন ও অন্যান্য সেবার প্রয়োজনীয় ডকুমেন্ট আপনার অর্ডার আইডিসহ আমাদের অফিশিয়াল এডমিন হোয়াটসঅ্যাপ নম্বরে পাঠাবেন।',
        qEn: 'Where do I send birth registration or urgent documents?',
        aEn: 'Please send your supporting documents along with your Order ID to our official admin WhatsApp number.',
      },
    ],
  },
};

export function formatBDT(amount: number): string {
  return `${amount.toLocaleString('en-US')}৳`;
}

export function formatDateTimeBn(
  isoString: string,
  lang: 'bn' | 'en' = 'bn'
): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString(lang === 'en' ? 'en-US' : 'bn-BD', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function normalizeWhatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    return `88${digits}`;
  }
  return digits;
}
