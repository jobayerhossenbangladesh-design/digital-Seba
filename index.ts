export type Language = 'bn' | 'en';

export type ServiceCategory =
  | 'all'
  | 'social'
  | 'nid_govt'
  | 'mfs'
  | 'mobile_sim'
  | 'passport_birth';

export interface ServicePriceOption {
  id: string;
  label: string;
  price: number;
}

export type FieldType =
  | 'text'
  | 'tel'
  | 'url'
  | 'date'
  | 'textarea'
  | 'select'
  | 'file';

export interface FormFieldSchema {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string;
  sectionTitle?: string;
  showWhenOptions?: string[];
  showWhenOptionIds?: string[];
  isPriceDriver?: boolean;
  colSpan?: 'full' | 'half';
}

export interface ServiceItem {
  id: string;
  orderNumber: number;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  category: Exclude<ServiceCategory, 'all'>;
  basePrice: number;
  isDynamic: boolean;
  options?: ServicePriceOption[];
  active: boolean;
  iconName: string;
  customIconUrl?: string;
  badgeTag?: 'জনপ্রিয়' | 'দ্রুত সেবা';
  fields: FormFieldSchema[];
  hasDisclaimer?: boolean;
}

export interface User {
  id: string;
  name: string;
  mobile: string; // Stored as WhatsApp / Mobile number (e.g. 8801XXXXXXXXX)
  password: string;
  balance: number;
  agreedToPolicy?: boolean;
  createdAt: string;
}

export type OrderStatus = 'Pending' | 'Processing' | 'Completed' | 'Cancelled';

export interface OrderAttachment {
  fieldName: string;
  label: string;
  fileName: string;
  dataUrl: string;
}

export interface OrderFieldEntry {
  key: string;
  label: string;
  value: string;
  sectionTitle?: string;
}

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userMobile: string;
  serviceId: string;
  serviceTitle: string;
  selectedOptionLabel?: string;
  totalPrice: number;
  entries: OrderFieldEntry[];
  attachments: OrderAttachment[];
  status: OrderStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export type RechargeMethod = 'bKash' | 'Nagad';
export type RechargeStatus = 'Pending' | 'Approved' | 'Rejected';

export interface RechargeRequest {
  id: string;
  userId: string;
  userName: string;
  userMobile: string;
  method: RechargeMethod;
  amount: number;
  senderNumber: string;
  trxId: string;
  status: RechargeStatus;
  adminNote?: string;
  createdAt: string;
  processedAt?: string;
}

export type TransactionType = 'credit' | 'debit' | 'refund' | 'admin_adjust';

export interface WalletTransaction {
  id: string;
  userId: string;
  userName: string;
  type: TransactionType;
  amount: number;
  description: string;
  createdAt: string;
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
  qEn?: string;
  aEn?: string;
}

export interface AppSettings {
  rechargeNumber: string;
  adminWhatsapp: string;
  adminPin: string;
  announcementText: string;
  announcementTextEn: string;
  showAnnouncement: boolean;
  bannerTitle: string;
  bannerTitleEn: string;
  bannerSubtitle: string;
  bannerSubtitleEn: string;
  serviceGuidelines?: string;
  serviceGuidelinesEn?: string;
  supportTagline?: string;
  supportTaglineEn?: string;
  faqs?: FaqItem[];
}

export interface AppState {
  language: Language;
  users: User[];
  currentUserId: string | null;
  services: ServiceItem[];
  orders: Order[];
  recharges: RechargeRequest[];
  transactions: WalletTransaction[];
  settings: AppSettings;
}
