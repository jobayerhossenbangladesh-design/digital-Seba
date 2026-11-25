import React from 'react';
import {
  BadgeDollarSign,
  BookOpenCheck,
  FileCheck2,
  FileSearch,
  KeyRound,
  Landmark,
  ListChecks,
  MapPin,
  PhoneCall,
  ReceiptText,
  RefreshCw,
  ScrollText,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from 'lucide-react';

export const SERVICE_ICON_OPTIONS: { name: string; label: string }[] = [
  { name: 'Facebook', label: 'সোশ্যাল / পেজ' },
  { name: 'ShieldAlert', label: 'সিকিউরিটি' },
  { name: 'BadgeDollarSign', label: 'মনেটাইজেশন / পে' },
  { name: 'FileCheck2', label: 'ডকুমেন্ট / সার্ভার' },
  { name: 'ReceiptText', label: 'স্লিপ / রসিদ' },
  { name: 'BookOpenCheck', label: 'পাসপোর্ট / বই' },
  { name: 'WalletCards', label: 'ওয়ালেট / এমএফএস' },
  { name: 'Landmark', label: 'সরকারি / ব্যাংক' },
  { name: 'KeyRound', label: 'পিন / পাসওয়ার্ড' },
  { name: 'Smartphone', label: 'মোবাইল / সিম' },
  { name: 'MapPin', label: 'লোকেশন' },
  { name: 'ListChecks', label: 'তালিকা / বায়োমেট্রিক' },
  { name: 'PhoneCall', label: 'কল লিস্ট' },
  { name: 'ShieldCheck', label: 'ভেরিফাইড' },
  { name: 'FileSearch', label: 'তথ্য অনুসন্ধান' },
  { name: 'RefreshCw', label: 'সংশোধন / আপডেট' },
  { name: 'ScrollText', label: 'নিবন্ধন সনদ' },
];

interface ServiceIconProps {
  name: string;
  customIconUrl?: string;
  className?: string;
}

export const ServiceIcon: React.FC<ServiceIconProps> = ({
  name,
  customIconUrl,
  className = 'w-5 h-5',
}) => {
  if (customIconUrl && customIconUrl.trim()) {
    return (
      <img
        src={customIconUrl}
        alt=""
        className="w-full h-full object-cover rounded-[inherit]"
      />
    );
  }

  switch (name) {
    case 'Facebook':
      return <Share2 className={className} />;
    case 'ShieldAlert':
      return <ShieldAlert className={className} />;
    case 'BadgeDollarSign':
      return <BadgeDollarSign className={className} />;
    case 'FileCheck2':
      return <FileCheck2 className={className} />;
    case 'ReceiptText':
      return <ReceiptText className={className} />;
    case 'BookOpenCheck':
      return <BookOpenCheck className={className} />;
    case 'WalletCards':
      return <WalletCards className={className} />;
    case 'Landmark':
      return <Landmark className={className} />;
    case 'KeyRound':
      return <KeyRound className={className} />;
    case 'Smartphone':
      return <Smartphone className={className} />;
    case 'MapPin':
      return <MapPin className={className} />;
    case 'SimCard':
      return <Smartphone className={className} />;
    case 'ListChecks':
      return <ListChecks className={className} />;
    case 'PhoneCall':
      return <PhoneCall className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'FileSearch':
      return <FileSearch className={className} />;
    case 'RefreshCw':
      return <RefreshCw className={className} />;
    case 'ScrollText':
      return <ScrollText className={className} />;
    default:
      return <FileCheck2 className={className} />;
  }
};
