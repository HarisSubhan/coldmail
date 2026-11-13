# Version 7 — two-stage extraction update

This archive is a complete standalone JavaScript application: React frontend, Express backend and MySQL migrations. No external email-generation API key is required; the built-in writer remains enabled.

## Updating an existing installation
1. Back up your MySQL database and uploads folder.
2. Extract this archive into a NEW folder, not over your old installation. Copy your existing private `.env` and `uploads` into it. Do not copy `node_modules` or `dist`.
3. Run `npm install`, then `npm run db:migrate`. Migration is repeatable and preserves existing rows. The migration account needs CREATE TABLE, ALTER and TRIGGER permissions.
4. Run `npm run build`, then restart with `npm start` (entry file: `server/index.js`).
5. Hard-refresh your browser. Download the extension from Lead Finder, replace its unpacked folder, then click Reload at `chrome://extensions`.
6. Use HTTPS and reconnect using a fresh connect code if your domain changed.

## Included changes
- Extension v1.3.1 runs in two stages: first it scrolls the Google Maps results to the end and queues every business on your server, then it opens each queued business one by one. Each business has its own status (pending, processing, completed, partial, failed) and failed or partial ones can be retried with one button.
- Exact search: Google Maps receives your keyword exactly as typed. The city is only a label on saved leads; area codes add one extra search each, and the page shows the exact searches before you start.
- No default result cap: every discovered business is collected unless you set a maximum or the Super Admin sets one. Searches run in their own Chrome window that must stay visible (not minimised) so Google Maps keeps loading results.
- Richer business details: rating, review count, open status, opening hours, Google Place ID and map location, alongside phone, website and address. These appear on each lead and in CSV/Excel exports. Businesses already in your CRM get empty fields filled in instead of duplicates.
- Live counters per search: discovered, queued, completed, processing, pending, partial, failed, plus phones, emails and websites found. A search only shows as finished when nothing is left pending.
- Super Admin Monitoring & Logs with real counts, date/user filters, extraction/campaign records and append-only activity history. Admin password resets and account actions are logged without password values.
- Database row logs begin after migration; older actions cannot be reconstructed. Trigger actor is shown as Server action; explicit admin action records identify the admin.

## Verification and limits
Frontend build, database migrations and standalone sign-in/monitoring flows are checked locally. Extension fixture tests cover all 150 virtualized cards and interrupted upload recovery; live Google Maps execution and delivery through your SMTP provider remain unverified. No guarantee of every business in a city, complete contact data, or bypassing provider restrictions. Use data only as permitted by applicable terms and law. Browser-driven sending and manual reply recording remain unchanged; always-on sending, automated inbound replies and full provider/server telemetry are not included.

---

# Origami99 — AI Email Outreach (Node.js + MySQL edition)

One Node.js app serves both the website (React) and the API (Express), backed by MySQL.

```
origami99/
├── database/schema.sql    MySQL tables + starter plans + settings
├── scripts/migrate.mjs    creates the tables (npm run db:migrate)
├── scripts/create-admin.js creates the Super Admin (npm run create-admin)
├── server/                Express API: auth (JWT + bcrypt), data access with per-user isolation,
│   ├── db.js              campaigns, AI, SMTP sending, admin, logo uploads
│   └── functions/         business logic (admin, ai, sending, plans)
├── src/                   React frontend (TanStack Router + Tailwind)
└── .env.example           settings to copy into .env
```

Requirements: Node.js 20+, MySQL 8.0+ (or MariaDB 10.6+), a domain pointing to the VPS.

---

## Deploy on a Hostinger VPS (Ubuntu 22.04/24.04)

Connect with SSH (hPanel → VPS → Overview → SSH access): `ssh root@YOUR_VPS_IP`

### 1. Install Node.js, MySQL, Nginx, PM2
```bash
apt update && apt -y upgrade
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt -y install nodejs mysql-server nginx unzip
npm install -g pm2
```

