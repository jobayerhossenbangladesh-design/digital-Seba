-- Digital Sheba — Non-Destructive Incremental Migration Script
-- Safe to run on an existing database (preserves all users, orders, recharges, services, and settings).
-- If your database does not have the ds_* tables yet, run supabase/schema.sql first, or run supabase/schema.sql directly (it is also non-destructive).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Ensure latest columns exist without touching existing data
ALTER TABLE public.ds_services ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.ds_services ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.ds_services ADD COLUMN IF NOT EXISTS custom_icon_url TEXT;
ALTER TABLE public.ds_services ADD COLUMN IF NOT EXISTS has_disclaimer BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.ds_settings ADD COLUMN IF NOT EXISTS announcement_text_en TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ds_settings ADD COLUMN IF NOT EXISTS banner_title_en TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ds_settings ADD COLUMN IF NOT EXISTS banner_subtitle_en TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ds_settings ADD COLUMN IF NOT EXISTS service_guidelines TEXT;
ALTER TABLE public.ds_settings ADD COLUMN IF NOT EXISTS service_guidelines_en TEXT;
ALTER TABLE public.ds_settings ADD COLUMN IF NOT EXISTS support_tagline TEXT;
ALTER TABLE public.ds_settings ADD COLUMN IF NOT EXISTS support_tagline_en TEXT;
ALTER TABLE public.ds_settings ADD COLUMN IF NOT EXISTS faqs JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Performance & Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_ds_orders_user_created ON public.ds_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ds_recharges_user_created ON public.ds_recharges (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ds_recharges_trx_upper ON public.ds_recharges (upper(trim(trx_id)));
CREATE INDEX IF NOT EXISTS idx_ds_transactions_user_created ON public.ds_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ds_sessions_expires ON public.ds_sessions (expires_at);

-- 3. Enforce Strict RLS & Revoke Direct Table Access
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

-- 4. Updated Security-Hardened RPC Functions (extensions search_path + strict validation)
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

GRANT EXECUTE ON FUNCTION public.ds_require_session(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_register_user(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_login_user(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_submit_recharge(TEXT, TEXT, INTEGER, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_verify_pin(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds_admin_update_order_status(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
