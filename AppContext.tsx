import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AppSettings,
  AppState,
  Language,
  Order,
  OrderAttachment,
  OrderFieldEntry,
  OrderStatus,
  RechargeMethod,
  RechargeRequest,
  ServiceItem,
  User,
  WalletTransaction,
} from '../types';
import { INITIAL_APP_STATE, normalizeWhatsappNumber } from '../data/seedData';
import { INITIAL_SERVICES } from '../data/services';

const STORAGE_KEY = 'digital_sheba_v1';

interface ActionResult {
  ok: boolean;
  message: string;
  orderId?: string;
}

interface AppContextValue {
  state: AppState;
  language: Language;
  currentUser: User | null;
  isAdminUnlocked: boolean;
  // Language
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  // Auth
  login: (whatsapp: string, password: string) => ActionResult;
  register: (
    name: string,
    whatsapp: string,
    password: string,
    agreedToPolicy: boolean
  ) => ActionResult;
  logout: () => void;
  loginAsDemo: () => void;
  // Admin Auth
  unlockAdmin: (pin: string) => ActionResult;
  lockAdmin: () => void;
  // User Actions
  submitRecharge: (payload: {
    method: RechargeMethod;
    amount: number;
    senderNumber: string;
    trxId: string;
  }) => ActionResult;
  placeOrder: (payload: {
    service: ServiceItem;
    selectedOptionLabel?: string;
    totalPrice: number;
    entries: OrderFieldEntry[];
    attachments: OrderAttachment[];
  }) => ActionResult;
  // Admin Actions
  approveRecharge: (rechargeId: string) => ActionResult;
  rejectRecharge: (rechargeId: string, reason?: string) => ActionResult;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    adminNote?: string
  ) => ActionResult;
  updateOrderNote: (orderId: string, adminNote: string) => ActionResult;
  addService: (
    payload: Omit<ServiceItem, 'id' | 'orderNumber'>
  ) => ActionResult;
  updateService: (updated: ServiceItem) => ActionResult;
  deleteService: (serviceId: string) => ActionResult;
  toggleServiceActive: (serviceId: string) => void;
  adjustUserBalance: (
    userId: string,
    delta: number,
    note: string
  ) => ActionResult;
  deleteUser: (userId: string) => ActionResult;
  updateSettings: (settings: AppSettings) => ActionResult;
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_APP_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;

    const baseServiceMap = new Map(INITIAL_SERVICES.map((s) => [s.id, s]));
    let mergedServices: ServiceItem[] = INITIAL_SERVICES;

    if (Array.isArray(parsed.services)) {
      mergedServices = parsed.services.map((saved) => {
        const base = baseServiceMap.get(saved.id);
        if (!base) {
          // Custom Admin-added service
          return saved;
        }
        return {
          ...base,
          title: saved.title || base.title,
          titleEn: saved.titleEn ?? base.titleEn,
          description: saved.description || base.description,
          descriptionEn: saved.descriptionEn ?? base.descriptionEn,
          category: saved.category || base.category,
          basePrice:
            typeof saved.basePrice === 'number'
              ? saved.basePrice
              : base.basePrice,
          isDynamic:
            typeof saved.isDynamic === 'boolean'
              ? saved.isDynamic
              : base.isDynamic,
          active:
            typeof saved.active === 'boolean' ? saved.active : base.active,
          options: saved.options || base.options,
          badgeTag: saved.badgeTag ?? base.badgeTag,
          iconName: saved.iconName || base.iconName,
          customIconUrl: saved.customIconUrl,
        };
      });
    }

    return {
      language: parsed.language === 'en' ? 'en' : 'bn',
      users: Array.isArray(parsed.users)
        ? parsed.users
        : INITIAL_APP_STATE.users,
      currentUserId:
        parsed.currentUserId !== undefined
          ? parsed.currentUserId
          : INITIAL_APP_STATE.currentUserId,
      services: mergedServices,
      orders: parsed.orders || INITIAL_APP_STATE.orders,
      recharges: parsed.recharges || INITIAL_APP_STATE.recharges,
      transactions: parsed.transactions || INITIAL_APP_STATE.transactions,
      settings: {
        ...INITIAL_APP_STATE.settings,
        ...(parsed.settings || {}),
      },
    };
  } catch {
    return INITIAL_APP_STATE;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AppState>(() => loadInitialState());
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Handle storage quota gracefully if large screenshots were uploaded
    }
  }, [state]);

  const language = state.language;
  const isEn = language === 'en';
  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || null;

  const setLanguage = (lang: Language) => {
    setState((prev) => ({ ...prev, language: lang }));
  };

  const toggleLanguage = () => {
    setState((prev) => ({
      ...prev,
      language: prev.language === 'bn' ? 'en' : 'bn',
    }));
  };

  const login = (whatsapp: string, password: string): ActionResult => {
    const normalizedInput = normalizeWhatsappNumber(whatsapp.trim());
    const rawDigits = whatsapp.replace(/\D/g, '');
    const user = state.users.find((u) => {
      const normalizedUser = normalizeWhatsappNumber(u.mobile);
      const userDigits = u.mobile.replace(/\D/g, '');
      const phoneMatches =
        normalizedUser === normalizedInput || userDigits === rawDigits;
      return phoneMatches && u.password === password;
    });

    if (!user) {
      return {
        ok: false,
        message: isEn
          ? 'Invalid WhatsApp number or password. Please try again.'
          : 'WhatsApp নাম্বার অথবা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।',
      };
    }
    setState((prev) => ({ ...prev, currentUserId: user.id }));
    return {
      ok: true,
      message: isEn
        ? `Welcome, ${user.name}! Signed in successfully.`
        : `স্বাগতম, ${user.name}! সফলভাবে লগইন হয়েছে।`,
    };
  };

  const register = (
    name: string,
    whatsapp: string,
    password: string,
    agreedToPolicy: boolean
  ): ActionResult => {
    const cleanName = name.trim();
    const normalizedWa = normalizeWhatsappNumber(whatsapp.trim());

    if (!agreedToPolicy) {
      return {
        ok: false,
        message: isEn
          ? 'Please agree to Digital Sheba policies to continue.'
          : 'রেজিস্ট্রেশন করতে ডিজিটাল সেবার নীতিমালার সাথে একমত হতে হবে।',
      };
    }
    if (!cleanName || !normalizedWa || !password) {
      return {
        ok: false,
        message: isEn
          ? 'Please fill out all required fields.'
          : 'অনুগ্রহ করে সকল তথ্য পূরণ করুন।',
      };
    }
    if (normalizedWa.length < 11) {
      return {
        ok: false,
        message: isEn
          ? 'Enter a valid WhatsApp number (e.g. 8801868132145).'
          : 'সঠিক WhatsApp নাম্বার প্রদান করুন (যেমন: 8801868132145)।',
      };
    }
    if (password.length < 4) {
      return {
        ok: false,
        message: isEn
          ? 'Password must be at least 4 characters.'
          : 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।',
      };
    }

    const exists = state.users.some(
      (u) => normalizeWhatsappNumber(u.mobile) === normalizedWa
    );
    if (exists) {
      return {
        ok: false,
        message: isEn
          ? 'An account with this WhatsApp number already exists.'
          : 'এই WhatsApp নাম্বার দিয়ে ইতোমধ্যে অ্যাকাউন্ট খোলা রয়েছে। লগইন করুন।',
      };
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: cleanName,
      mobile: normalizedWa,
      password,
      balance: 0,
      agreedToPolicy: true,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      users: [newUser, ...prev.users],
      currentUserId: newUser.id,
    }));
    return {
      ok: true,
      message: isEn
        ? 'Congratulations! Your account has been created.'
        : 'অভিনন্দন! আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।',
    };
  };

  const logout = () => {
    setState((prev) => ({ ...prev, currentUserId: null }));
  };

  const loginAsDemo = () => {
    const demo = state.users[0];
    if (demo) {
      setState((prev) => ({ ...prev, currentUserId: demo.id }));
    }
  };

  const unlockAdmin = (pin: string): ActionResult => {
    if (pin.trim() === state.settings.adminPin) {
      setIsAdminUnlocked(true);
      return {
        ok: true,
        message: isEn
          ? 'Admin panel unlocked.'
          : 'অ্যাডমিন প্যানেল আনলক হয়েছে।',
      };
    }
    return {
      ok: false,
      message: isEn
        ? 'Incorrect PIN! Please enter the valid 4-digit PIN (Default: 1234).'
        : 'ভুল পিন! অনুগ্রহ করে সঠিক ৪ ডিজিটের পিন দিন (ডিফল্ট: 1234)।',
    };
  };

  const lockAdmin = () => {
    setIsAdminUnlocked(false);
  };

  const submitRecharge = (payload: {
    method: RechargeMethod;
    amount: number;
    senderNumber: string;
    trxId: string;
  }): ActionResult => {
    if (!currentUser) {
      return {
        ok: false,
        message: isEn
          ? 'Please log in before requesting a recharge.'
          : 'রিচার্জ করার আগে অনুগ্রহ করে লগইন করুন।',
      };
    }
    if (!payload.amount || payload.amount < 10) {
      return {
        ok: false,
        message: isEn
          ? 'Minimum recharge amount is 10 BDT.'
          : 'ন্যূনতম ১০ টাকা রিচার্জ করতে হবে।',
      };
    }
    if (!payload.senderNumber.trim() || !payload.trxId.trim()) {
      return {
        ok: false,
        message: isEn
          ? 'Please provide valid Sender Number and TrxID.'
          : 'প্রেরকের নম্বর এবং ট্রানজেকশন আইডি (TrxID) সঠিকভাবে লিখুন।',
      };
    }

    const newReq: RechargeRequest = {
      id: `RCH-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userMobile: currentUser.mobile,
      method: payload.method,
      amount: Math.round(payload.amount),
      senderNumber: payload.senderNumber.trim(),
      trxId: payload.trxId.trim().toUpperCase(),
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      recharges: [newReq, ...prev.recharges],
    }));

    return {
      ok: true,
      message: isEn
        ? 'Recharge request submitted. Admin will verify and credit your wallet.'
        : 'আপনার রিচার্জ রিকোয়েস্ট জমা হয়েছে। অ্যাডমিন যাচাই করে ব্যালেন্স যুক্ত করবেন।',
    };
  };

  const placeOrder = (payload: {
    service: ServiceItem;
    selectedOptionLabel?: string;
    totalPrice: number;
    entries: OrderFieldEntry[];
    attachments: OrderAttachment[];
  }): ActionResult => {
    if (!currentUser) {
      return {
        ok: false,
        message: isEn
          ? 'Please log in first to place an order.'
          : 'অর্ডার করতে অনুগ্রহ করে প্রথমে লগইন করুন।',
      };
    }
    if (currentUser.balance < payload.totalPrice) {
      return {
        ok: false,
        message: isEn
          ? `Insufficient balance. Needed ${payload.totalPrice}৳, available ${currentUser.balance}৳.`
          : `আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই। প্রয়োজন ${payload.totalPrice}৳, বর্তমান ব্যালেন্স ${currentUser.balance}৳।`,
      };
    }

    const now = new Date().toISOString();
    const orderId = `ORD-${Math.floor(1050 + Math.random() * 8900)}`;

    const newOrder: Order = {
      id: orderId,
      userId: currentUser.id,
      userName: currentUser.name,
      userMobile: currentUser.mobile,
      serviceId: payload.service.id,
      serviceTitle: payload.service.title,
      selectedOptionLabel: payload.selectedOptionLabel,
      totalPrice: payload.totalPrice,
      entries: payload.entries,
      attachments: payload.attachments,
      status: 'Pending',
      adminNote: '',
      createdAt: now,
      updatedAt: now,
    };

    const newTxn: WalletTransaction = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      type: 'debit',
      amount: payload.totalPrice,
      description: `অর্ডার পেমেন্ট: ${payload.service.title} (${orderId})`,
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? { ...u, balance: u.balance - payload.totalPrice }
          : u
      ),
      orders: [newOrder, ...prev.orders],
      transactions: [newTxn, ...prev.transactions],
    }));

    return {
      ok: true,
      message: isEn
        ? `Order (${orderId}) submitted and ${payload.totalPrice}৳ deducted from wallet.`
        : `অর্ডার (${orderId}) সফলভাবে জমা হয়েছে এবং ${payload.totalPrice}৳ ওয়ালেট থেকে কাটা হয়েছে।`,
      orderId,
    };
  };

  const approveRecharge = (rechargeId: string): ActionResult => {
    const req = state.recharges.find((r) => r.id === rechargeId);
    if (!req) return { ok: false, message: 'রিকোয়েস্ট পাওয়া যায়নি।' };
    if (req.status !== 'Pending') {
      return {
        ok: false,
        message: 'এই রিকোয়েস্টটি ইতোমধ্যে প্রসেস করা হয়েছে।',
      };
    }

    const now = new Date().toISOString();
    const txn: WalletTransaction = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      userId: req.userId,
      userName: req.userName,
      type: 'credit',
      amount: req.amount,
      description: `${
        req.method === 'bKash' ? 'বিকাশ' : 'নগদ'
      } রিচার্জ অনুমোদিত (TrxID: ${req.trxId})`,
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === req.userId ? { ...u, balance: u.balance + req.amount } : u
      ),
      recharges: prev.recharges.map((r) =>
        r.id === rechargeId
          ? {
              ...r,
              status: 'Approved',
              adminNote: 'পেমেন্ট যাচাই সম্পন্ন ও ওয়ালেটে যুক্ত হয়েছে।',
              processedAt: now,
            }
          : r
      ),
      transactions: [txn, ...prev.transactions],
    }));

    return {
      ok: true,
      message: `${req.userName}-এর ওয়ালেটে ${req.amount}৳ সফলভাবে যোগ করা হয়েছে।`,
    };
  };

  const rejectRecharge = (rechargeId: string, reason?: string): ActionResult => {
    const req = state.recharges.find((r) => r.id === rechargeId);
    if (!req) return { ok: false, message: 'রিকোয়েস্ট পাওয়া যায়নি।' };
    if (req.status !== 'Pending') {
      return {
        ok: false,
        message: 'এই রিকোয়েস্টটি ইতোমধ্যে প্রসেস করা হয়েছে।',
      };
    }

    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      recharges: prev.recharges.map((r) =>
        r.id === rechargeId
          ? {
              ...r,
              status: 'Rejected',
              adminNote:
                reason?.trim() ||
                'ট্রানজেকশন আইডি মেলেনি বা পেমেন্ট পাওয়া যায়নি।',
              processedAt: now,
            }
          : r
      ),
    }));

    return { ok: true, message: 'রিচার্জ রিকোয়েস্টটি বাতিল করা হয়েছে।' };
  };

  const updateOrderStatus = (
    orderId: string,
    status: OrderStatus,
    adminNote?: string
  ): ActionResult => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, message: 'অর্ডার পাওয়া যায়নি।' };

    const now = new Date().toISOString();
    const shouldRefund =
      status === 'Cancelled' && order.status !== 'Cancelled';

    setState((prev) => {
      const updatedUsers = shouldRefund
        ? prev.users.map((u) =>
            u.id === order.userId
              ? { ...u, balance: u.balance + order.totalPrice }
              : u
          )
        : prev.users;

      const updatedTransactions = shouldRefund
        ? [
            {
              id: `TXN-${Date.now().toString().slice(-6)}`,
              userId: order.userId,
              userName: order.userName,
              type: 'refund' as const,
              amount: order.totalPrice,
              description: `অর্ডার বাতিল রিফান্ড: ${order.serviceTitle} (${order.id})`,
              createdAt: now,
            },
            ...prev.transactions,
          ]
        : prev.transactions;

      return {
        ...prev,
        users: updatedUsers,
        transactions: updatedTransactions,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status,
                adminNote:
                  adminNote !== undefined ? adminNote : o.adminNote,
                updatedAt: now,
              }
            : o
        ),
      };
    });

    return {
      ok: true,
      message: shouldRefund
        ? `অর্ডার বাতিল হয়েছে এবং ${order.totalPrice}৳ ইউজারের ওয়ালেটে রিফান্ড হয়েছে।`
        : `অর্ডার স্ট্যাটাস "${status}" হিসেবে আপডেট করা হয়েছে।`,
    };
  };

  const updateOrderNote = (orderId: string, adminNote: string): ActionResult => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId ? { ...o, adminNote, updatedAt: now } : o
      ),
    }));
    return { ok: true, message: 'ডেলিভারি নোট সংরক্ষণ করা হয়েছে।' };
  };

  const addService = (
    payload: Omit<ServiceItem, 'id' | 'orderNumber'>
  ): ActionResult => {
    const maxOrder = state.services.reduce(
      (max, s) => Math.max(max, s.orderNumber),
      0
    );
    const created: ServiceItem = {
      ...payload,
      id: `srv-custom-${Date.now()}`,
      orderNumber: maxOrder + 1,
    };
    setState((prev) => ({
      ...prev,
      services: [...prev.services, created],
    }));
    return {
      ok: true,
      message: isEn
        ? `"${created.title}" added successfully.`
        : `"${created.title}" নতুন সেবা হিসেবে যুক্ত হয়েছে।`,
    };
  };

  const updateService = (updated: ServiceItem): ActionResult => {
    setState((prev) => ({
      ...prev,
      services: prev.services.map((s) => (s.id === updated.id ? updated : s)),
    }));
    return {
      ok: true,
      message: isEn
        ? `"${updated.title}" updated successfully.`
        : `"${updated.title}" সার্ভিস আপডেট হয়েছে।`,
    };
  };

  const deleteService = (serviceId: string): ActionResult => {
    const target = state.services.find((s) => s.id === serviceId);
    setState((prev) => ({
      ...prev,
      services: prev.services.filter((s) => s.id !== serviceId),
    }));
    return {
      ok: true,
      message: isEn
        ? `"${target?.title || 'Service'}" deleted.`
        : `"${target?.title || 'সেবা'}" মুছে ফেলা হয়েছে।`,
    };
  };

  const toggleServiceActive = (serviceId: string) => {
    setState((prev) => ({
      ...prev,
      services: prev.services.map((s) =>
        s.id === serviceId ? { ...s, active: !s.active } : s
      ),
    }));
  };

  const adjustUserBalance = (
    userId: string,
    delta: number,
    note: string
  ): ActionResult => {
    const target = state.users.find((u) => u.id === userId);
    if (!target) return { ok: false, message: 'ইউজার পাওয়া যায়নি।' };
    if (delta === 0 || Number.isNaN(delta)) {
      return { ok: false, message: 'সঠিক টাকার পরিমাণ লিখুন।' };
    }
    const nextBalance = target.balance + delta;
    if (nextBalance < 0) {
      return {
        ok: false,
        message: 'ব্যালেন্স ০ টাকার নিচে নামানো যাবে না।',
      };
    }

    const now = new Date().toISOString();
    const txn: WalletTransaction = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      userId: target.id,
      userName: target.name,
      type: 'admin_adjust',
      amount: Math.abs(delta),
      description:
        note.trim() ||
        (delta > 0
          ? `অ্যাডমিন কর্তৃক ব্যালেন্স যুক্ত (+${delta}৳)`
          : `অ্যাডমিন কর্তৃক ব্যালেন্স কর্তন (-${Math.abs(delta)}৳)`),
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, balance: nextBalance } : u
      ),
      transactions: [txn, ...prev.transactions],
    }));

    return {
      ok: true,
      message: `${target.name}-এর ব্যালেন্স আপডেট করে ${nextBalance}৳ করা হয়েছে।`,
    };
  };

  const deleteUser = (userId: string): ActionResult => {
    const target = state.users.find((u) => u.id === userId);
    if (!target) {
      return {
        ok: false,
        message: isEn ? 'User not found.' : 'ইউজার পাওয়া যায়নি।',
      };
    }

    setState((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.id !== userId),
      currentUserId: prev.currentUserId === userId ? null : prev.currentUserId,
    }));

    return {
      ok: true,
      message: isEn
        ? `User "${target.name}" permanently removed.`
        : `"${target.name}" অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলা হয়েছে।`,
    };
  };

  const updateSettings = (settings: AppSettings): ActionResult => {
    if (!settings.rechargeNumber.trim() || !settings.adminWhatsapp.trim()) {
      return {
        ok: false,
        message: 'রিচার্জ ও হোয়াটসঅ্যাপ নম্বর খালি রাখা যাবে না।',
      };
    }
    if (!settings.adminPin.trim() || settings.adminPin.trim().length < 4) {
      return {
        ok: false,
        message: 'অ্যাডমিন পিন কমপক্ষে ৪ ডিজিটের হতে হবে।',
      };
    }
    setState((prev) => ({ ...prev, settings }));
    return {
      ok: true,
      message: isEn
        ? 'App settings saved successfully.'
        : 'অ্যাপ সেটিংস ও কন্টেন্ট সফলভাবে সংরক্ষণ করা হয়েছে।',
    };
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(INITIAL_APP_STATE);
  };

  return (
    <AppContext.Provider
      value={{
        state,
        language,
        currentUser,
        isAdminUnlocked,
        setLanguage,
        toggleLanguage,
        login,
        register,
        logout,
        loginAsDemo,
        unlockAdmin,
        lockAdmin,
        submitRecharge,
        placeOrder,
        approveRecharge,
        rejectRecharge,
        updateOrderStatus,
        updateOrderNote,
        addService,
        updateService,
        deleteService,
        toggleServiceActive,
        adjustUserBalance,
        deleteUser,
        updateSettings,
        resetDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
