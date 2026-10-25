# Achievers Study Point

Study-hall management system: student registration with email + WhatsApp OTP, admin approval and seat allotment
(115 seats, Morning/Evening/Full-day shifts), fees, attendance, seat map, Excel/PDF export, and a super admin
(developer) who adds or removes admins.

## Folders
- `server/`    Node.js, Express, MongoDB (Mongoose), JWT, bcrypt, Nodemailer, WhatsApp Cloud API, ExcelJS, PDFKit
- `client/`    React 18 + Vite
- `prototype/` The complete single-file demo page you were testing (all features, browser storage only)

## Run locally
1. Install Node 18+ and MongoDB (or use a free MongoDB Atlas URI).
2. Backend
   ```
   cd server
   npm install
   cp .env.example .env      # fill in MONGO_URI, JWT_SECRET, SMTP_*, WA_*, SUPER_*
   npm run seed              # creates the super admin (developer)
   npm run dev               # http://localhost:5000
   ```
3. Frontend (second terminal)
   ```
   cd client
   npm install
   npm run dev               # http://localhost:5173 (proxies /api to :5000)
   ```

## Roles
- **Student**: registers, verifies email + WhatsApp OTP, waits for approval, then logs in (seat, fee, check-in, seat map).
- **Admin**: approves registrations and allots seats, changes or swaps seats, marks fee and attendance, resets passwords, exports Excel/PDF.
- **Super admin (developer)**: everything an admin does, plus add, delete admins.

## Notes before going live
- WhatsApp Cloud API needs a verified Meta business account. OTPs and other business-initiated messages must use an approved message template. Enter the approved template name in the admin panel under Messages; the wording itself is changed in Meta Business Manager and re-approved.
- The admin panel's Messages tab edits the Terms & Conditions alert and the approval, password-reset and OTP texts (stored in MongoDB, collection `settings`).
- Run the API behind HTTPS and set a long random `JWT_SECRET`. Change the seeded super admin password.
- Seat allotment checks and saves in two steps. For heavy simultaneous use, wrap approve and seat-change in a MongoDB transaction.
- Back up the database weekly with a cron job, for example `mongodump --uri "$MONGO_URI" --out /backups/$(date +%F)`.

## Features in this version
Registration with email + WhatsApp OTP, admin approval and seat allotment, seat map, fees with months-pending count, attendance,
fee receipts (PDF), student ID card (PDF, QR holds the ID number only), feedback and complaints box, admin password reset (temporary password sent on WhatsApp, the student is asked to change it after logging in),
public home page (manager's message and photo, facilities, contact with embedded map and social icons, all editable from the admin panel), notice board and WhatsApp notice sender, study tracker with streak and monthly leaderboard, editable messages and T&C alert,
Excel and PDF export, super admin for managing admins, weekly automatic backup (Sundays 3 AM, latest 12 kept in `server/backups`)
with a restore screen. Backup and restore are super-admin only because the data includes password hashes.

## Still only in the prototype
The door QR check-in. It is in `prototype/achievers-study-point.html`.

## WhatsApp notes
OTPs, notices and approval messages are business-initiated, so in production they must be sent as templates approved by Meta.
The notice sender uses plain text, which only reaches students who messaged your number in the last 24 hours; switch it to a
template message (see `sendWaTemplate` in `server/src/notify.js`) before relying on it.
