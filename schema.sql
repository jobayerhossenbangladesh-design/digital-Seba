-- Digital Sheba — Supabase PostgreSQL Schema, RLS & Atomic RPC Functions
-- Run this script once in your Supabase Dashboard -> SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Core Tables
CREATE TABLE IF NOT EXISTS public.ds_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  agreed_to_policy BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ds_services (
  id TEXT PRIMARY KEY,
  order_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  description TEXT NOT NULL,
  description_en TEXT,
  category TEXT NOT NULL,
  base_price INTEGER NOT NULL CHECK (base_price >= 0),
  is_dynamic BOOLEAN NOT NULL DEFAULT false,
  options JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  icon_name TEXT NOT NULL DEFAULT 'ShieldCheck',
  custom_icon_url TEXT,
  badge_tag TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  has_disclaimer BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.ds_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.ds_users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_mobile TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_title TEXT NOT NULL,
  selected_option_label TEXT,
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processing', 'Completed', 'Cancelled')),
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ds_recharges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.ds_users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_mobile TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('bKash', 'Nagad')),
  amount INTEGER NOT NULL CHECK (amount >= 10),
  sender_number TEXT NOT NULL,
  trx_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ds_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.ds_users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'refund', 'admin_adjust')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ds_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  recharge_number TEXT NOT NULL,
  admin_whatsapp TEXT NOT NULL,
  admin_pin_hash TEXT NOT NULL DEFAULT '',
  announcement_text TEXT NOT NULL DEFAULT '',
  announcement_text_en TEXT NOT NULL DEFAULT '',
  show_announcement BOOLEAN NOT NULL DEFAULT true,
  banner_title TEXT NOT NULL DEFAULT '',
  banner_title_en TEXT NOT NULL DEFAULT '',
  banner_subtitle TEXT NOT NULL DEFAULT '',
  banner_subtitle_en TEXT NOT NULL DEFAULT '',
  service_guidelines TEXT,
  service_guidelines_en TEXT,
  support_tagline TEXT,
  support_tagline_en TEXT,
  faqs JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.ds_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ds_orders_user_created ON public.ds_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ds_recharges_user_created ON public.ds_recharges (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ds_recharges_trx_upper ON public.ds_recharges (upper(trim(trx_id)));
CREATE INDEX IF NOT EXISTS idx_ds_transactions_user_created ON public.ds_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ds_sessions_expires ON public.ds_sessions (expires_at);

-- 2. Strict Row Level Security (No direct anon/authenticated table access)
ALTER TABLE public.ds_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds_recharges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ds_users FROM anon, authenticated;
REVOKE ALL ON TABLE public.ds_services FROM anon, authenticated;
REVOKE ALL ON TABLE public.ds_orders FROM anon, authenticated;
REVOKE ALL ON TABLE public.ds_recharges FROM anon, authenticated;
REVOKE ALL ON TABLE public.ds_transactions FROM anon, authenticated;
REVOKE ALL ON TABLE public.ds_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.ds_sessions FROM anon, authenticated;

-- 3. Collision-Free Cryptographic ID Helper
CREATE OR REPLACE FUNCTION public.ds_gen_id(p_prefix TEXT)
RETURNS TEXT
LANGUAGE sql
VOLATILE
AS $$
  SELECT p_prefix || '-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

-- 4. Session Validation Helper
CREATE OR REPLACE FUNCTION public.ds_require_session(p_token TEXT, p_role TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_user_id TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  SELECT user_id INTO v_user_id
  FROM public.ds_sessions
  WHERE token_hash = v_hash
    AND role = p_role
    AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  RETURN COALESCE(v_user_id, 'admin');
END;
$$;

-- 5. Bootstrap Public Catalog & Settings (Never exposes admin_pin_hash)
CREATE OR REPLACE FUNCTION public.ds_bootstrap(p_default_services JSONB, p_default_settings JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count INTEGER;
  v_settings RECORD;
  v_services JSONB;
BEGIN
  SELECT count(*) INTO v_count FROM public.ds_services;
  IF v_count = 0 AND jsonb_typeof(p_default_services) = 'array' THEN
    INSERT INTO public.ds_services (
      id, order_number, title, title_en, description, description_en,
      category, base_price, is_dynamic, options, active, icon_name,
      custom_icon_url, badge_tag, fields, has_disclaimer
    )
    SELECT
      elem->>'id',
      COALESCE((elem->>'orderNumber')::integer, 1),
      elem->>'title',
      elem->>'titleEn',
      elem->>'description',
      elem->>'descriptionEn',
      elem->>'category',
      COALESCE((elem->>'basePrice')::integer, 0),
      COALESCE((elem->>'isDynamic')::boolean, false),
      elem->'options',
      COALESCE((elem->>'active')::boolean, true),
      COALESCE(elem->>'iconName', 'ShieldCheck'),
      elem->>'customIconUrl',
      elem->>'badgeTag',
      COALESCE(elem->'fields', '[]'::jsonb),
      COALESCE((elem->>'hasDisclaimer')::boolean, false)
    FROM jsonb_array_elements(p_default_services) AS elem
    ON CONFLICT (id) DO NOTHING;
  END IF;

  INSERT INTO public.ds_settings (
    id, recharge_number, admin_whatsapp, admin_pin_hash,
    announcement_text, announcement_text_en, show_announcement,
    banner_title, banner_title_en, banner_subtitle, banner_subtitle_en,
    service_guidelines, service_guidelines_en, support_tagline, support_tagline_en, faqs
  )
  VALUES (
    1,
    COALESCE(p_default_settings->>'rechargeNumber', '01868132145'),
    COALESCE(p_default_settings->>'adminWhatsapp', '8801868132145'),
    '',
    COALESCE(p_default_settings->>'announcementText', ''),
    COALESCE(p_default_settings->>'announcementTextEn', ''),
    COALESCE((p_default_settings->>'showAnnouncement')::boolean, true),
    COALESCE(p_default_settings->>'bannerTitle', ''),
    COALESCE(p_default_settings->>'bannerTitleEn', ''),
    COALESCE(p_default_settings->>'bannerSubtitle', ''),
    COALESCE(p_default_settings->>'bannerSubtitleEn', ''),
    p_default_settings->>'serviceGuidelines',
    p_default_settings->>'serviceGuidelinesEn',
    p_default_settings->>'supportTagline',
    p_default_settings->>'supportTaglineEn',
    COALESCE(p_default_settings->'faqs', '[]'::jsonb)
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_settings FROM public.ds_settings WHERE id = 1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'orderNumber', s.order_number,
    'title', s.title,
    'titleEn', s.title_en,
    'description', s.description,
    'descriptionEn', s.description_en,
    'category', s.category,
    'basePrice', s.base_price,
    'isDynamic', s.is_dynamic,
    'options', s.options,
    'active', s.active,
    'iconName', s.icon_name,
    'customIconUrl', s.custom_icon_url,
    'badgeTag', s.badge_tag,
    'fields', s.fields,
    'hasDisclaimer', s.has_disclaimer
  ) ORDER BY s.order_number ASC), '[]'::jsonb)
  INTO v_services
  FROM public.ds_services s;

  RETURN jsonb_build_object(
    'services', v_services,
    'adminClaimRequired', (COALESCE(v_settings.admin_pin_hash, '') = ''),
    'settings', jsonb_build_object(
      'rechargeNumber', v_settings.recharge_number,
      'adminWhatsapp', v_settings.admin_whatsapp,
      'announcementText', v_settings.announcement_text,
      'announcementTextEn', v_settings.announcement_text_en,
      'showAnnouncement', v_settings.show_announcement,
      'bannerTitle', v_settings.banner_title,
      'bannerTitleEn', v_settings.banner_title_en,
      'bannerSubtitle', v_settings.banner_subtitle,
      'bannerSubtitleEn', v_settings.banner_subtitle_en,
      'serviceGuidelines', v_settings.service_guidelines,
      'serviceGuidelinesEn', v_settings.service_guidelines_en,
      'supportTagline', v_settings.support_tagline,
      'supportTaglineEn', v_settings.support_tagline_en,
      'faqs', v_settings.faqs
    )
  );
END;
$$;

-- 6. User Registration (bcrypt hashed password + normalized unique mobile + server session)
CREATE OR REPLACE FUNCTION public.ds_register_user(p_name TEXT, p_mobile TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id TEXT;
  v_token TEXT;
  v_user RECORD;
  v_digits TEXT;
  v_norm TEXT;
BEGIN
  v_digits := regexp_replace(COALESCE(p_mobile, ''), '\D', '', 'g');
  v_norm := CASE WHEN v_digits ~ '^01[0-9]{9}$' THEN '88' || v_digits ELSE v_digits END;

  IF length(trim(COALESCE(p_name, ''))) = 0 OR length(v_norm) < 11 OR length(COALESCE(p_password, '')) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ds_users
    WHERE mobile = v_norm OR regexp_replace(mobile, '\D', '', 'g') = v_digits
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MOBILE_EXISTS');
  END IF;

  v_user_id := 'usr-' || gen_random_uuid()::text;
  INSERT INTO public.ds_users (id, name, mobile, password_hash, balance, agreed_to_policy)
  VALUES (
    v_user_id,
    trim(p_name),
    v_norm,
    crypt(p_password, gen_salt('bf', 10)),
    0,
    true
  )
  RETURNING id, name, mobile, balance, agreed_to_policy, created_at INTO v_user;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.ds_sessions (token_hash, user_id, role, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), v_user.id, 'user', now() + interval '7 days');

  RETURN jsonb_build_object(
    'ok', true,
    'token', v_token,
    'user', jsonb_build_object(
      'id', v_user.id,
      'name', v_user.name,
      'mobile', v_user.mobile,
      'balance', v_user.balance,
      'agreedToPolicy', v_user.agreed_to_policy,
      'createdAt', v_user.created_at
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MOBILE_EXISTS');
END;
$$;

-- 7. User Login (bcrypt verification inside PostgreSQL)
CREATE OR REPLACE FUNCTION public.ds_login_user(p_mobile TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user RECORD;
  v_token TEXT;
  v_digits TEXT;
  v_norm TEXT;
BEGIN
  v_digits := regexp_replace(COALESCE(p_mobile, ''), '\D', '', 'g');
  v_norm := CASE WHEN v_digits ~ '^01[0-9]{9}$' THEN '88' || v_digits ELSE v_digits END;

  SELECT * INTO v_user
  FROM public.ds_users
  WHERE mobile = v_norm OR regexp_replace(mobile, '\D', '', 'g') = v_digits
  LIMIT 1;

  IF NOT FOUND OR v_user.password_hash <> crypt(COALESCE(p_password, ''), v_user.password_hash) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CREDENTIALS');
  END IF;

  DELETE FROM public.ds_sessions WHERE expires_at <= now();

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.ds_sessions (token_hash, user_id, role, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), v_user.id, 'user', now() + interval '7 days');

  RETURN jsonb_build_object(
    'ok', true,
    'token', v_token,
    'user', jsonb_build_object(
      'id', v_user.id,
      'name', v_user.name,
      'mobile', v_user.mobile,
      'balance', v_user.balance,
      'agreedToPolicy', v_user.agreed_to_policy,
      'createdAt', v_user.created_at
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_logout_session(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_token IS NOT NULL AND length(p_token) >= 16 THEN
    DELETE FROM public.ds_sessions WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex');
  END IF;
  RETURN true;
END;
$$;

-- 8. Authenticated User State
CREATE OR REPLACE FUNCTION public.ds_get_user_state(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id TEXT;
  v_user RECORD;
  v_orders JSONB;
  v_recharges JSONB;
  v_txns JSONB;
BEGIN
  v_user_id := public.ds_require_session(p_token, 'user');
  SELECT id, name, mobile, balance, agreed_to_policy, created_at INTO v_user FROM public.ds_users WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id, 'userId', o.user_id, 'userName', o.user_name, 'userMobile', o.user_mobile,
    'serviceId', o.service_id, 'serviceTitle', o.service_title, 'selectedOptionLabel', o.selected_option_label,
    'totalPrice', o.total_price, 'entries', o.entries, 'attachments', o.attachments,
    'status', o.status, 'adminNote', o.admin_note, 'createdAt', o.created_at, 'updatedAt', o.updated_at
  ) ORDER BY o.created_at DESC), '[]'::jsonb) INTO v_orders
  FROM public.ds_orders o WHERE o.user_id = v_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'userId', r.user_id, 'userName', r.user_name, 'userMobile', r.user_mobile,
    'method', r.method, 'amount', r.amount, 'senderNumber', r.sender_number, 'trxId', r.trx_id,
    'status', r.status, 'adminNote', r.admin_note, 'createdAt', r.created_at, 'processedAt', r.processed_at
  ) ORDER BY r.created_at DESC), '[]'::jsonb) INTO v_recharges
  FROM public.ds_recharges r WHERE r.user_id = v_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id, 'userId', t.user_id, 'userName', t.user_name, 'type', t.type,
    'amount', t.amount, 'description', t.description, 'createdAt', t.created_at
  ) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_txns
  FROM public.ds_transactions t WHERE t.user_id = v_user_id;

  RETURN jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_user.id, 'name', v_user.name, 'mobile', v_user.mobile,
      'balance', v_user.balance, 'agreedToPolicy', v_user.agreed_to_policy, 'createdAt', v_user.created_at
    ),
    'orders', v_orders,
    'recharges', v_recharges,
    'transactions', v_txns
  );
