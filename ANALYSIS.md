# API-Gateway — Analysis & Plan

> Security/traffic gateway (NestJS) sitting in front of the Orelea/Wazoo backend.
> This document is the **overview** produced after analyzing the target backend.
> No code is written yet — this is the blueprint for what follows.

---

## 1. Mission of this server

A stand-alone NestJS service that:

1. Receives every inbound HTTP request intended for the main backend.
2. Runs a **security pipeline** on it (JWT → rate limit → log → AI screening).
3. If all checks pass → transparently **forwards** the request to the main backend,
   and relays the response back to the client **unchanged** (status, headers, body).
4. If any check fails → short-circuits with a proper HTTP error (401/403/429/…)
   and never touches the upstream.

The gateway must be **backend-agnostic** — it should be reusable in front of any
REST API. Therefore, per user instruction, we **duplicate** code from Wazoo
rather than import/share it. The only coupling with Wazoo is:
- The JWT secret (so signatures validate).
- Optionally the same Postgres instance for log storage (can be any DB).

---

## 2. Target backend (Wazoo / Orelea) — what we learned

**Stack:** NestJS 10 · TypeORM (Postgres + pgvector) · BullMQ/Redis ·
passport-jwt · @nestjs/swagger · class-validator · `@nestjs/throttler` is
installed but currently commented out in the codebase.

Process-type aware (`web` / `worker` / `all`) via `APP_PROCESS_TYPE`.
Swagger at `/docs`, global prefix `api`, URI-based versioning (`/api/v1/...`).

### 2.1 JWT — validation pattern
Source: [wazoo-backend/src/users/users.guard.ts](../../../../wazoo-backend/src/users/users.guard.ts)
and [wazoo-backend/src/auth/strategies/jwt.strategy.ts](../../../../wazoo-backend/src/auth/strategies/jwt.strategy.ts).

- Secret comes from env `AUTH_JWT_SECRET`, loaded through a `registerAs('auth', …)`
  config and fetched with `configService.getOrThrow('auth.secret', { infer: true })`.
- Token is taken from the `Authorization: Bearer <jwt>` header.
- `JwtService.verifyAsync(token, { secret })` does the crypto check
  (signature + expiry). If it throws → `UnauthorizedException('Invalid token')`.
- After verify, the payload is attached to `request.user` so downstream code
  can read `user.id`, `user.role`, `user.organization`, etc.

### 2.2 JWT payload shape
```json
{
  "id": 16,
  "email": "cbkdmc@gmail.com",
  "role": { "id": 1, "name": "Admin", "__entity": "RoleEntity" },
  "sessionId": 1379,
  "organization": 9,
  "partnershipId": 1,
  "iat": 1776716752,
  "exp": 1776975952
}
```
Typed as `JwtPayloadType` (id, email, role, sessionId, organization?, partnershipId?, iat, exp).

**Implications for the gateway**
- Signature check = HMAC with `AUTH_JWT_SECRET` (must match Wazoo exactly).
- Expiry check = built into `verifyAsync` (`exp` claim).
- **Payload-schema check** = we need our own validator because `passport-jwt`
  only verifies the signature. We will validate with `class-validator` against
  a DTO mirroring the shape above (required: `id`, `email`, `role.id`, `sessionId`,
  `iat`, `exp`).

### 2.3 HTTP logging — how Wazoo does it (what we must mirror)

