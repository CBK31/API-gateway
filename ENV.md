# Environment Variables

Reference for every variable the gateway reads from `.env`.

Values shown under **Default** are what the code uses when the variable is
missing or empty. Values under **Example** are just illustrations — put
whatever fits your environment.

---

## 1. App

| Variable | Required | Default | Example | Purpose |
|----------|----------|---------|---------|---------|
| `NODE_ENV` | No | `development` | `development` / `production` / `test` | Standard Node env tag. Used in logs and as the `environment` column on every `httpLog` row. |
| `APP_PORT` | No | `3100` | `3005` | TCP port the gateway HTTP server listens on. |
| `API_PREFIX` | No | `api` | `api` | Global URL prefix — controllers mount under `/${API_PREFIX}/v1/...`. |

---

## 2. Database (Postgres, TypeORM)

The gateway stores its own `httpLog` table here — **separate** from the
upstream backend's DB.

| Variable | Required | Default | Example | Purpose |
|----------|----------|---------|---------|---------|
| `DATABASE_TYPE` | Yes\* | — | `postgres` | TypeORM driver. Only `postgres` is wired. |
| `DATABASE_HOST` | Yes\* | — | `localhost` | Postgres host. |
| `DATABASE_PORT` | No | `5432` | `5432` | Postgres port. |
| `DATABASE_USERNAME` | Yes\* | — | `postgres` | Postgres user. |
| `DATABASE_PASSWORD` | Yes\* | — | `123` | Postgres password. |
| `DATABASE_NAME` | Yes\* | — | `api_gateway` | Database name. Must exist before the gateway starts. |
| `DATABASE_SYNCHRONIZE` | No | `false` | `false` | **Keep this `false`.** Migrations are the source of truth. `true` makes TypeORM auto-ALTER tables to match entities on every boot — dangerous on shared DBs. |
| `DATABASE_MAX_CONNECTIONS` | No | `100` | `100` | Pool size. Must be ≤ the Postgres role's connection limit. |
| `DATABASE_SSL_ENABLED` | No | `false` | `false` | Set `true` when connecting to managed Postgres (AWS RDS etc.). |
| `DATABASE_REJECT_UNAUTHORIZED` | No | `false` | `true` | Only meaningful when SSL is on. `false` accepts self-signed certs. |
| `DATABASE_CA` / `DATABASE_KEY` / `DATABASE_CERT` | No | empty | (PEM content) | Optional SSL material. |
| `DATABASE_URL` | No | empty | `postgres://user:pass@host:5432/db` | Alternative single-URL connection string. If host/user/name are set, **this is ignored** (prevents Heroku's injected URL from overriding local config). |

\* Required only if `DATABASE_URL` is not used; if all three of HOST/NAME/USERNAME are set, they win and `DATABASE_URL` is ignored.

---

## 3. Auth / JWT

The gateway does not issue JWTs — it only **verifies** them.

| Variable | Required | Default | Example | Purpose |
|----------|----------|---------|---------|---------|
| `AUTH_JWT_SECRET` | **Yes** | — | `Qw7v9p2Xk3s8Zb1Lr6t4Vn0yJc5hGm2q` | HMAC secret for verifying the `Authorization: Bearer <jwt>` header. **Must match the upstream backend's secret exactly**, otherwise every token fails signature check. |

---

## 4. Upstream proxy

The backend the gateway forwards unknown routes to.

| Variable | Required | Default | Example | Purpose |
|----------|----------|---------|---------|---------|
| `UPSTREAM_BASE_URL` | No | `http://localhost:3000` | `http://localhost:3000` | Base URL prepended to every proxied path. Also used to fetch `/docs-json` for the merged Swagger. |
| `UPSTREAM_TIMEOUT_MS` | No | `30000` | `30000` | Per-request timeout when proxying. Upstream responses slower than this get a `502 Bad Gateway` from the gateway. |

---

## 5. Rate limiting

Two throttlers run at the same time. A request is rejected with `429 Too Many
Requests` if **either** window is full. Tracker key is `user:<id>` when a
valid JWT is attached, else `ip:<address>`.

### Short window — burst protection

| Variable | Default | What it means |
|----------|---------|---------------|
| `RATE_LIMIT_SHORT_TTL_MS` | `10000` | Window length in **milliseconds**. `10000` = 10 seconds. |
| `RATE_LIMIT_SHORT_LIMIT` | `20` | Max requests per tracker inside that window. |

**Purpose:** stop bursts (accidental scripts, fast scraping, brute-force
login attempts). A legit user clicking around never hits it; a script
hammering the API does.

### Long window — sustained-use cap

| Variable | Default | What it means |
|----------|---------|---------------|
| `RATE_LIMIT_LONG_TTL_MS` | `900000` | Window length in ms. `900000` = 900 000 ms = **15 minutes**. |
| `RATE_LIMIT_LONG_LIMIT` | `500` | Max requests per tracker in that window. |

**Purpose:** catch slow continuous abuse — a scraper staying under the short
limit but running for hours. This enforces a daily-ish ceiling
(≈ 133 req/min averaged over 15 min at default values).

### How both work together

Every incoming request:
1. Computes tracker → `user:<id>` if authenticated, else `ip:<address>`.
2. Increments the counter on **both** buckets.
3. If either bucket is full → `429` with `Retry-After-short` or
   `Retry-After-long` header telling the client how many seconds to wait.

Two different users on the same IP don't share a budget (they're tracked by
user id). Two anonymous clients from the same NAT **do** share the IP bucket.

