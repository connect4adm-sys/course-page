# FindCollege.ai — Production Deployment & Configuration Guide

This guide details the complete setup for taking FindCollege.ai live with **Cloudflare Pages, D1 Database, R2 Storage, Razorpay Payments, Resend Transactional Emails, and Meta Pixel Tracking**.

---

## Architecture Overview

```
                      ┌───────────────────────────────────────┐
                      │        Cloudflare Pages (Edge)        │
                      └───────────────────┬───────────────────┘
                                          │
                  ┌───────────────────────┼──────────────────────┐
                  ▼                       ▼                      ▼
        ┌───────────────────┐   ┌───────────────────┐  ┌───────────────────┐
        │   Cloudflare D1   │   │   Cloudflare R2   │  │ Pages Functions   │
        │   (SQLite at Edge)│   │  (Private Bucket) │  │  (/functions/api) │
        └───────────────────┘   └───────────────────┘  └─────────┬─────────┘
                                                                 │
                                     ┌───────────────────────────┴───────────────┐
                                     ▼                                           ▼
                           ┌───────────────────┐                       ┌───────────────────┐
                           │ Razorpay Gateway  │                       │ Resend Email API  │
                           │  (UPI / Cards)    │                       │ (Delivery & Leads)│
                           └───────────────────┘                       └───────────────────┘
```

---

## 1. Cloudflare D1 Database Setup

### Step 1.1: Create D1 Database
Run this command from your terminal using Wrangler:
```bash
npx wrangler d1 create findcollege_courses_db
```
*Note down the `database_id` returned in the output.*

### Step 1.2: Bind in `wrangler.toml`
Update `wrangler.toml` with your generated `database_id`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "findcollege_courses_db"
database_id = "your-actual-database-id-here"
```

### Step 1.3: Apply Schema & Initial Seed Data
Run the migration file against your remote D1 database:
```bash
npx wrangler d1 execute findcollege_courses_db --remote --file=./schema.sql
```
*(For local testing with Wrangler, omit `--remote`).*

---

## 2. Cloudflare R2 Private File Storage Setup

### Step 2.1: Create Private Storage Bucket
```bash
npx wrangler r2 bucket create findcollege-course-assets
```

### Step 2.2: Course Materials & File Key Mapping
Upload your four sample PDFs and four full-course ZIP packages to the exact bucket paths:

| Product | Free Sample Key (PDF) | Full Course Bundle Key (ZIP) |
| :--- | :--- | :--- |
| **JEE Full Course** (₹499) | `samples/jee-full-sample.pdf` | `courses/jee-full-bundle.zip` |
| **NEET Full Course** (₹499) | `samples/neet-full-sample.pdf` | `courses/neet-full-bundle.zip` |
| **Foundation Class 9–10** (₹399) | `samples/foundation-9-10-sample.pdf` | `courses/foundation-9-10-bundle.zip` |
| **Junior Foundation Class 6–8** (₹399) | `samples/junior-6-8-sample.pdf` | `courses/junior-6-8-bundle.zip` |

### Step 2.3: Uploading Files via Wrangler CLI
```bash
# Upload Sample PDFs
npx wrangler r2 object put findcollege-course-assets/samples/jee-full-sample.pdf --file="./path/to/jee-sample.pdf"
npx wrangler r2 object put findcollege-course-assets/samples/neet-full-sample.pdf --file="./path/to/neet-sample.pdf"
npx wrangler r2 object put findcollege-course-assets/samples/foundation-9-10-sample.pdf --file="./path/to/f910-sample.pdf"
npx wrangler r2 object put findcollege-course-assets/samples/junior-6-8-sample.pdf --file="./path/to/j68-sample.pdf"

# Upload Full Course Packages
npx wrangler r2 object put findcollege-course-assets/courses/jee-full-bundle.zip --file="./path/to/jee-full.zip"
npx wrangler r2 object put findcollege-course-assets/courses/neet-full-bundle.zip --file="./path/to/neet-full.zip"
npx wrangler r2 object put findcollege-course-assets/courses/foundation-9-10-bundle.zip --file="./path/to/f910-full.zip"
npx wrangler r2 object put findcollege-course-assets/courses/junior-6-8-bundle.zip --file="./path/to/j68-full.zip"
```

---

## 3. Razorpay Payment Gateway Configuration

### Step 3.1: Get API Keys
1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Navigate to **Settings** → **API Keys**.
3. **For Testing**: Generate Test Keys (`rzp_test_...`).
4. **For Live Production**: Switch to Live Mode and generate Live Keys (`rzp_live_...`).

### Step 3.2: Configure Webhook (Crucial for Zero Payment Loss)
1. In Razorpay Dashboard, go to **Settings** → **Webhooks** → **Add New Webhook**.
2. **Webhook URL:** `https://findcollege.ai/api/razorpay-webhook`
3. **Secret:** Enter a strong secret string (e.g. `fcai_live_webhook_secret_99`).
4. **Active Events:**
   - `order.paid`
   - `payment.captured`
   - `payment.failed`