END;
$$;

-- 9. Atomic Recharge Submission (Unique TrxID + Collision-Free ID)
CREATE OR REPLACE FUNCTION public.ds_submit_recharge(
  p_token TEXT,
  p_method TEXT,
  p_amount INTEGER,
  p_sender_number TEXT,
  p_trx_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id TEXT;
  v_user RECORD;
  v_rch_id TEXT;
  v_clean_trx TEXT;
BEGIN
  v_user_id := public.ds_require_session(p_token, 'user');
  IF p_method NOT IN ('bKash', 'Nagad') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;
  IF p_amount IS NULL OR p_amount < 10 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MIN_AMOUNT');
  END IF;
  v_clean_trx := upper(trim(COALESCE(p_trx_id, '')));
  IF length(v_clean_trx) < 4 OR length(trim(COALESCE(p_sender_number, ''))) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;

  SELECT id, name, mobile INTO v_user FROM public.ds_users WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  v_rch_id := public.ds_gen_id('RCH');

  INSERT INTO public.ds_recharges (id, user_id, user_name, user_mobile, method, amount, sender_number, trx_id, status)
  VALUES (v_rch_id, v_user.id, v_user.name, v_user.mobile, p_method, p_amount, trim(p_sender_number), v_clean_trx, 'Pending');

  RETURN jsonb_build_object('ok', true, 'id', v_rch_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'DUPLICATE_TRX');
END;
$$;

-- 10. Atomic Order Placement (Row Lock FOR UPDATE + Authoritative Server Price + Collision-Free IDs)
CREATE OR REPLACE FUNCTION public.ds_place_order(
  p_token TEXT,
  p_service_id TEXT,
  p_selected_option_label TEXT,
  p_entries JSONB,
  p_attachments JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id TEXT;
  v_user RECORD;
  v_service RECORD;
  v_price INTEGER;
  v_opt JSONB;
  v_order_id TEXT;
  v_txn_id TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_user_id := public.ds_require_session(p_token, 'user');

  SELECT * INTO v_service FROM public.ds_services WHERE id = p_service_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SERVICE_NOT_FOUND');
  END IF;

  v_price := v_service.base_price;
  IF v_service.is_dynamic AND jsonb_typeof(v_service.options) = 'array' AND p_selected_option_label IS NOT NULL THEN
    SELECT elem INTO v_opt
    FROM jsonb_array_elements(v_service.options) AS elem
    WHERE elem->>'label' = p_selected_option_label
    LIMIT 1;
    IF v_opt IS NOT NULL THEN
      v_price := (v_opt->>'price')::integer;
    END IF;
  END IF;

  SELECT * INTO v_user FROM public.ds_users WHERE id = v_user_id FOR UPDATE;
  IF v_user.balance < v_price THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BALANCE', 'needed', v_price, 'available', v_user.balance);
  END IF;

  v_order_id := public.ds_gen_id('ORD');
  v_txn_id := public.ds_gen_id('TXN');

  UPDATE public.ds_users SET balance = balance - v_price WHERE id = v_user.id;

  INSERT INTO public.ds_orders (
    id, user_id, user_name, user_mobile, service_id, service_title,
    selected_option_label, total_price, entries, attachments, status, admin_note, created_at, updated_at
  )
  VALUES (
    v_order_id, v_user.id, v_user.name, v_user.mobile, v_service.id, v_service.title,
    p_selected_option_label, v_price, COALESCE(p_entries, '[]'::jsonb), COALESCE(p_attachments, '[]'::jsonb),
    'Pending', '', v_now, v_now
  );

  INSERT INTO public.ds_transactions (id, user_id, user_name, type, amount, description, created_at)
  VALUES (v_txn_id, v_user.id, v_user.name, 'debit', v_price, 'অর্ডার পেমেন্ট: ' || v_service.title || ' (' || v_order_id || ')', v_now);

  RETURN jsonb_build_object('ok', true, 'orderId', v_order_id, 'totalPrice', v_price);
END;
$$;

-- 11. Admin Authentication (First-run Claim + bcrypt Verification)
CREATE OR REPLACE FUNCTION public.ds_admin_claim_pin(p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_updated INTEGER;
  v_token TEXT;
BEGIN
  IF length(trim(COALESCE(p_pin, ''))) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PIN_TOO_SHORT');
  END IF;

  UPDATE public.ds_settings
  SET admin_pin_hash = crypt(trim(p_pin), gen_salt('bf', 10))
  WHERE id = 1 AND COALESCE(admin_pin_hash, '') = '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_CLAIMED');
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.ds_sessions (token_hash, user_id, role, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), 'admin', 'admin', now() + interval '12 hours');

  RETURN jsonb_build_object('ok', true, 'token', v_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_admin_verify_pin(p_pin TEXT, p_env_override_valid BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_token TEXT;
BEGIN
  IF NOT p_env_override_valid THEN
    SELECT admin_pin_hash INTO v_hash FROM public.ds_settings WHERE id = 1;
    IF COALESCE(v_hash, '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'CLAIM_REQUIRED');
    END IF;
    IF v_hash <> crypt(trim(COALESCE(p_pin, '')), v_hash) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PIN');
    END IF;
  END IF;

  DELETE FROM public.ds_sessions WHERE expires_at <= now();

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.ds_sessions (token_hash, user_id, role, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), 'admin', 'admin', now() + interval '12 hours');

  RETURN jsonb_build_object('ok', true, 'token', v_token);
END;
$$;

-- 12. Admin Management RPCs (Strict Admin Session Verification)
CREATE OR REPLACE FUNCTION public.ds_admin_get_state(p_admin_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_users JSONB;
  v_orders JSONB;
  v_recharges JSONB;
  v_txns JSONB;
  v_services JSONB;
  v_settings RECORD;
BEGIN
  PERFORM public.ds_require_session(p_admin_token, 'admin');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id, 'name', u.name, 'mobile', u.mobile, 'balance', u.balance,
    'agreedToPolicy', u.agreed_to_policy, 'createdAt', u.created_at
  ) ORDER BY u.created_at DESC), '[]'::jsonb) INTO v_users FROM public.ds_users u;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id, 'userId', o.user_id, 'userName', o.user_name, 'userMobile', o.user_mobile,
    'serviceId', o.service_id, 'serviceTitle', o.service_title, 'selectedOptionLabel', o.selected_option_label,
    'totalPrice', o.total_price, 'entries', o.entries, 'attachments', o.attachments,
    'status', o.status, 'adminNote', o.admin_note, 'createdAt', o.created_at, 'updatedAt', o.updated_at
  ) ORDER BY o.created_at DESC), '[]'::jsonb) INTO v_orders FROM public.ds_orders o;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'userId', r.user_id, 'userName', r.user_name, 'userMobile', r.user_mobile,
    'method', r.method, 'amount', r.amount, 'senderNumber', r.sender_number, 'trxId', r.trx_id,
    'status', r.status, 'adminNote', r.admin_note, 'createdAt', r.created_at, 'processedAt', r.processed_at
  ) ORDER BY r.created_at DESC), '[]'::jsonb) INTO v_recharges FROM public.ds_recharges r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id, 'userId', t.user_id, 'userName', t.user_name, 'type', t.type,
    'amount', t.amount, 'description', t.description, 'createdAt', t.created_at
  ) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_txns FROM public.ds_transactions t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'orderNumber', s.order_number, 'title', s.title, 'titleEn', s.title_en,
    'description', s.description, 'descriptionEn', s.description_en, 'category', s.category,
    'basePrice', s.base_price, 'isDynamic', s.is_dynamic, 'options', s.options,
    'active', s.active, 'iconName', s.icon_name, 'customIconUrl', s.custom_icon_url,
    'badgeTag', s.badge_tag, 'fields', s.fields, 'hasDisclaimer', s.has_disclaimer
  ) ORDER BY s.order_number ASC), '[]'::jsonb) INTO v_services FROM public.ds_services s;

  SELECT * INTO v_settings FROM public.ds_settings WHERE id = 1;

  RETURN jsonb_build_object(
    'users', v_users,
    'orders', v_orders,
    'recharges', v_recharges,
    'transactions', v_txns,
    'services', v_services,
    'settings', jsonb_build_object(
      'rechargeNumber', v_settings.recharge_number,
      'adminWhatsapp', v_settings.admin_whatsapp,
      'announcementText', v_settings.announcement_text,
      'announcementTextEn', v_settings.announcement_text_en,
      'showAnnouncement', v_settings.show_announcement,
      'bannerTitle', v_settings.banner_title,
      'bannerTitleEn', v_settings.banner_title_en,
      'bannerSubtitle', v_settings.banner_subtitle,
      'bannerSubtitleEn', v_settings.banner_subtitle_en,
      'serviceGuidelines', v_settings.service_guidelines,
      'serviceGuidelinesEn', v_settings.service_guidelines_en,
      'supportTagline', v_settings.support_tagline,
      'supportTaglineEn', v_settings.support_tagline_en,
      'faqs', v_settings.faqs
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_admin_approve_recharge(p_admin_token TEXT, p_recharge_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_req RECORD;
  v_txn_id TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  PERFORM public.ds_require_session(p_admin_token, 'admin');

  SELECT * INTO v_req FROM public.ds_recharges WHERE id = p_recharge_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;
  IF v_req.status <> 'Pending' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_PROCESSED');
  END IF;

  PERFORM id FROM public.ds_users WHERE id = v_req.user_id FOR UPDATE;
  UPDATE public.ds_users SET balance = balance + v_req.amount WHERE id = v_req.user_id;
  UPDATE public.ds_recharges
  SET status = 'Approved', admin_note = 'পেমেন্ট যাচাই সম্পন্ন ও ওয়ালেটে যুক্ত হয়েছে।', processed_at = v_now
  WHERE id = v_req.id;

  v_txn_id := public.ds_gen_id('TXN');
  INSERT INTO public.ds_transactions (id, user_id, user_name, type, amount, description, created_at)
  VALUES (
    v_txn_id, v_req.user_id, v_req.user_name, 'credit', v_req.amount,
    CASE WHEN v_req.method = 'bKash' THEN 'বিকাশ' ELSE 'নগদ' END || ' রিচার্জ অনুমোদিত (TrxID: ' || v_req.trx_id || ')',
    v_now
  );

  RETURN jsonb_build_object('ok', true, 'userName', v_req.user_name, 'amount', v_req.amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_admin_reject_recharge(p_admin_token TEXT, p_recharge_id TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_req RECORD;
BEGIN
  PERFORM public.ds_require_session(p_admin_token, 'admin');
  SELECT * INTO v_req FROM public.ds_recharges WHERE id = p_recharge_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;
  IF v_req.status <> 'Pending' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_PROCESSED');
  END IF;

  UPDATE public.ds_recharges
  SET status = 'Rejected',
      admin_note = COALESCE(NULLIF(trim(p_reason), ''), 'ট্রানজেকশন আইডি মেলেনি বা পেমেন্ট পাওয়া যায়নি।'),
      processed_at = now()
  WHERE id = v_req.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_admin_update_order_status(
  p_admin_token TEXT,
  p_order_id TEXT,
  p_status TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order RECORD;
  v_refunded BOOLEAN := false;
  v_txn_id TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  PERFORM public.ds_require_session(p_admin_token, 'admin');
  IF p_status NOT IN ('Pending', 'Processing', 'Completed', 'Cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STATUS');
  END IF;

  SELECT * INTO v_order FROM public.ds_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  IF v_order.status = 'Cancelled' AND p_status <> 'Cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_CANCELLED');
  END IF;

  IF p_status = 'Cancelled' AND v_order.status <> 'Cancelled' THEN
    v_refunded := true;
    PERFORM id FROM public.ds_users WHERE id = v_order.user_id FOR UPDATE;
    UPDATE public.ds_users SET balance = balance + v_order.total_price WHERE id = v_order.user_id;
    v_txn_id := public.ds_gen_id('TXN');
    INSERT INTO public.ds_transactions (id, user_id, user_name, type, amount, description, created_at)
    VALUES (v_txn_id, v_order.user_id, v_order.user_name, 'refund', v_order.total_price, 'অর্ডার বাতিল রিফান্ড: ' || v_order.service_title || ' (' || v_order.id || ')', v_now);
  END IF;

  UPDATE public.ds_orders
  SET status = p_status,
      admin_note = COALESCE(p_admin_note, admin_note),
      updated_at = v_now
  WHERE id = v_order.id;

  RETURN jsonb_build_object('ok', true, 'refunded', v_refunded, 'amount', v_order.total_price);
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_admin_update_order_note(p_admin_token TEXT, p_order_id TEXT, p_admin_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.ds_require_session(p_admin_token, 'admin');
  UPDATE public.ds_orders SET admin_note = COALESCE(p_admin_note, ''), updated_at = now() WHERE id = p_order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_admin_adjust_balance(
  p_admin_token TEXT,
  p_user_id TEXT,
  p_delta INTEGER,
  p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user RECORD;
  v_next INTEGER;
  v_txn_id TEXT;
BEGIN
  PERFORM public.ds_require_session(p_admin_token, 'admin');
  IF p_delta IS NULL OR p_delta = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DELTA');
  END IF;

  SELECT * INTO v_user FROM public.ds_users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  v_next := v_user.balance + p_delta;
  IF v_next < 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NEGATIVE_BALANCE');
  END IF;

  UPDATE public.ds_users SET balance = v_next WHERE id = v_user.id;
  v_txn_id := public.ds_gen_id('TXN');
  INSERT INTO public.ds_transactions (id, user_id, user_name, type, amount, description)
  VALUES (
    v_txn_id, v_user.id, v_user.name, 'admin_adjust', abs(p_delta),
    COALESCE(NULLIF(trim(p_note), ''), CASE WHEN p_delta > 0 THEN 'অ্যাডমিন কর্তৃক ব্যালেন্স যুক্ত (+' || p_delta || '৳)' ELSE 'অ্যাডমিন কর্তৃক ব্যালেন্স কর্তন (-' || abs(p_delta) || '৳)' END)
  );

  RETURN jsonb_build_object('ok', true, 'userName', v_user.name, 'balance', v_next);
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_admin_delete_user(p_admin_token TEXT, p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_name TEXT;
BEGIN
  PERFORM public.ds_require_session(p_admin_token, 'admin');
  DELETE FROM public.ds_sessions WHERE user_id = p_user_id;
  DELETE FROM public.ds_users WHERE id = p_user_id RETURNING name INTO v_name;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;
  RETURN jsonb_build_object('ok', true, 'userName', v_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_admin_upsert_service(p_admin_token TEXT, p_service JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id TEXT;
  v_order_num INTEGER;
BEGIN
  PERFORM public.ds_require_session(p_admin_token, 'admin');
  v_id := NULLIF(trim(p_service->>'id'), '');
  IF v_id IS NULL THEN
    v_id := 'srv-custom-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    SELECT COALESCE(max(order_number), 0) + 1 INTO v_order_num FROM public.ds_services;
  ELSE
    v_order_num := COALESCE((p_service->>'orderNumber')::integer, 1);
  END IF;

  INSERT INTO public.ds_services (
    id, order_number, title, title_en, description, description_en,
    category, base_price, is_dynamic, options, active, icon_name,
    custom_icon_url, badge_tag, fields, has_disclaimer
  )
  VALUES (
    v_id, v_order_num, p_service->>'title', p_service->>'titleEn',
    p_service->>'description', p_service->>'descriptionEn',
    p_service->>'category', COALESCE((p_service->>'basePrice')::integer, 0),
    COALESCE((p_service->>'isDynamic')::boolean, false), p_service->'options',
    COALESCE((p_service->>'active')::boolean, true), COALESCE(p_service->>'iconName', 'ShieldCheck'),
    p_service->>'customIconUrl', p_service->>'badgeTag',
    COALESCE(p_service->'fields', '[]'::jsonb), COALESCE((p_service->>'hasDisclaimer')::boolean, false)
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    title_en = EXCLUDED.title_en,
    description = EXCLUDED.description,
    description_en = EXCLUDED.description_en,
    category = EXCLUDED.category,
    base_price = EXCLUDED.base_price,
    is_dynamic = EXCLUDED.is_dynamic,
    options = EXCLUDED.options,
    active = EXCLUDED.active,
    icon_name = EXCLUDED.icon_name,
    custom_icon_url = EXCLUDED.custom_icon_url,
    badge_tag = EXCLUDED.badge_tag,
    fields = EXCLUDED.fields,
    has_disclaimer = EXCLUDED.has_disclaimer;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_admin_delete_service(p_admin_token TEXT, p_service_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.ds_require_session(p_admin_token, 'admin');
  DELETE FROM public.ds_services WHERE id = p_service_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_admin_toggle_service(p_admin_token TEXT, p_service_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.ds_require_session(p_admin_token, 'admin');
  UPDATE public.ds_services SET active = NOT active WHERE id = p_service_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ds_admin_update_settings(
  p_admin_token TEXT,
  p_settings JSONB,
  p_new_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.ds_require_session(p_admin_token, 'admin');
  UPDATE public.ds_settings
  SET recharge_number = COALESCE(NULLIF(trim(p_settings->>'rechargeNumber'), ''), recharge_number),
      admin_whatsapp = COALESCE(NULLIF(trim(p_settings->>'adminWhatsapp'), ''), admin_whatsapp),
      admin_pin_hash = CASE
        WHEN p_new_pin IS NOT NULL AND length(trim(p_new_pin)) >= 4
          THEN crypt(trim(p_new_pin), gen_salt('bf', 10))
        ELSE admin_pin_hash
      END,
      announcement_text = COALESCE(p_settings->>'announcementText', announcement_text),
      announcement_text_en = COALESCE(p_settings->>'announcementTextEn', announcement_text_en),
      show_announcement = COALESCE((p_settings->>'showAnnouncement')::boolean, show_announcement),
      banner_title = COALESCE(p_settings->>'bannerTitle', banner_title),
      banner_title_en = COALESCE(p_settings->>'bannerTitleEn', banner_title_en),
      banner_subtitle = COALESCE(p_settings->>'bannerSubtitle', banner_subtitle),
      banner_subtitle_en = COALESCE(p_settings->>'bannerSubtitleEn', banner_subtitle_en),
      service_guidelines = COALESCE(p_settings->>'serviceGuidelines', service_guidelines),
      service_guidelines_en = COALESCE(p_settings->>'serviceGuidelinesEn', service_guidelines_en),
      support_tagline = COALESCE(p_settings->>'supportTagline', support_tagline),
      support_tagline_en = COALESCE(p_settings->>'supportTaglineEn', support_tagline_en),
      faqs = COALESCE(p_settings->'faqs', faqs)
  WHERE id = 1;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Grant execute only on RPC entrypoints (all mutating RPCs validate cryptographic sessions inside PostgreSQL)
GRANT EXECUTE ON FUNCTION public.ds_bootstrap(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_register_user(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_login_user(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_logout_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_get_user_state(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_submit_recharge(TEXT, TEXT, INTEGER, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_place_order(TEXT, TEXT, TEXT, JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_claim_pin(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_verify_pin(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_get_state(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_approve_recharge(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_reject_recharge(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_update_order_status(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_update_order_note(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_adjust_balance(TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_delete_user(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_upsert_service(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_delete_service(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_toggle_service(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_update_settings(TEXT, JSONB, TEXT) TO anon, authenticated;