### Tuning cheat sheet

| You want to… | Adjust |
|--------------|--------|
| Let users be chattier but still block bursts | Raise `SHORT_LIMIT` (e.g. `120`), keep TTL at 10000 |
| Tighten bot protection | Lower `SHORT_LIMIT` (e.g. `10`) |
| Allow higher sustained use (dashboards, pollers) | Raise `LONG_LIMIT` |
| Make limits fire fast during manual testing | Drop `SHORT_LIMIT` to `5` or less + restart |

### Known limitation

Counters are **in-memory per gateway process**. If you run two gateway
instances behind a load balancer, each has its own counter — a user could
get 2 × the limit by hitting both. For true cross-instance limits, swap the
throttler storage for Redis-backed (`ThrottlerStorageRedisService`). Not
wired yet.

---

## 6. HTTP logging

These are optional. Defaults are fine for most cases.

| Variable | Default | Purpose |
|----------|---------|---------|
| `ENABLE_HTTP_REQUEST_LOGS` | `true` | Set `false` to silence the `HttpLog` interceptor entirely (no DB inserts, no console logs). |
| `HTTP_LOG_SKIP_PATH_PREFIXES` | `/docs,/api/v1/health,/api/v1/http-logs,/favicon.ico` | Comma-separated path prefixes that get no log row. Prevents the log-reader endpoint and health probes from polluting the table. |

---

## 7. Future use (placeholders present but unused today)

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Will be used by Step 7 (async log write queue) and Step 8 (AI screening queue). Safe to leave defined; nothing reads it yet. |

---

## Full `.env` template

```env
# ---- App ----
NODE_ENV=development
APP_PORT=3005
API_PREFIX=api

# ---- Database (gateway-only Postgres) ----
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=123
DATABASE_NAME=api_gateway
DATABASE_SYNCHRONIZE=false
DATABASE_MAX_CONNECTIONS=100
DATABASE_SSL_ENABLED=false
DATABASE_REJECT_UNAUTHORIZED=false
DATABASE_CA=
DATABASE_KEY=
DATABASE_CERT=
DATABASE_URL=

# ---- Auth (must match upstream backend) ----
AUTH_JWT_SECRET=Qw7v9p2Xk3s8Zb1Lr6t4Vn0yJc5hGm2q

# ---- Upstream proxy target ----
UPSTREAM_BASE_URL=http://localhost:3000
UPSTREAM_TIMEOUT_MS=30000

# ---- Rate limiting (per user-id or per IP) ----
# Short window catches bursts
RATE_LIMIT_SHORT_TTL_MS=10000
RATE_LIMIT_SHORT_LIMIT=20
# Long window caps sustained use
RATE_LIMIT_LONG_TTL_MS=900000
RATE_LIMIT_LONG_LIMIT=500

# ---- HTTP logging (optional) ----
# ENABLE_HTTP_REQUEST_LOGS=true
# HTTP_LOG_SKIP_PATH_PREFIXES=/docs,/api/v1/health,/api/v1/http-logs,/favicon.ico

# ---- Reserved for later steps ----
REDIS_URL=redis://localhost:6379
```
