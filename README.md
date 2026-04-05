# Amata NexusOS

> Production-grade retail POS and warehouse management system with offline-first capabilities, multi-branch support, Ghana GRA compliance, hardware integration, expiry management, AI/ML intelligence, and DevOps features.

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/Node-20+-green" alt="Node">
  <img src="https://img.shields.io/badge/License-Proprietary-red" alt="License">
</p>

---

## Overview

Amata NexusOS is a comprehensive Point of Sale (POS) and Warehouse Management System designed for retail operations in Ghana and West Africa. The system is built with enterprise-grade architecture featuring offline-first capabilities, multi-branch support, full Ghana Revenue Authority (GRA) tax compliance, and advanced features including AI-powered anomaly detection and DevOps tooling.

### Core Features

- ✅ **Offline-First** - Mobile app works without internet, syncs when connected
- ✅ **Multi-Branch** - Manage unlimited branches from single dashboard  
- ✅ **GRA Compliant** - Automatic VAT (15%), NHIL (2.5%), GETFund (2.5%) breakdown
- ✅ **Real-time Sync** - Automatic data synchronization across all devices
- ✅ **Hardware Support** - Thermal printers, barcode scanners, label printers
- ✅ **Payment Integration** - Paystack (Card) + MTN MoMo support
- ✅ **Modern UI** - Beautiful web admin with responsive design
- ✅ **AI/ML Intelligence** - Isolation Forest anomaly detection, stock prediction
- ✅ **DevOps Features** - Feature flags, canary deployments, automated rollback

---

## Architecture

```
amata-nexusos/
├── apps/
│   ├── api/          # Hono.js REST API (Node 20)
│   ├── web/          # Next.js 14 Admin Dashboard
│   └── mobile/       # Expo React Native (iOS/Android)
├── packages/
│   ├── db/           # Prisma ORM + PostgreSQL (25+ models)
│   ├── auth/         # JWT authentication + RBAC
│   ├── cache/        # Redis layer (sessions, rate limits)
│   ├── sync/         # Offline sync engine + conflict resolution
│   ├── payments/    # Paystack + MTN MoMo + reconciliation
│   ├── printing/    # ESC/POS receipt builder + print queue
│   ├── queue/        # BullMQ workers
│   ├── types/        # Shared TypeScript types + Zod schemas
│   ├── hardware/     # Barcode/QR generation
│   ├── governance/   # Immutable audit logs + retention policies
│   ├── intelligence/ # Stock prediction + expiry risk scoring
│   └── ops/          # Feature flags + canary deployments
├── infra/
│   └── docker/      # Docker Compose
└── .github/
    └── workflows/    # CI/CD pipelines
```

---

## Technology Stack

| Layer | Technology |
|-------|-------------|
| **Monorepo** | Turborepo + pnpm |
| **API** | Hono.js (Node 20) |
| **Database** | PostgreSQL 15 + Prisma |
| **Cache** | Redis 7 |
| **Web** | Next.js 14 + Tailwind + shadcn/ui |
| **Mobile** | Expo React Native + SQLite |
| **Queue** | BullMQ |
| **Payments** | Paystack, MTN MoMo |
| **Observability** | Prometheus, Grafana |

---

## Quick Start (Local Development)

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 8
- Docker + Docker Compose

### 1. Clone and Install

```bash
git clone https://github.com/amata-tech/nexusos
cd nexusos
pnpm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your settings:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexusos_dev
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=<64-char-random-string>
# JWT_REFRESH_SECRET=<different-64-char-string>
```

### 3. Start Infrastructure

```bash
docker compose -f infra/docker/docker-compose.yml up -d
# Starts: PostgreSQL, Redis, Prometheus, Grafana
```

### 4. Database Setup

```bash
pnpm db:generate     # Generate Prisma client
pnpm db:migrate      # Run migrations
pnpm db:seed         # Seed demo data
```

### 5. Run Development Servers

```bash
pnpm dev
```

### Service URLs

| Service | URL |
|---------|-----|
| API | http://localhost:3001 |
| Web Admin | http://localhost:3000 |
| Grafana | http://localhost:3003 |
| Prometheus | http://localhost:9090 |

### Demo Credentials

```
Admin:    admin@amata.com / password123
Cashier: cashier@amata.com / password123
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Email + password login |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate session |
| GET | `/auth/me` | Current user info |
| POST | `/auth/pin/set` | Set cashier PIN |
| POST | `/auth/pin/verify` | Verify PIN |

### POS Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/pos/sale` | Create new sale (idempotency key required) |
| GET | `/pos/sale/:id` | Get sale details |
| POST | `/pos/sale/:id/void` | Void a sale |
| GET | `/pos/summary` | Daily X-report summary |

### Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory` | List inventory with pagination |
| POST | `/inventory/adjust` | Manual stock adjustment |
| POST | `/inventory/transfer` | Transfer between branches |
| GET | `/inventory/transfers` | List all transfers |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List all products |
| POST | `/products` | Create new product |
| GET | `/products/:id` | Get product details |
| PUT | `/products/:id` | Update product |
| DELETE | `/products/:id` | Deactivate product |

### Sales History

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sales` | List sales with filters |
| GET | `/sales/:id` | Get sale receipt details |

### Hardware

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/hardware/printers` | List configured printers |
| POST | `/hardware/printers` | Add new printer |
| POST | `/hardware/print/receipt` | Print receipt |
| POST | `/hardware/print/label` | Print product/price label |
| GET | `/hardware/supported` | List supported hardware |

### Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sync` | Upload offline sales, get server changes |
| GET | `/sync/changes` | Get incremental changes |
| POST | `/sync/conflicts` | Resolve sync conflicts |

### Expiry Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/expiry/stats` | Get expiry statistics |
| GET | `/expiry/near-expiry` | List items expiring within 6 months |
| GET | `/expiry/alerts` | List pending expiry alerts |
| POST | `/expiry/apply-discount` | Apply discount to single batch |
| POST | `/expiry/bulk-apply-discount` | Apply discount to multiple batches |
| POST | `/expiry/batch` | Create new batch with expiry |

### Anomaly Detection

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/anomaly` | List detected anomalies |
| GET | `/anomaly/rules` | Get rule-based anomalies |
| GET | `/anomaly/ml` | Get ML-based anomalies |
| POST | `/anomaly/acknowledge` | Acknowledge anomaly |

### Digital Twin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/digital-twin` | Get inventory digital twin |
| GET | `/digital-twin/discrepancies` | List stock discrepancies |
| POST | `/digital-twin/resolve` | Resolve discrepancy |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payments/initialize` | Initialize payment |
| POST | `/payments/verify` | Verify payment status |
| POST | `/payments/refund` | Process refund |
| GET | `/payments/reconciliation` | Get reconciliation status |

### Governance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/governance/audit` | Query audit logs |
| POST | `/governance/audit` | Log custom audit event |
| GET | `/governance/retention` | Get retention policies |
| POST | `/governance/retention` | Create retention policy |
| GET | `/governance/compliance` | Get compliance reports |

### Intelligence (AI/ML)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/intelligence/predictions` | Get stock predictions |
| GET | `/intelligence/expiry-risk` | Get expiry risk scores |
| POST | `/intelligence/train` | Trigger ML model training |

### DevOps (Feature Flags & Deployments)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ops/flags` | List feature flags |
| POST | `/ops/flags` | Create feature flag |
| PATCH | `/ops/flags/:key` | Update feature flag |
| DELETE | `/ops/flags/:key` | Delete feature flag |
| POST | `/ops/flags/check` | Check if feature is enabled |
| GET | `/ops/deployments` | List deployments |
| POST | `/ops/deployments` | Create deployment |
| POST | `/ops/deployments/:id/start` | Start deployment |
| POST | `/ops/deployments/:id/rollback` | Rollback deployment |
| POST | `/ops/deployments/:id/metrics` | Record canary metrics |

---

## Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **SUPER_ADMIN** | Full system access, all organisations |
| **ORG_ADMIN** | Full access within organisation |
| **BRANCH_MANAGER** | Manage branch products, sales, reports |
| **CASHIER** | POS operations only |
| **WAREHOUSE** | Inventory management |
| **AUDITOR** | Read-only across organisation |

---

## Ghana Tax Compliance

All receipts automatically include GRA-compliant tax breakdown:

| Tax | Rate | Description |
|-----|------|-------------|
| VAT | 15% | Value Added Tax |
| NHIL | 2.5% | National Health Insurance Levy |
| GETFund | 2.5% | Ghana Education Trust Fund |
| **Total** | **20%** | Combined tax rate |

---

## Advanced Features

### 1. Digital Twin Inventory

NexusOS maintains a real-time digital twin of physical inventory across all branches:

- **Computed Quantity** - Real-time aggregation of all batches
- **Discrepancy Detection** - Automatic alerts when physical ≠ digital
- **Reconciliation** - Tools for resolving stock differences
- **Audit Trail** - Full history of all inventory changes

### 2. Conflict Resolution (Offline Sync)

Deterministic conflict resolution with explicit rules:

| Rule | Description |
|------|-------------|
| `DUPLICATE` | Idempotency key already processed - use server version |
| `STOCK_MISMATCH` | Local quantity differs - use lower quantity |
| `TIMESTAMP_CONFLICT` | Same timestamp - use higher ID |
| `NEGATIVE_STOCK` | Local would go negative - reject transaction |

