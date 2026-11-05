# Milonmela (মিলনমেলা) — Event & Alumni Reunion Management Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.4.5-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-blue?style=flat-square&logo=react)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Proprietary-amber?style=flat-square)](#license)

> A production-grade, full-stack alumni reunion and event management system built for the 50-year Golden Jubilee of **Chupair Jamiul Ulum Alim Madrasah**. Engineered to handle high-traffic online registrations, manual mobile payment verification, server-rendered Bengali PDF registration slips, and real-time on-site attendance check-ins.

🌐 **Live Website:** [https://chupairmadrasah.vercel.app](https://chupairmadrasah.vercel.app)  
📦 **GitHub Repository:** [https://github.com/oliullah05/milonmela](https://github.com/oliullah05/milonmela)

---

## Executive Summary

Managing large-scale alumni reunions in Bangladesh presents distinct logistical hurdles: handling manual mobile payments (Nagad/Rocket), ensuring secure TrxID verification without false claims, supporting complex Bengali typography across diverse mobile devices, and executing swift gate check-ins on event day.

**Milonmela** solves these challenges through an end-to-end platform featuring:
- **Participant Portal:** Frictionless mobile-first registration, automated photo compression, permanent status links, and verifiable PDF slip generation.
- **Organizer Administration:** Real-time analytics of confirmed funds, atomic payment auditing, single-click gate check-in via search or device camera QR scanning, and dynamic event controls.

---

## System Architecture & Key Engineering Highlights

### 1. Atomic Collision-Free Sequential IDs
Rather than exposing raw MongoDB ObjectIDs or creating race conditions under simultaneous submissions, registrations are allocated sequential numeric identifiers starting at `500` using atomic MongoDB `$inc` pipelines on an isolated counter document (`registration-numeric`).

### 2. Optimistic Concurrency Control (OCC)
In multi-admin environments where multiple committee members review applications simultaneously, every student document maintains an atomic `revision` counter. State mutations (Approval, Rejection, Correction) verify that the record hasn't changed since it was loaded, preventing silent overwrites.

### 3. Server-Rendered Bengali PDF Engine
Complex South Asian scripts (specifically Bengali conjuncts, *juktakkhor*, and vowel signs) frequently break when rendered on client-side canvas or standard PDF engines. Milonmela renders slips server-side using `@react-pdf/renderer` paired with `sharp` and locally bundled **Noto Sans Bengali** (SIL Open Font License). Bengali glyph runs are rasterized at 288 DPI to ensure typographic accuracy while keeping English registration metadata selectable and searchable.

### 4. Zero-Friction Gate Attendance & Camera Scanner
On event day, gate volunteers can locate attendees instantly through a debounced real-time search (by name, mobile, registration ID, or TrxID) and mark attendance in **one tap**. Alternatively, volunteers can launch the built-in camera scanner, which leverages the browser-native `BarcodeDetector` API with an automated `jsQR` software decoding fallback. Every check-in captures an immutable audit timestamp and administrator attribution in Asia/Dhaka time.

### 5. Multi-Layer Security & Privacy
- **Stateless Double JWT Authentication:** 15-minute access and 7-day refresh tokens delivered strictly through `HttpOnly`, `SameSite=Strict`, `Secure` cookies.
- **CSRF & Origin Verification:** Mutation endpoints inspect request origin and enforce Zod schema validation.
- **Rate-Limiting:** Distributed IP-based rate limiting backed by MongoDB TTL expiration protects login and public lookups against brute-force attacks.
- **Privacy-Preserving QR:** The verification QR encodes a random 256-bit cryptographic token URL—never exposing personal telephone numbers or addresses on the printed paper.
- **Formula Injection Mitigation:** CSV exports automatically sanitize and escape spreadsheet formula triggers (`=`, `+`, `-`, `@`).

---

## Routes & Endpoints

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | **Event Landing:** Live countdown timer, campus hero visual, event schedule, and payment details. |
| `/register` | Public | **Registration Portal:** Form submission, photo upload, payment selection (Nagad/Rocket), and TrxID entry. |
| `/status` | Public | **Status Lookup:** Search by Mobile Number or Registration ID; download verified PDF registration slip. |
| `/login` | Public | **Admin Authentication:** Secure portal for committee administrators. |
| `/admin` | Admin | **Executive Dashboard:** Live confirmed funds (BDT), total registrations, pending reviews, verified payments. |
| `/admin/students` | Admin | **Participant Directory:** Real-time search, batch/payment filters, modal detail view, 1-click approvals, and CSV export. |
| `/admin/attendance` | Admin | **Gate Check-in:** Real-time student search, instant attendance toggle, and integrated camera QR scanner. |
| `/admin/settings` | Admin | **System Settings:** Registration toggle, auto-calculated midnight deadline override, event date/time, and Hijri date. |
| `/verify/[token]` | Public / Admin | **QR Verification:** Public privacy-safe verification page; allows logged-in admins to check in attendees directly. |

---

## User Workflows (How to Proceed)

### A. Participant & Alumni Journey

```
[ Visit Homepage ] ➔ [ Send Payment (Nagad/Rocket) ] ➔ [ Submit Registration ] ➔ [ Receive ID & Link ] ➔ [ Admin Verification ] ➔ [ Download Slip ] ➔ [ Event Gate Check-in ]
```

1. **Review Event Information:**  
   Alumni visit `/` to check event schedule, venue, registration fee (**BDT 200**), and live countdown.
2. **Transfer Registration Fee:**  
   The participant transfers BDT 200 via Nagad or Rocket **Send Money** to the official committee wallet (`+880 1812-945767`) and copies the Transaction ID (TrxID).
3. **Complete Registration Form (`/register`):**  
   - Enter full name, Dakhil completion batch, mobile number, blood group, address, and an optional profile photo (automatically compressed client-side).
   - Select payment method, enter TrxID, and submit the application.
4. **Instant Confirmation & Saved Link:**  
   Upon submission, the applicant is assigned a unique numerical registration number (e.g., `501`) and given a shareable tracking link (`/status?id=501`).
5. **Status Tracking & PDF Download (`/status`):**  
   Once the admin verifies the transaction, the status updates to **Verified & Approved**, unlocking the official digital PDF Registration Slip equipped with an anti-counterfeit QR code.

---

### B. Administrator & Committee Operations

1. **Log in (`/login`):**  
   Sign in using administrator credentials. Sessions are securely governed by HttpOnly cookies.
2. **Monitor Dashboard (`/admin`):**  
   Review confirmed revenue collection (BDT), total applicant counts, pending transactions, and current attendance numbers.
3. **Verify Payments (`/admin/students`):**  
   - Search applicants in real time or filter by Batch, Payment Status, or Attendance.
   - Click any applicant card to open the detail modal dialog.
   - Match the TrxID with the mobile money statement and click **"যাচাই ও অনুমোদন করুন" (Verify & Approve)**. Approval is granted atomically alongside payment verification.
   - If information is incorrect, the admin can flag it as **"Correction Required"**, allowing the participant to update their TrxID via `/status`.
   - Export filtered lists to Excel/CSV with one click.
4. **Event Day Check-in (`/admin/attendance`):**  
   - Gate volunteers enter the applicant's registration number or mobile number to see their profile instantly.
   - Click **"Mark as Attended"** to record check-in with timestamp and admin attribution.
   - Alternatively, tap **"ক্যামেরায় QR স্ক্যান করুন" (Scan QR)** to scan attendee slips directly using any smartphone camera.
5. **Manage Settings (`/admin/settings`):**  
   - Close or reopen registrations instantly with a single toggle.
   - The system automatically closes registrations at midnight at the beginning of the event date (`Asia/Dhaka`). Organizers can manually override deadlines when needed.

---

## Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Server-side rendering, Turbopack bundling, server actions, and route handlers. |
| **UI Library** | React 19 | Modern hooks, concurrent rendering, and clean declarative components. |
| **Database** | MongoDB Atlas & Mongoose 9 | Flexible document modeling, atomic counter increments, and TTL indexes. |
| **Media Storage** | Cloudinary API & Sharp | Cloud media delivery, server-side MIME/magic-byte validation, and high-DPI image processing. |
| **PDF Generation**| `@react-pdf/renderer` & HarfBuzz | Programmatic vector PDF slip generation with localized Bengali typography. |
| **QR Code** | `qrcode` & `jsqr` | Cryptographic QR generation and fallback client-side camera barcode decoding. |
| **Security** | `jsonwebtoken`, `bcryptjs`, `zod` | Robust stateless auth, cryptographically salted passwords, and strict schema validation. |
| **Styling** | Vanilla CSS + Tailwind v4 | Handcrafted, touch-first responsive design without bulky runtime component overhead. |

---

## Environment Variables

Configure the following environment variables in a root `.env` file (refer to `.env.example`):

```env
# MongoDB Connection String
MONGODB_URI="mongodb+srv://<username>:<password>@cluster.mongodb.net/milonmela?retryWrites=true&w=majority"

# JWT Authentication Secret (Minimum 32 characters random string)
AUTH_SECRET="your_cryptographically_secure_random_string_min_32_chars"

# Cloudinary Storage Credentials
CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"
```

---

## Local Setup & Development

### Prerequisites
- Node.js `22.13.0+` or `24 LTS`
- npm `10+`
- A running MongoDB Atlas instance

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/oliullah05/milonmela.git
cd milonmela

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your MongoDB URI, AUTH_SECRET, and Cloudinary keys

# 4. Start local development server
npm run dev
```

Visit [http://localhost:3100](http://localhost:3100) in your browser.

### Production Build

```bash
# Build the optimized production application
npm run build

# Start the production server
npm start
```

---

## Deployment (Vercel)

This application is optimized for deployment on [Vercel](https://vercel.com):

1. Push your code to GitHub.
2. Import the repository in your Vercel Dashboard.
3. Configure the **Environment Variables** (`MONGODB_URI`, `AUTH_SECRET`, `CLOUDINARY_*`).
4. Deploy. Vercel automatically detects the Next.js App Router configuration and deploys serverless functions with worldwide edge caching.

---

## License

This project was developed for the 50th Golden Jubilee & Alumni Reunion 2027 of **Chupair Jamiul Ulum Alim Madrasah**. All rights reserved.