Chain wired in [wazoo-backend/src/main.ts:89-98](../../../../wazoo-backend/src/main.ts#L89-L98):
`RequestIdInterceptor` → `HttpLogInterceptor` → `ErrorHandlingInterceptor` →
`ClassSerializerInterceptor` → `TransformInterceptor`.

**RequestIdInterceptor** ([src/utils/interceptors/request-id.interceptor.ts](../../../../wazoo-backend/src/utils/interceptors/request-id.interceptor.ts)):
generates a `randomUUID()` and stashes it on `req.request_id`. Must run first.

**HttpLogInterceptor** ([src/utils/interceptors/httpLog.interceptor.ts](../../../../wazoo-backend/src/utils/interceptors/httpLog.interceptor.ts)):
- Skips configurable path prefixes (default: `/docs`, `/health`, `/favicon.ico`, `/socket.io`).
- Captures `startAt` before `next.handle()`.
- Parses the URL into `rawUrl` (numeric segments masked to `{id}`),
  `urlVersion` (`/api/v1`), `urlController` (first segment after version),
  `urlEndPoint` (remainder).
- Sanitizes the request body with `sanitizePayload` (see 2.4).
- On success (`tap`) and error (`catchError`), builds the log payload
  (`statusCode`, `responseTimeMs`, `responseBody`) and **enqueues** it onto the
  BullMQ `HTTP_LOGS` queue — *never writes synchronously*. Enqueue is
  fire-and-forget; a failure does not block the response.
- Captures response body only if `HTTP_LOG_CAPTURE_RESPONSE_BODY=true`.

**HttpLogEntity** ([src/httpLog/.../httpLog.entity.ts](../../../../wazoo-backend/src/httpLog/infrastructure/persistance/relational/entities/httpLog.entity.ts)):
table `httpLog`, PK `bigint`, columns: `requestId uuid`, `environment`,
`orgId`, `userId`, `headers jsonb`, `startAt`, `endAt`, `token`, `method enum`,
`url text`, `query jsonb`, `statusCode`, `routeParams jsonb`, `requestBody jsonb`,
`responseTimeMs int`, `responseBody jsonb`, `rawUrl text`, `urlVersion`,
`urlController`, `urlEndPoint`, `createdAt` (`@CreateDateColumn` + indexed),
soft-delete (`deletedAt`). Indexed on `requestId`, `orgId`, `userId`,
`statusCode`, `urlVersion`, `urlController`, `createdAt`.

**HttpLogProcessor** ([src/httpLog/consumers/http-log.processor.ts](../../../../wazoo-backend/src/httpLog/consumers/http-log.processor.ts)):
BullMQ worker that **batches** — in-memory buffer flushed when size ≥ 50 or
every 2000 ms (`BATCH_SIZE` / `FLUSH_INTERVAL_MS`). Final flush on
`OnModuleDestroy`. Calls `httpLogRepository.createMany(...)`.

### 2.4 Payload sanitization
[src/utils/sanitize-payload.ts](../../../../wazoo-backend/src/utils/sanitize-payload.ts):
recursive mask for `password`, `otp`, `access_token`, `refresh_token`,
`authorization`, `cookie`, `set-cookie`, `card_number`, `cvv/cvc`.
Truncates strings > 2 KB, redacts `data:…;base64,...`, replaces payloads > 100 KB
with `{ truncated: true }`. We **duplicate this file verbatim** into the gateway.

### 2.5 Roles / permissions
Simple guard ([src/rolesAndPermissions/roles/roles.guard.ts](../../../../wazoo-backend/src/rolesAndPermissions/roles/roles.guard.ts))
reads `@SetMetadata('roles', […])` and compares against `request.user.role.id`.
There is also a heavy `RolePermissionGuard` that resolves role → permissions →
screens → endpoints against the DB with a 10-minute cache — **we do not
re-implement this** in the gateway; authorization stays in Wazoo. Our gateway
only does **authentication** (JWT valid) and **coarse abuse controls**
(rate limit, AI screening). The main server still applies its RBAC.

### 2.6 Response shape
`TransformInterceptor` wraps every response as `{ status: 'success', data }`.
The gateway must **not** re-wrap proxied responses — it must pass them through
byte-for-byte so clients keep seeing what Wazoo already produced. Our own
(non-proxied) gateway endpoints (e.g. `/health`, future `/gateway/...` admin)
can adopt the same wrapping for style consistency.

### 2.7 Coding conventions to copy
From [wazoo-backend/CLAUDE.md](../../../../wazoo-backend/CLAUDE.md):
- DDD layout per module: `domain/` · `dto/` ·
  `infrastructure/persistance/relational/{entities,repositories,mappers}` ·
  `exceptions/` · `*.controller.ts` · `*.service.ts` · `*.module.ts`.
- Controllers do HTTP only; services hold logic; repositories own SQL.
- DTOs use `@ApiProperty` + `class-validator` decorators.
- Config via `registerAs` + a class-validator DTO (`validateConfig`).
- Swagger `@ApiTags` / `@ApiBearerAuth` on controllers.
- Typo watch: folder is spelled **`persistance`** in most Wazoo modules
  (not `persistence`). We match this.

---

## 3. Gateway — target architecture

```
Client
  │  (any HTTP method, any path under /api/...)
  ▼
┌─────────────────────────── API Gateway (this project) ───────────────────────────┐
│                                                                                   │
│  global interceptors/guards pipeline (order matters):                             │
│                                                                                   │
│   1. RequestIdInterceptor       — attach req.request_id (UUID)                    │
│   2. IpExtractorMiddleware      — resolve real client IP (X-Forwarded-For…)       │
│   3. JwtGuard (global)          — verify signature + exp + payload schema         │
│   4. RateLimitGuard             — throttle by user.id and by IP                   │
│   5. HttpLogInterceptor         — enqueue log job (request + response, async)     │
│   6. ProxyController            — catch-all, forwards to WAZOO_BASE_URL            │
│                                                                                   │
│  background:                                                                      │
│   • BullMQ worker → Postgres `httpLog` table (batched inserts)                    │
│   • AI analyzer worker → reads recent logs → OpenAI → persists verdicts           │
└───────────────────────────────────────────────────────────────────────────────────┘
  │                                                                         ▲
  │ HTTP forward (axios)                                                    │
  ▼                                                                         │
Wazoo backend (unchanged) ────────────────────────────────────────────────── ┘
```

Key design choices:

- **Catch-all proxy controller** (`@All('*')`) using `HttpService` (axios) —
  simpler than `http-proxy-middleware` and plays nicely with Nest interceptors.
  Streams the upstream response back, preserving status and headers.
- **Global guards** so every route is protected by default; a small allow-list
  (`/health`, `/docs`, `/docs-json`) uses a `@Public()` decorator to skip.
- **Same `httpLog` schema** as Wazoo, + two extra columns for gateway-only
  data: `clientIp` and (later) `aiVerdict` / `aiRiskScore`.
- **BullMQ + Redis** for async log writes, mirroring Wazoo's batching worker.
  This keeps the hot path fast (enqueue ≈ sub-ms).
- **Rate limiting** using `@nestjs/throttler` v6 with two trackers (user-id
  from JWT, IP from request). When no JWT yet (pre-auth errors), IP is the only
  tracker.

---

## 4. Environment & connections

- **Gateway port:** `3100` (so `3000` stays free for Wazoo locally).
- **Upstream:** `WAZOO_BASE_URL=http://localhost:3000/api` (configurable).
- **DB:** same local Postgres instance as Wazoo (`localhost:5432`, db `orelea`)
  but a **separate table prefix or a separate DB** for gateway logs. Decision
  point at step 3 — default is a separate DB `orelea_gateway` so the two
  schemas don't collide.
- **Redis:** `localhost:6379` (assumed; Wazoo already needs it for BullMQ).
- **JWT secret:** `AUTH_JWT_SECRET=secret` (must match Wazoo's `env-local`).
- **AI provider:** OpenAI key in `OPENAI_API_KEY` (not wired until step 8).

---

## 5. Stepwise plan (each step ends with a Swagger-testable state)

Each step is small enough to verify before moving on. The **"How to test"**
section for each step is the acceptance criterion — we do not advance until it
passes.

### Step 0 — Scaffold & Swagger hello-world  *(~15 min)*
- `nest new`, TypeScript, npm.
- Install: `@nestjs/config @nestjs/swagger class-validator class-transformer`.
- Copy Wazoo's bootstrap style (global prefix `api`, URI versioning, Swagger
  at `/docs`, `validationOptions`, `TransformInterceptor`).
- Create a trivial `GET /api/v1/health` returning `{ status: 'ok' }`.
- **How to test:** open `http://localhost:3100/docs`, execute `GET /health`,
  expect `200` and body `{ status: "success", data: { status: "ok" } }`.

### Step 1 — Request-ID + base log-to-console interceptor  *(~20 min)*
- Duplicate `RequestIdInterceptor` verbatim.
- Add a minimal `HttpLogInterceptor` that **console.log**s the request/response
  (no DB yet). Skip prefixes `/docs`, `/health`, `/favicon.ico`.
- Duplicate `sanitize-payload.ts` verbatim.
- **How to test:** call `/health` (silent), call a new dummy `POST /api/v1/echo`
  with body → see one line per request in the server log with the generated
  UUID, method, URL, status, duration.

### Step 2 — Postgres connection + migrations infrastructure  *(~30 min)*
- Install `@nestjs/typeorm typeorm pg`.
- Copy Wazoo's `database.config` + `typeorm-config.service.ts` shape
  (no subscribers).
- Create DB `orelea_gateway` locally.
- `data-source.ts` + `migration:generate/run` scripts (npm scripts copied
  from Wazoo).
- **How to test:** `npm run migration:run` succeeds against an empty DB;
  `SELECT 1 FROM information_schema.tables WHERE table_schema='public'` returns
  only `migrations` meta tables. Boot the app → no TypeORM errors on startup.

### Step 3 — `httpLog` module (synchronous write, no queue yet)  *(~45 min)*
- Scaffold a full DDD `httpLog` module mirroring Wazoo
  (`domain/httpLog.ts`, `entity`, `repository` abstract + relational impl,
  `mapper`, `module`).
- Generate a migration for the table (same columns as Wazoo + `clientIp`).
- Extend `HttpLogInterceptor` to **write synchronously** through the service
  (still fast enough at dev volume; queueing comes in Step 7).
- Add `GET /api/v1/http-logs` (paginated) so we can verify logs in Swagger —
  no auth required yet (will be locked down in Step 4).
- **How to test:** call a few endpoints (including `POST /api/v1/echo` with a
  body and with a fake `Authorization` header) → `GET /api/v1/http-logs`
  returns rows with `requestId`, `method`, `url`, `statusCode`, `responseTimeMs`,
  sanitized `headers` and `requestBody`.

### Step 4 — JWT validation (signature + expiry + payload schema)  *(~45 min)*
- Install `@nestjs/jwt passport passport-jwt @nestjs/passport`.
- Duplicate `auth.config.ts` (just `AUTH_JWT_SECRET`).
- Write `JwtPayloadDto` with `class-validator` matching the real payload
  (id, email, role.id, sessionId, iat, exp, optional organization/partnershipId).
- Write `JwtGuard`: reads `Bearer`, calls `jwtService.verifyAsync`, then runs
  `validateOrReject(plainToInstance(JwtPayloadDto, payload))`. On success,
  attaches payload to `req.user`. Register as **global guard** with a
  `@Public()` escape hatch for `/health`, `/docs`.
- **How to test:**
  1. Call `GET /api/v1/http-logs` **without** token → `401 Authorization header not found`.
  2. With a random string → `401 Invalid token`.
  3. With a valid Wazoo-issued token (copy from your browser after a real login)
     → `200` + logs show `userId` populated.
  4. With a tampered token (change one char of the signature) → `401`.
  5. Forge a token whose payload is `{ foo: 'bar' }` signed with the right
     secret → `401` (fails schema check, not signature).

### Step 5 — Catch-all proxy to Wazoo  *(~1 h)*
- Install `@nestjs/axios axios`.
- `ProxyController` with `@All('*')` accepting any method.
  Constructs upstream URL as `WAZOO_BASE_URL + req.originalUrl`, forwards
  method/headers/body, **strips hop-by-hop headers** (`connection`,
  `transfer-encoding`, `keep-alive`, `host`), sets `X-Forwarded-For`,
  `X-Forwarded-Host`, `X-Request-Id: req.request_id`.
- Relays upstream status, headers (minus hop-by-hop), and body to the client.
- **Important:** register the proxy controller as a **separate module mounted
  last** so that any explicit gateway routes (e.g. `/api/v1/http-logs`) win
  over the catch-all.
- Disable the global `TransformInterceptor` on proxied routes (only wrap our
  own routes, not passthrough traffic).
- **How to test in Swagger:** start both Wazoo (3000) and the gateway (3100),
  log into Wazoo through the gateway (`POST /api/v2/auth/email/login` sent to
  `:3100`) → should get the same `LoginResponseType` as hitting `:3000`
  directly. Call an authenticated endpoint via the gateway → Wazoo sees the
  original bearer, everything works.

### Step 6 — Rate limiting (IP + user)  *(~45 min)*
- Install `@nestjs/throttler` (Wazoo already has it as a transitive dep).
- Two throttlers:
  - `short`: 20 req / 10 s per **user.id** (fallback to IP if no JWT yet).
  - `long`: 500 req / 15 min per **IP**.
- Custom `ThrottlerGuard` subclass that builds the tracker key from
  `req.user?.id ?? req.ip`.
- **How to test:** hammer any endpoint from Swagger's "Try it out" or a small
  `curl` loop → after the limit, receive `429 Too Many Requests` with
  `Retry-After` header. Confirm two different users (two tokens) are
  throttled independently.

### Step 7 — Async logging via BullMQ  *(~1 h)*
- Install `@nestjs/bullmq bullmq ioredis`.
- Replace the synchronous write in `HttpLogInterceptor` with a fire-and-forget
  enqueue, exactly like Wazoo's pattern. Add the processor with the same
  batch-of-50 / flush-every-2 s semantics.
- **How to test:** run a small load (e.g. 200 requests) → response times
  should drop compared to Step 3; `GET /api/v1/http-logs` still shows all rows
  within a few seconds. Kill the app mid-load → on next boot the queued jobs
  resume (BullMQ persistence).

### Step 8 — AI screening worker  *(~1 h+)*
- New `ai-screening` module. A separate BullMQ queue receives **log IDs** (not
  full payloads) to keep the main log write path decoupled.
- Cron (every N minutes, or triggered on rate-limit events) selects recent
  suspicious traffic (many 4xx, bursts from one IP, unknown user-agents) and
  ships a compact summary to OpenAI.
- Verdict stored in a new `aiVerdict` / `aiRiskScore` column on `httpLog`
  (or a separate `httpLogAnalysis` table — decision at that step).
- **How to test:** seed some clearly-abusive traffic → wait for cron tick →
  `GET /api/v1/http-logs?filter[aiRiskScore_gte]=0.7` returns them with a
  verdict string.

---

## 6. Open decisions (to revisit at the matching step)

| # | Decision | Default | Revisit at |
|---|----------|---------|------------|
| 1 | Separate DB vs. shared with Wazoo | **Separate DB** `orelea_gateway` | Step 2 |
| 2 | Proxy library: axios vs http-proxy-middleware | **axios** via `@nestjs/axios` | Step 5 |
| 3 | `aiVerdict` column vs. separate table | **separate table** (cleaner for ML iteration) | Step 8 |
| 4 | Streaming vs buffering proxy body | **buffer** (simpler, fine for JSON APIs) | Step 5 |
| 5 | Socket.io passthrough? | **out of scope** (v1 handles HTTP only) | — |

---

## 7. What we explicitly do **not** do

- No re-implementation of Wazoo's RBAC (`RolePermissionGuard`) — authorization
  stays in Wazoo. We only authenticate.
- No user/session/organization management, no login endpoints — Wazoo owns
  those. We merely forward them.
- No response transformation for proxied traffic (must be byte-faithful).
- No shared npm packages between the two repos (user directive: duplicate).