### 3. Anomaly Detection

#### Rules-Based Detection

Automatic detection of suspicious patterns:

| Anomaly Type | Threshold | Severity |
|--------------|-----------|-----------|
| EXCESS_REFUNDS | >3 refunds/hour | HIGH |
| EXCESS_VOIDS | >5 voids/hour | HIGH |
| DISCOUNT_ABUSE | >15% avg discount | MEDIUM |
| HIGH_CASH_PAYMENT | >GHS 5,000 | MEDIUM |
| UNUSUAL_SALES_PATTERN | >30% outside 6AM-10PM | MEDIUM |

#### ML-Based Detection

Custom Isolation Forest implementation for outlier detection:

- Cashier behavior profiling
- Transaction amount anomalies
- Unusual timing patterns
- Risk scoring per transaction

### 4. Security

- **AES-256-GCM** - Field-level encryption for sensitive data
- **Refresh Token Rotation** - Automatic token refresh with token families
- **Device Fingerprinting** - Track devices per user
- **Per-Device Authentication** - Independent device auth
- **Rate Limiting** - Redis-backed rate limiting

### 5. Offline Sync

- **Versioning** - Each sync has version number
- **Delta Sync** - Only changed records transferred
- **Event Replay** - Reconstruct state from events
- **Checksum Verification** - Data integrity checks

### 6. Printing System

- **Event-Driven Queue** - Async print job queue
- **Retry Logic** - Max 3 retries with backoff
- **Printer Heartbeat** - Monitor printer status
- **ESC/POS Support** - Xprinter, Rongta, Epson

### 7. Payment System

- **Reconciliation Job** - Daily auto-reconciliation
- **Webhook Validation** - Signature verification
- **Retry Failed Confirmations** - Auto-retry payment confirmation
- **Provider Support** - Paystack (Card), MTN MoMo

### 8. Data Governance

- **Immutable Audit Logs** - Hash chain for tamper detection
- **Event Replay** - Reconstruct state from audit log
- **Retention Policies** - Auto-archive per policy
- **Ghana GRA Compliance** - 7-year document retention

### 9. AI Intelligence

- **Stock Prediction** - Linear regression forecasting
- **Expiry Risk Scoring** - ML-based expiry risk assessment
- **Sales Anomaly Detection** - Pattern detection across branches

### 10. DevOps Features

- **Feature Flags** - Gradual rollouts with targeting (user/role/branch)
- **Deployment Strategies** - BLUE_GREEN, CANARY, ROLLING
- **Canary Metrics** - Track error rate, latency, deviation
- **Automated Rollback** - Threshold-based auto-rollback

---

## Hardware Support

### Supported Thermal Printers

| Brand | Models |
|-------|---------|
| Xprinter | XP-N160I, XP-N160II |
| Rongta | RP80, RP80-U |
| Epson | TM-T20III, TM-T82III |
| Crown | CT321D |
| Gprinter | GP-3124TN |

### Supported Barcode Scanners

| Type | Models |
|------|--------|
| Handheld | Zebra DS2208, DS2278, Honeywell Voyager 1200g |
| Mobile | Zebra TC77, TC52, Honeywell ScanPal EDA50 |
| Fixed | Zebra DS9908, Honeywell HF600 |

### Connection Types

- **Network** - TCP/IP thermal printers
- **Bluetooth** - Mobile receipt printers  
- **USB** - Scanners and direct printers

---

## Expiry Management System

### Overview

Comprehensive expiry tracking and management for products with batch/lot tracking.

### Features

- **Automatic Expiry Detection** - Products expiring within 6 months flagged
- **Batch Tracking** - Each inventory batch has its own expiry date
- **FIFO (First In, First Out)** - Automatic prioritisation of older stock
- **Discount Automation** - Apply 5% to 25% discounts to near-expiry items
- **Alert System** - Automatic alerts for items approaching expiry

### Expiry Status Categories

| Status | Description |
|--------|-------------|
| FRESH | More than 6 months until expiry |
| NEAR_EXPIRY | Within 6 months of expiry |
| EXPIRED | Past expiry date |
| SOLD_OUT | All stock sold |

### Discount Logic

| Days Until Expiry | Suggested Discount |
|-------------------|---------------------|
| ≤ 30 days | 25% |
| ≤ 60 days | 20% |
| ≤ 90 days | 15% |
| ≤ 180 days | 10% |

---

## Web Admin Dashboard

### Pages