### 2. Create the database
```bash
mysql -u root
```
```sql
CREATE DATABASE origami99 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'origami99'@'127.0.0.1' IDENTIFIED BY 'A_STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON origami99.* TO 'origami99'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Upload and install the app
Upload `origami99.zip` to `/var/www/` (hPanel file manager, or `scp origami99.zip root@IP:/var/www/`), then:
```bash
cd /var/www && unzip origami99.zip && cd origami99
cp .env.example .env
nano .env          # fill DATABASE_URL, PUBLIC_URL, JWT_SECRET, SMTP_ENCRYPTION_KEY
openssl rand -hex 32   # run twice; paste into JWT_SECRET and SMTP_ENCRYPTION_KEY
npm install
npm run build
npm run db:migrate
npm run create-admin -- origami99.agency@gmail.com "YourStrongPassword" "Origami99 Admin"
```

### 4. Start it and keep it running
```bash
pm2 start npm --name origami99 -- start
pm2 save && pm2 startup
```
Check: `curl http://localhost:3000` should return HTML. Logs: `pm2 logs origami99`.

### 5. Nginx + free SSL
`/etc/nginx/sites-available/origami99`:
```nginx
server {
  server_name yourdomain.com www.yourdomain.com;
  client_max_body_size 10m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
  }
}
```
```bash
ln -s /etc/nginx/sites-available/origami99 /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
apt -y install certbot python3-certbot-nginx && certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
In hPanel → Domains → DNS, point an `A` record for your domain to the VPS IP.

### Updating later
```bash
cd /var/www/origami99 && unzip -o ../origami99-new.zip -x .env && npm install && npm run build && pm2 restart origami99
```
Uploaded logos live in `uploads/` — keep that folder and `.env` when updating.

---

## Settings (.env)
| Key | What it is |
|---|---|
| `DATABASE_URL` | `mysql://USER:PASSWORD@127.0.0.1:3306/origami99` |
| `PUBLIC_URL` | Your site address, e.g. `https://origami99.com` (used for logo links and reset emails) |
| `JWT_SECRET` | Random 64-char string; signs login sessions |
| `SMTP_ENCRYPTION_KEY` | Random 64-char string; encrypts users' SMTP passwords. **Never change it** after users save SMTP settings |
| (no AI key needed) | Emails are written by the built-in Origami99 writer on your own server — no OpenAI, no cost. |
| `SYSTEM_SMTP_*` | Mailbox that sends "forgot password" emails (e.g. a Hostinger email account) |

## Local development
```bash
npm install && cp .env.example .env   # set DATABASE_URL to a local MySQL
npm run db:migrate && npm run create-admin -- you@x.com "password123"
npm run dev    # site on http://localhost:5173, API on :3000
```

## Notes
- Every user's data (leads, campaigns, emails, logs, replies, SMTP) is isolated on the server; the browser can never read another account's rows or SMTP passwords.
- Campaign sending runs while the campaign page is open in the browser (same as before). Reply tracking is manual logging + AI suggestions; AI replies are never sent without approval.
- Hostinger VPS allows outgoing SMTP; if port 25/465/587 is blocked, open it in hPanel → VPS → Firewall.

## Account lifecycle (v2)
- The Super Admin is a separate account with its own console (Dashboard, Subscription Users, Plans & Pricing, Platform Settings, Account Settings). It never sees user pages and is not listed among subscription users.
- Creating a subscription user requires a start and end date.
- After the end date the account is **on hold**: sign-in shows an "Account on hold" screen and the API refuses all data access. The Super Admin restores access by clicking **Renew** and setting a new end date.
- The status switch pauses/reactivates an account; the bin icon deletes it.
- Active plans in **Plans & Pricing** are shown on the homepage pricing section.

## Hostinger Node.js (Express) app settings
- Framework preset: Express · Node version: 20.x or newer
- Package manager: npm
- Build command: `npm run build`
- Entry file: `server/index.js`
- Add the variables from `.env.example` under Environment Variables.

## v5 upgrade: Lead Finder, CRM, writing styles

- Existing install: upload the new files (keep your `.env`), then run `npm install` and `npm run db:migrate`. The migrate script adds the new tables and columns safely without touching your data.
- Lead Finder: users download the Chrome extension from the Lead Finder page, click **Get connect code** and paste that single code in the extension. The code already contains your website address.
- Your site must be reachable over HTTPS for the extension to connect.
