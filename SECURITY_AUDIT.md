# Security self-audit, 2026-10-10

This is a self-audit by the project's own team and tooling. It is **not** an independent review and does not replace one. It lists what was probed, what was found and fixed, what remains open, and what an outside reviewer should look at first.

Scope: `@rheajs/core`, `@rheajs/auth`, the `rhea` CLI and the generated project template, at the commit that contains this file.

## Findings

| #   | Finding                                                                                                                                                                                                               | Severity | Status                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| 1   | The prototype-pollution guard stopped inspecting at depth 32 and returned "clean". A body with `__proto__` below level 32 was accepted (HTTP 200).                                                                    | Medium   | **Fixed.** Bodies nested deeper than 32 levels are now rejected with 400.    |
| 2   | Log redaction used one-level wildcards (`*.password`), so a secret nested two or more levels down was logged in clear text. `jwt`, `idToken`, `clientSecret` and `privateKey` were not listed.                        | Medium   | **Fixed.** Sensitive keys are redacted at nesting levels 1 to 4. Keys added. |
| 3   | `rhea generate module con` created a folder named after a Windows device name that Windows cannot create.                                                                                                             | Low      | **Fixed.** Windows device names are refused.                                 |
| 4   | A flaky shutdown test (fixed 30 ms wait) failed under CPU load.                                                                                                                                                       | Test     | **Fixed.** It now waits for the handler to start.                            |
| 5   | `npm audit` on generated projects and on this repository reported advisories in `vitest` and `@vitest/mocker`, and generated projects pulled a vulnerable `braces` through `nodemon`; `eslint` 9.39.5 was deprecated. | Low      | **Fixed** (1.0.2). See below.                                                |
| 6   | `autocannon` (benchmark tool, dev only) pulled a vulnerable `uuid`.                                                                                                                                                   | Low      | **Fixed** with an `overrides` entry (`uuid` 11.1.1).                         |

### About finding 5 (fixed in 1.0.2)

- Vitest and `@vitest/coverage-v8` moved to `~5.0.5`, which contains the fix for GHSA-82fw-gwwq-j7x9 and GHSA-qxg6-89mg-rqv8. The first fixed 4.x line (4.1.x) crashes npm 10 (`Cannot read properties of null (reading 'edgesOut')`, reproduced on npm 10.9.9), so the fix is Vitest 5. It needs Node.js 22.12 or newer; Node.js 20 is end of life and was dropped from the tested set.
- `nodemon` was removed. Its newest release still depends on `chokidar` 3, which depends on `braces` (GHSA-vfj7-8cjw-p6xm, no fixed version). `npm audit fix --force` "fixed" this by installing `nodemon` 1.14.10, which raised the count from 6 to 19. `npm run dev` now uses `tsx watch` (TypeScript) or `node --watch` (JavaScript).
- ESLint moved to 10.13 (9.39.5 is deprecated and no longer supported) together with `@eslint/js` 10 and `typescript-eslint` 8.72.
- The only override left is `uuid` 11.1.1 for `hyperid` (via `autocannon`, the benchmark tool, dev only). `hyperid` uses only `uuid.v4`, whose API is identical in 11, and `npm run bench`/`soak` ran with it. It is not hiding a finding: without it `npm audit` reports GHSA-w5hq-g745-h8pq.
- Evidence (2026-10-22, npm 12.1.0, Node.js 26.10): `npm audit --audit-level=low` reports **0 vulnerabilities** for the monorepo, for each workspace (`npm run audit:all`), for the packed `@rheajs/core`, `@rheajs/auth`, `@rheajs/cli` and `create-rhea` tarballs, and for 14 generated projects (TypeScript and JavaScript, ESM and CommonJS, no database, MongoDB, MySQL, and two with authentication). `npm run test:security` repeats this with the real `npm audit` and fails on any finding.

### Dependency policy

- CI runs `npm audit --audit-level=low` (all dependencies and production only), `npm audit signatures`, and the generated-project audit on every pull request, on every release, and once a day. A newly disclosed advisory turns the daily run red.
- Fixes are made in the dependency graph (upgrade, replace or remove). No audit suppression file, `--audit-level` relaxation or `npm audit fix --force` is used. An `overrides` entry is allowed only when the overriding version is API compatible with its consumer, and it must be explained in this file.
- Dependabot opens weekly update pull requests. The security-update PRs are merged first, followed by a patch release.

## Probed and held