| Page | Features |
|------|----------|
| Dashboard | Sales stats, charts, quick actions |
| Sales | Transaction history, filters, export |
| Products | CRUD operations, search, categories |
| Inventory | Stock levels, low stock alerts, adjustments |
| **Expiry** | **Near-expiry tracking, discount management, alerts** |
| Branches | Manage locations, assign staff |
| Hardware | Printer/scanner configuration |
| Users | Invite users, role management |
| Anomaly | Rule-based and ML anomaly detection |
| Digital Twin | Real-time inventory reconciliation |
| **Intelligence** | **Stock predictions, expiry risk scoring** |
| **DevOps** | **Feature flags, deployment management** |
| Settings | Organisation profile |

---

## Mobile App Features

The Expo React Native mobile app provides offline POS capabilities:

### Screens

1. **Login** - Email/password authentication
2. **POS** - Product grid with search and barcode scanning
3. **Cart** - Review items, select payment method
4. **Orders** - View pending/synced sales
5. **Sync** - Manual sync trigger, connection status
6. **Settings** - User profile, logout

### Offline Capabilities

- Stores sales in SQLite (WAL mode) - survives device restarts
- Auto-syncs within 1.5s on reconnection
- Background sync every 60 minutes
- Pull-to-refresh manual sync
- Server-authoritative conflict resolution

---

## Database Schema

### Core Entities (25+ models)

- **Organisation** - Tenant/company
- **User** - Staff accounts with roles
- **Branch** - Store locations
- **Category** - Product categories
- **Product** - Inventory items
- **ProductBatch** - Batch/lot tracking with expiry
- **Inventory** - Stock per branch
- **InventoryTransfer** - Inter-branch transfers
- **Sale** - Transactions
- **SaleItem** - Line items
- **Payment** - Payment records
- **Device** - Printers, scanners, terminals
- **DeviceSession** - Device authentication
- **RefreshToken** - JWT session management with token families
- **AuditLog** - Immutable activity tracking with hash chain
- **RetentionPolicy** - Data retention rules
- **ArchivedRecord** - Archived data for compliance
- **Anomaly** - Detected anomalies (rule-based + ML)
- **SyncLog** - Sync operation history
- **SyncConflict** - Conflict resolution records
- **PrintJob** - Print queue management
- **FeatureFlag** - Feature flag configuration
- **Deployment** - Deployment tracking
- **CanaryMetric** - Canary deployment metrics

---

## Deployment

### Development

```bash
pnpm dev
```

### Production (Docker)

```bash
# Copy and configure environment
cp .env.production.example .env.production

# Build and start
docker compose -f infra/docker/docker-compose.prod.yml up -d --build
```

---

## CI/CD Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| CI | Push to main/dev | TypeScript, Lint, Build |
| Deploy Staging | Push to dev | Auto-deploy to staging |
| Deploy Production | Tag v*.*.* | Manual approval → Production |
| Security Audit | Weekly schedule | npm audit check |

---

## Environment Variables

### Required

```
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
JWT_SECRET=64-char-random-string
JWT_REFRESH_SECRET=different-64-char-string
```

### Optional (Payment)

```
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
MTN_MOMO_API_KEY=...
MTN_MOMO_COLLECTION_ID=...
```

---

## Project Structure

```
nexusos/
├── apps/
│   ├── api/               # 20+ route files
│   │   └── src/
│   │       ├── index.ts   # App entry
│   │       └── routes/    # API endpoints
│   ├── web/               # 10+ pages + components
│   │   └── src/
│   │       ├── app/       # Next.js pages
│   │       └── components/ # UI components
│   └── mobile/            # 6 screens
│       └── src/
│           ├── screens/   # App screens
│           └── stores/    # Zustand state
├── packages/
│   ├── db/                # Prisma schema (25+ models)
│   ├── auth/              # JWT + RBAC + device auth
│   ├── cache/             # Redis utilities
│   ├── sync/              # Offline engine + ML anomaly
│   ├── payments/          # Paystack/MoMo + reconciliation
│   ├── printing/          # ESC/POS + ZPL + print queue
│   ├── queue/             # BullMQ workers
│   ├── types/             # Shared types + Zod schemas
│   ├── hardware/           # Barcode/scanner utilities
│   ├── governance/        # Audit logs + retention
│   ├── intelligence/      # Stock prediction + risk scoring
│   └── ops/               # Feature flags + deployments
├── infra/
│   └── docker/            # Compose files
└── .github/
    └── workflows/         # CI/CD
```

---

## Contributing

1. Branch from `dev`
2. Install dependencies: `pnpm install`
3. Generate Prisma: `pnpm db:generate`
4. Make changes with tests
5. Run quality checks: `pnpm typecheck && pnpm lint`
6. Open PR against `dev`

---

## License

Proprietary — Amata Technologies Ltd. All rights reserved.

---

## Support

- Email: support@amata.com
- Documentation: docs.nexusos.com
- Status: status.nexusos.com

---

*Built with ❤️ in Ghana for African businesses*
