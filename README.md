# SafeHub Fire Extinguisher Management System

SafeHub is a microservice-oriented fire extinguisher compliance platform. A company can register customer purchases, track expiry dates, send in-app and email reminders, and automatically notify police when an overdue notice remains ignored past the configured grace period.

## Stack

- Backend: Node.js, TypeScript, Express, PostgreSQL, JWT, Zod, Nodemailer, Pino, Swagger UI
- Frontend: React, Vite, Redux Toolkit, React Context, Tailwind CSS
- Runtime: Docker Compose with one PostgreSQL server and separate domain databases

## Services

| Service | Port | Responsibility | Swagger |
| --- | --- | --- | --- |
| API gateway | `4000` | Single browser-facing API origin and health aggregation | `http://localhost:4000/docs` |
| Auth service | `4001` | Signup, login, JWT identity, role accounts | `http://localhost:4001/docs` |
| Inventory service | `4002` | Customers, equipment, in-app alerts, reports, audit logs | `http://localhost:4002/docs` |
| Notification service | `4003` | Scheduled expiry scan and email delivery logs | `http://localhost:4003/docs` |
| React frontend | `5173` | Responsive role-aware application | `http://localhost:5173` |

The services use separate `fems_auth`, `fems_inventory`, and `fems_notification` databases. The notification worker communicates with inventory through an internal secret and the frontend accesses services through the gateway.

## Roles

| Feature | ADMIN | STAFF | POLICE | CUSTOMER |
| --- | --- | --- | --- | --- |
| Dashboard and visible equipment | Yes | Yes | Yes | Own records |
| Register customers and purchases | Yes | Yes | No | No |
| Manage role accounts | Yes | No | No | No |
| View police reports | Yes | Yes | Yes | No |
| Update police report status API | Yes | No | Yes | No |
| View audit logs | Yes | Yes | No | No |
| Maintain own contact profile | No | No | No | Yes |

Public signup always creates a `CUSTOMER`. The bootstrap administrator creates trusted staff, police, and additional administrators from the **User accounts** screen.

## Run With Docker

1. Create the local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Replace `JWT_SECRET`, `INTERNAL_SECRET`, and `ADMIN_PASSWORD` in `.env`.

3. Start the stack:

   ```powershell
   docker compose up --build
   ```

4. Sign in with the configured `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

PostgreSQL runs `database/init.sql` only when the database volume is first created. For a development-only database reset, stop the stack and remove its Compose volume before starting it again.

## Run Locally

Start PostgreSQL. On Windows, initialize or update the three databases with:

```powershell
powershell -ExecutionPolicy Bypass -File .\database\setup-windows.ps1
```

Then run:

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run build
npm.cmd run dev:auth
npm.cmd run dev:inventory
npm.cmd run dev:notification
npm.cmd run dev:gateway
npm.cmd run dev:frontend
```

Run each `dev:*` command in its own terminal.

## Expiry Workflow

The notification worker uses `SCAN_CRON` (`0 8 * * *` by default) and can also be triggered from the admin or staff dashboard.

1. Expiring equipment receives an `EXPIRY_WARNING` within `EXPIRY_WARNING_DAYS`.
2. On or after expiry, inventory changes the unit status to `EXPIRED` and creates an `EXPIRY_OVERDUE` alert.
3. Alerts appear in the customer portal and are sent by email.
4. If the overdue alert stays unread for `ESCALATION_GRACE_DAYS`, SafeHub creates a police report, adds a police in-app notification, and emails `POLICE_CONTACT_EMAIL`.

When SMTP variables are blank, the notification service uses Nodemailer's JSON transport and records `PREVIEW` deliveries. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` for real email.

## Security Notes

- JWT is required for protected routes and role middleware applies authorization inside each service.
- Public signup cannot select a privileged role.
- Passwords are hashed with bcrypt.
- Helmet, CORS allowlists, JSON size limits, input validation, pagination limits, and rate limits are enabled.
- Internal worker endpoints require `x-internal-secret`.
- Important activity is retained in `audit_logs`; email delivery attempts are retained in `email_logs`.

Use long random secrets and replace bootstrap credentials before deploying. Put the gateway behind TLS in production.