---

## 4. Resend Transactional Email Setup

1. Sign up at [Resend.com](https://resend.com).
2. Go to **Domains** → Add and verify `findcollege.ai` DNS records (DKIM, SPF).
3. Go to **API Keys** → Generate key (starts with `re_...`).
4. Set sender email (e.g., `FindCollege.ai <courses@findcollege.ai>`).

---

## 5. Meta Pixel Tracking Setup

### Option A: Via Central Config File
Open [js/meta-pixel.js](file:///c:/Users/Hi/OneDrive/Documents/Office%20work/findcollegeai-landing%20pages/course-sell/js/meta-pixel.js) and enter your Pixel ID on line 9:
```javascript
window.FINDCOLLEGE_CONFIG.META_PIXEL_ID = 'YOUR_ACTUAL_PIXEL_ID_HERE';
```

### Option B: Via Cloudflare Environment Variable
Set `META_PIXEL_ID` in Cloudflare Pages Dashboard or `.dev.vars`.

The following events fire automatically:
- `PageView` on page visits.
- `ViewContent` when a course card or details is viewed.
- `Lead` on verified sample submission.
- `InitiateCheckout` on clicking Buy Now.
- `Purchase` on verified payment with deduplication ID.

---

## 6. Admin Portal Setup (`/admin`)

The Admin Portal is accessible at `https://findcollege.ai/admin`.

### Zero Default Passwords & Initial Setup
No hardcoded default passwords exist in this platform for security compliance.

1. On first visiting `/admin`, the portal automatically prompts for **Initial Admin Account Setup**.
2. Enter your desired **Admin Username** and a strong password (minimum 10 characters, including uppercase, lowercase, digit, and special symbol).
3. The password is cryptographically hashed using **PBKDF2-SHA256 (100,000 iterations)** with a unique cryptographic salt.
4. Once created, initial setup locks permanently.

### Option B: Cloudflare Environment Variables (CI/CD Deployment)
If you prefer declaring admin credentials directly in Cloudflare Pages Secrets:
1. Generate the hash:
```javascript
async function genHash(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, baseKey, 256);
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  console.log('ADMIN_PASSWORD_HASH=' + hashHex);
  console.log('ADMIN_SALT=' + saltHex);
}
genHash('YourNewStrongPassword123!');
```
Set `ADMIN_PASSWORD_HASH` and `ADMIN_SALT` in your Cloudflare Pages secrets.

---

## 7. Cloudflare Pages Production Environment Variables

In **Cloudflare Dashboard** → **Workers & Pages** → **findcollege-courses** → **Settings** → **Environment Variables**:

| Variable Name | Type | Description |
| :--- | :--- | :--- |
| `RAZORPAY_KEY_ID` | **Secret** | `rzp_live_...` or `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | **Secret** | Razorpay Private API Secret |
| `RAZORPAY_WEBHOOK_SECRET`| **Secret** | Secret configured in Razorpay Webhook tab |
| `RESEND_API_KEY` | **Secret** | `re_...` API Key |
| `ADMIN_USERNAME` | Text | `admin` |
| `ADMIN_PASSWORD_HASH` | **Secret** | PBKDF2 SHA-256 Hex Hash |
| `ADMIN_SALT` | **Secret** | PBKDF2 Salt Hex String |
| `ADMIN_JWT_SECRET` | **Secret** | 64-char random string for signing cookies |
| `EMAIL_FROM` | Text | `FindCollege.ai <courses@findcollege.ai>` |
| `SUPPORT_EMAIL` | Text | `support@findcollege.ai` |
| `META_PIXEL_ID` | Text | Your numeric Meta Pixel ID |

---

## 8. Deployment Commands

```bash
# 1. Preview locally with Wrangler (Functions, D1 and bindings)
npx wrangler pages dev .

# 2. Deploy to Cloudflare Pages (Production)
npx wrangler pages deploy . --project-name=findcollege-courses --branch=main
```

