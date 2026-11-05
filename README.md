# মিলনমেলা — Madrasah Alumni Reunion

A Bengali-first Next.js App Router application for the 50-year reunion of Chupair Jamiul Ulum Alim Madrasah. Node.js 22.13+ or 24 LTS recommended.

## Run

Install dependencies with `npm ci`, configure the environment, and run `npm run dev`. For production, run `npm run build` then `npm start`. Use a Node.js host with HTTPS; this application is not a static export.

Required server environment variables:

- `MONGODB_URI`: MongoDB connection URI for the reunion database.
- `AUTH_SECRET`: cryptographically random secret with at least 32 characters. Keep stable across replicas; rotating it revokes sessions.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: server-side image storage credentials.

Never commit `.env` or credentials. Public Cloudinary upload presets are not used. The supplied environment has been preserved and a random authentication secret added. The requested initial administrator was created directly in MongoDB with a bcrypt hash, without a seed script. Its email is `motahar033@gmail.com`. Use the initial password supplied separately in the PRD, then change it under Account Security. No plaintext initial password is stored in application source.

## Routes and operation

- `/`: event landing page, countdown and payment instructions.
- `/register`: registration, optional compressed image, manual Nagad/Rocket payment details.
- `/status`: mobile or registration-ID lookup; pending/rejected/correction status; approved PDF download.
- `/login`: administrator authentication.
- `/admin`: server-authorized dashboard, paginated search and filters, application editing, manual payment decisions, approval/rejection, attendance, CSV export, event settings and password change.
- `/verify/[token]`: privacy-limited public verification; authenticated administrators can check in.

The registration fee is fixed at BDT 200. Both payment methods use +8801812945767. Sender mobile is optional. Payments are never verified automatically. The administrator must explicitly confirm the real transaction ID and exactly BDT 200 before verifying. Verifying a payment atomically approves the application; there is no separate approval action. Only an approved application with verified payment permits a PDF. Before attendance, rejecting or requesting payment correction revokes approval and PDF access and removes the amount from confirmed collections. Attendance locks all further payment decisions. Corrections are available only when the administrator sets `correction_required`; the public lookup grants a short-lived HttpOnly correction/download session.

Event defaults: 15 August 2027 at 10:00 Asia/Dhaka. Registration closes at midnight at the beginning of that date, recalculated from the event date on every submission. The admin toggle can close earlier. Reopening after the deadline requires the explicit override checkbox. The Hijri date is provisional and must be confirmed by organizers.

## Persistence and security

Mongoose collections: `students` (application with embedded payment details), `admins`, `settings`, `counters`, `limits`. UTC timestamps are rendered in Asia/Dhaka. Atomic counters assign immutable registration numbers; sequence gaps are expected for failed requests. Unique indexes protect mobile, registration number, verification token, administrator email, and verified method/transaction pairs. Attendance uses one conditional atomic update, preserving the first check-in time. Optimistic revisions prevent overlapping administrator decisions from silently overwriting one another.

Authentication uses 15-minute access and 7-day refresh JWTs in HttpOnly, SameSite Strict cookies, with Secure cookies in production. Server-side authorization protects pages and API operations. Password change invalidates other sessions. Mutation endpoints check Origin, validate with Zod, and reject inappropriate HTTP methods. Rate limits persist in MongoDB with TTL cleanup. Configure your reverse proxy to overwrite `X-Forwarded-For` with the actual client IP; never trust a client-provided forwarding header. Serve behind HTTPS for production cookies and camera access. Cloudinary uploads have server-side size, MIME and magic-byte checks. CSV cells are quoted and formula-leading content escaped.

The Bengali font is locally bundled Noto Sans Bengali under the SIL Open Font License in `public/fonts/OFL.txt`. PDF generation runs server-side using React PDF, with a QR code and Bengali text shaped by Pango/HarfBuzz using the locally bundled font. Bengali runs are embedded as 288-dpi graphics to preserve conjuncts and vowel marks reliably; English registration details remain selectable text. Sharp must be installed with its platform-native optional dependencies. The QR contains a random 256-bit token URL, with no phone or other personal data. The camera scanner uses native BarcodeDetector with a jsQR fallback. Physical camera/device behavior still needs an event-device check.

## Verification

No testing libraries or frameworks are installed. Verified using a production build, ESLint, a live MongoDB/Cloudinary workflow with disposable records, and browser layout inspection. Checks covered optional sender omission, duplicate mobile prevention, pending PDF denial, approval before verification denial, incorrect amount denial, correct payment verification, approval, Bengali PDF generation and visual rendering, public QR privacy, duplicate attendance idempotence, filtered CSV export, unauthenticated API denial, GET mutation denial, successful image upload and fake-image rejection. Temporary records and uploaded images were removed.

Before launch: use a production database with backups and least-privilege credentials, confirm the event and Hijri dates, change the initial password, set your domain/HTTPS and reverse proxy, and check camera scanning plus PDF downloads on the phones used at the venue. No public deployment has been configured by this repository.

## Mobile-first payment approval update

The dashboard leads with total confirmed money and verified participant count. Mobile administration uses fixed bottom navigation, applicant cards, collapsible advanced filters and a full-screen review panel; desktop retains its table. Inputs and labels are 16px, supporting text is at least 14px, and primary touch controls are at least 48px. Payment decisions refresh the record, listing and confirmed collection totals together.

For an existing database, run `node --env-file=.env scripts/reconcile-payment-approvals.mjs` before serving the updated app. This idempotently aligns legacy Verified payments with Approved applications while preserving registration numbers and first attendance timestamps. The configured database has been reconciled.

## Registration numbers and public notices

New registrations use plain numeric identifiers beginning with `500`, allocated atomically from the separate `registration-numeric` counter. Existing REU identifiers remain unchanged. The production numeric counter is not initialized or incremented by verification; numbering was checked in an isolated temporary database. Numeric identifiers work with PDF filenames, admin search, exports and check-in. Sequence gaps can occur for failed submissions after allocation.

The settings response includes derived `registrationAutoCloseAt` (UTC ISO timestamp) and `closedReason` (`manual`, `deadline` or `null`). Status and closure cards use large readable layouts; mobile or registration-ID lookup, correction permissions and approved-only PDF authorization remain unchanged.

## Saved status links

Registration success and status results display a copyable `/status?id=501` link. Status lookup accepts a registration number (including legacy REU numbers) or a valid Bangladeshi mobile number. Opening the link automatically fills the field and loads the result; refresh works without browser-storage handoff. The alternate `?id+501` spelling is accepted and normalized. QR verification tokens remain separate, and PDF downloads still require an approved application with verified payment. No status-token scheme is used.
