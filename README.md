# Server Embassy API

Node.js + **Express 5** + **TypeScript** + **MongoDB** + **Mongoose**.

REST backend for `serverembassy-web` and `serverembassy-admin`. Built for **50k+ SKUs** with text search, paginated listings, indexed SKU/slug fields, and bulk import.

## Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 20+ |
| HTTP | Express 5 |
| Language | TypeScript |
| Database | MongoDB |
| ODM | Mongoose |
| Auth | JWT (staff) |
| Validation | Zod |

## Setup

```bash
cp .env.example .env
# Set MONGODB_URI and JWT_SECRET

npm install
npm run db:seed   # optional demo data
npm run dev       # http://localhost:4000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run production build |
| `npm run db:seed` | Seed admin, brands, categories, sample products |

## API overview

### Public (storefront) — `/api/store/*`

- `GET /products` — paginated catalog (`?q=`, `?category=`, `?brand=`, `?page=`)
- `GET /products/:slug`
- `GET /categories`, `/brands`, `/banners`, `/settings`, `/pages`
- `POST /api/checkout` — place order
- `POST /api/quotes` — RFQ form
- `POST /api/newsletter`

### Auth — `/api/auth/*`

#### Staff
- `POST /login` → JWT
- `GET /me` — current staff user

#### Customers (storefront account)
- `POST /register` — create customer account (bcrypt-hashed, unique email)
- `POST /customer/login` → JWT (`type: "customer"`)
- `GET /customer/me` — current customer profile
- `GET /api/store/me/orders` — authenticated customer order history (paginated)

Customer tokens are `Bearer` tokens with `JwtPayload.type = "customer"`; staff tokens stay `type = "staff"` and are required for `/api/admin/*` (scoped further by role).

### Admin — `/api/admin/*` (Bearer token)

- Dashboard, products CRUD, bulk import
- Categories, brands, orders, quotes, customers
- Store settings, banners, CMS pages

All admin mutations are **role-scoped** and **Zod-validated**:

| Resource | Allowed roles |
|----------|---------------|
| Products / categories CRUD | super_admin, admin, catalog |
| Brands CRUD | super_admin, admin, catalog |
| Banners / CMS pages | super_admin, admin, content |
| Order status / shipments | super_admin, admin, finance |
| Quotes status / customers tax-exempt | super_admin, admin, sales |
| Store settings | super_admin, admin |

Unscoped list/read endpoints require any staff token.

## Scalability

- Compound indexes on `sku`, `slug`, `status`, `categoryId`, `brandId`
- MongoDB text index on product title/SKU/description
- Paginated queries (max 100/page)
- Bulk upsert by SKU for CSV imports
- Layered architecture: routes → services → models

## Default admin (after seed)

```
Email: admin@serverembassy.com
Password: admin123
```

## Project layout

```
serverembassy-api/
├── src/
│   ├── config/       # Env validation
│   ├── models/       # Mongoose schemas
│   ├── services/     # Business logic
│   ├── routes/       # Express routers
│   ├── middleware/   # Auth, validation, errors
│   ├── lib/          # DB, JWT helpers
│   ├── app.ts
│   ├── index.ts
│   └── seed.ts
├── package.json
└── .env.example
```

## Reliability & security notes

- **Checkout is atomic per line item** — stock is decremented with a guarded `$inc` (`stock >= qty`) and rolled back if order creation fails, so failed orders don't leak inventory.
- **Order numbers** are generated from an atomic `Counter` collection (`SE-1001`, `SE-1002`, …), safe under concurrency and never reused after deletions.
- Customer `register`/`login`/`me` + authenticated `GET /store/me/orders`.
- Admin mutations are role-gated and Zod-validated (see table above).

## Next steps

1. Add Stripe/Authorize.net payment webhooks (advance `paymentStatus` to `paid`)
2. Add S3/Cloudinary for product image uploads
3. Add forgot-password / email verification for customer accounts
