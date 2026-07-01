---
name: LegalIQ admin credentials
description: Default admin user seeded into admin_users table; JWT_SECRET is a shared env var.
---

# LegalIQ Admin

Default seeded admin: **admin@restthecase.com** / **Admin@123**

JWT_SECRET: set as shared env var (`JWT_SECRET`). Falls back to hardcoded default in middleware/auth.ts if not set.

Admin panel at `/admin` — JWT token stored in localStorage, expires 24h.

To re-seed or change password: use bcrypt to hash new password, then INSERT/UPDATE admin_users table.