| Area                | Probe                                                                                                                    | Result                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Prototype pollution | `__proto__` and `constructor.prototype` at top level and inside arrays                                                   | 400                                                                 |
| Query pollution     | `?__proto__[admin]=1&a[b]=2`                                                                                             | Express 5 simple parser: keys stay flat strings, no nesting         |
| Error leakage       | Foreign error with `status: 400` and a secret in the message; plain `Error` with a secret                                | Generic message in production, no secret                            |
| Content types       | `urlencoded`, `text/plain` bodies                                                                                        | Not parsed, empty body                                              |
| Request ID          | CRLF in `X-Request-ID`; `<script>` in `X-Request-ID`                                                                     | Client refuses CRLF; unsafe values are replaced by a generated UUID |
| Oversized input     | 5,000 query parameters; 20 kB URL                                                                                        | 431                                                                 |
| Methods             | `TRACE`, `OPTIONS`                                                                                                       | 404; `OPTIONS` answers with `Allow`                                 |
| Headers             | HSTS, nosniff, CSP, frame, referrer, COOP present; `X-Powered-By` and `ETag` absent                                      | As intended                                                         |
| Request log         | Query string, `Authorization`, `Cookie`                                                                                  | Not logged (path only)                                              |
| JWT                 | `alg: none`, HS512, wrong issuer, wrong audience, tampered payload and signature, other secret                           | All 401 `INVALID_TOKEN`                                             |
| Roles               | `roles` claim as a string instead of an array                                                                            | Grants nothing                                                      |
| Tokens in URLs      | `?token=...`, `Basic`, lower-case `bearer`                                                                               | Ignored                                                             |
| Passwords           | Malformed, truncated and tampered hashes (cost 2^30), oversized input, Unicode forms                                     | `false` quickly, no allocation blow-up, normalised                  |
| Account enumeration | Wrong password vs unknown email on login                                                                                 | Identical response; dummy hash equalises timing                     |
| CLI paths           | `../../evil`, `..\evil`, `/etc/passwd`, `a/b`, `__proto__`, `x;rm -rf`, `$(id)` as names                                 | All refused                                                         |
| Generated project   | `.env` ignored by git and Docker, non-root container, database port not published by compose, secret required at startup | As intended                                                         |
| Shared rate limit   | Real Redis 7: two instances, expiry, 60 concurrent requests, Redis down                                                  | Exact limit held; generic 500 when down                             |
| Soak                | 180 s, 392,475 requests                                                                                                  | 0 errors, memory flat after warm-up                                 |

## Known limits (not fixed, by design or for later)

- **Password hashing memory.** Each in-flight hash needs about 128 MiB. Node.js runs four at a time by default (`UV_THREADPOOL_SIZE`). 24 concurrent verifications peaked at about 609 MiB resident memory. Size containers for this when using `@rheajs/auth`. The per-IP login limit bounds one client, not a distributed attack.
- **No MFA, server-side sessions, password reset or OAuth/OIDC.** Account lockout and rotating refresh tokens were added in 1.0.0 after this audit and are covered by tests and real-database checks, not by the audit itself. Access tokens cannot be revoked before they expire; logout stops them being renewed.
- **HS256 only.** One shared secret signs and verifies, so every service that verifies tokens can also forge them.
- **Registration reveals whether an email exists** (409). That is a deliberate usability trade-off.
- **Rate-limit counters are per process** unless you pass a shared store. A failing Redis store returns 500 (it fails closed).
- **Request timeout does not cancel the handler.** After a 503 the handler keeps running until it finishes.
- **Bodies nested deeper than 32 levels are rejected**, even when harmless.
- **Redaction depth is 4 levels.** A secret nested deeper, or under a key not in the list, is logged. Add paths with the `redact` option.
- **Generated MongoDB and MySQL compose files are for development.** No database authentication is configured for MongoDB.
- Windows and macOS were not tested manually for Docker; CI covers the unit and end-to-end tests on both.

## What an independent reviewer should look at first

1. `packages/auth/src/password.ts` and `jwt.ts`: parameter choices, constant-time behaviour, the dummy-hash timing equaliser.
2. `packages/core/src/app.ts` error handler and `security.ts`: information disclosure paths, the timeout behaviour, proxy and IP handling.
3. The generated auth module (`packages/cli/src/templates/auth.ts`): registration and login flows against real MongoDB and MySQL, including injection attempts through the email field.
4. Supply chain: the release workflow, npm provenance and the staged-publish process.
5. Anything this document does not mention.

To report a problem, follow [SECURITY.md](SECURITY.md).
