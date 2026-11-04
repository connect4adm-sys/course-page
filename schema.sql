-- FindCollege.ai D1 Database Schema
-- Production SQLite schema for Cloudflare D1

-- 1. PRODUCTS CATALOGUE
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  course_name TEXT NOT NULL,
  class_level TEXT NOT NULL,
  subjects TEXT NOT NULL,
  price_paise INTEGER NOT NULL,
  original_price_paise INTEGER NOT NULL,
  active INTEGER DEFAULT 1,
  sample_file_key TEXT NOT NULL,
  full_course_file_keys TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Products
INSERT OR IGNORE INTO products (id, course_name, class_level, subjects, price_paise, original_price_paise, active, sample_file_key, full_course_file_keys)
VALUES 
  ('jee-full', 'JEE Full Course', 'Class 11-12', 'Physics · Chemistry · Mathematics', 49900, 149900, 1, 'samples/jee-full-sample.pdf', 'courses/jee-full-bundle.zip'),
  ('neet-full', 'NEET Full Course', 'Class 11-12', 'Physics · Chemistry · Biology', 49900, 149900, 1, 'samples/neet-full-sample.pdf', 'courses/neet-full-bundle.zip'),
  ('foundation-9-10', 'Foundation Class 9–10', 'Class 9-10', 'Mathematics · Science', 39900, 798000, 1, 'samples/foundation-9-10-sample.pdf', 'courses/foundation-9-10-bundle.zip'),
  ('junior-6-8', 'Junior Foundation Class 6–8', 'Class 6-8', 'Mathematics · Science', 39900, 798000, 1, 'samples/junior-6-8-sample.pdf', 'courses/junior-6-8-bundle.zip');

-- 2. SAMPLE LEADS (FREE SAMPLE CAPTURE)
CREATE TABLE IF NOT EXISTS sample_leads (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES products(id),
  student_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  email_status TEXT DEFAULT 'pending',
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON sample_leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_course ON sample_leads(course_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON sample_leads(created_at);

-- 3. COURSE ORDERS & PAYMENTS
CREATE TABLE IF NOT EXISTS course_orders (
  id TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  payment_id TEXT UNIQUE,
  course_id TEXT NOT NULL REFERENCES products(id),
  amount_paise INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  student_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  payment_status TEXT DEFAULT 'created', -- 'created', 'paid', 'failed'
  delivery_status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  access_code TEXT UNIQUE,
  webhook_processed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON course_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON course_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON course_orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_created ON course_orders(created_at);

-- 4. COURSE ENTITLEMENTS (LIFETIME ACCESS)
CREATE TABLE IF NOT EXISTS course_entitlements (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES course_orders(order_id),
  customer_email TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES products(id),
  access_status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entitlements_email ON course_entitlements(customer_email);
CREATE INDEX IF NOT EXISTS idx_entitlements_course ON course_entitlements(customer_email, course_id);

-- 5. SECURE EXPIRING DOWNLOAD TOKENS
CREATE TABLE IF NOT EXISTS download_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  order_id TEXT NOT NULL REFERENCES course_orders(order_id),
  course_id TEXT NOT NULL,
  file_key TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  download_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tokens_token ON download_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON download_tokens(expires_at);

-- 6. EMAIL LOGS
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'sample', 'purchase', 'retry', 'resend'
  reference_id TEXT,
  delivery_status TEXT NOT NULL, -- 'sent', 'failed'
  provider_message_id TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emails_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_emails_created ON email_logs(created_at);

-- 7. WEBHOOK EVENTS (IDEMPOTENCY)
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processing_status TEXT NOT NULL, -- 'processed', 'ignored', 'failed'
  payload_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_id ON webhook_events(event_id);

-- 8. ADMIN USERS
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);
