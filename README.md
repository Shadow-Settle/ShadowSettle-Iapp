# shadowsettle_iapp

**ShadowSettle** confidential settlement logic — runs inside an iExec TEE (SGX/TDX). One task, many participants (bulk processing).

Part of the [ShadowSettle](https://github.com/ShadowSettle/ShadowSettle) monorepo.

## Input (dataset)

Decrypted in TEE from protected data or input file. Expected JSON:

- `rules.minScore` (number), `rules.maxRisk` (number)
- `participants`: array of `{ wallet, score, risk }`
- `totalPool` (optional number): total amount to distribute; if omitted, uses sum of score-weighted shares

## Logic

1. Filter: `score >= minScore` and `risk <= maxRisk`
2. Allocate payouts proportionally by score; total = `totalPool` or sum of allocations
3. Output: `{ payouts: [{ wallet, amount }], tee_attestation }` (attestation = SHA256 of result)

Output written to `IEXEC_OUT/result.json` and `IEXEC_OUT/computed.json` (deterministic-output-path).

---

## Prerequisites

- Node.js 20+
- Docker (with buildx; **linux/amd64** required for iExec workers)

**Using Colima:** The `iapp` CLI talks to Docker via the Docker API. If you use Colima instead of Docker Desktop, set the socket so the CLI can see the daemon:
```bash
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
```
Then run `iapp deploy` (or add the export to your shell profile so it’s set whenever Colima is running).

---

## Quick test (no Docker)

```bash
npm test
# or
npm run test:file
```

Output in `test/workspace/out/result.json`.

---

## Ready to deploy (step-by-step)

Preconfigured for Docker Hub **jagadeesh2606**: image `jagadeesh2606/shadowsettle-settlement:latest`; `iexec.json` and `iapp.config.json` are set (checksum from current image).

### 1. Install iApp CLI

```bash
npm i -g @iexec/iapp
```

### 2. Build and push Docker image

```bash
docker build --platform linux/amd64 -t jagadeesh2606/shadowsettle-settlement:latest .
docker push jagadeesh2606/shadowsettle-settlement:latest
```

If you rebuild and the image ID changes, run `DOCKER_IMAGE=jagadeesh2606/shadowsettle-settlement:latest npm run digest` and update `iexec.json` **app.checksum**.

### 3. Update app.owner and deploy

Set **app.owner** in `iexec.json` to your wallet address, then:

```bash
iapp deploy
```

### 4. Test locally with iApp CLI (Docker must be running)

The `iapp test --inputFile` option expects an **HTTP(S) URL** (the CLI fetches the file). Use the script that serves the dataset and runs the test:

```bash
npm run test:iapp
```

Or manually: start an HTTP server serving the project root, then run `iapp test --inputFile "http://localhost:PORT/test/dataset-example.json"`.

### 6. Deploy to iExec

```bash
iapp deploy
```

Note the printed app address.

### 5. Run on iExec

With a public **input file** URL: `iapp run <APP_ADDRESS> --inputFile "https://..."`  
With **protected data**: `iapp run <APP_ADDRESS> --protectedData <PROTECTED_DATA_ADDRESS>`


---

## Scripts reference

| Script | Description |
|--------|-------------|
| `npm start` | Run app (needs IEXEC_IN, IEXEC_OUT set) |
| `npm test` | Local run with example dataset; no Docker |
| `npm run test:file` | Same with `test/dataset-example.json` |
| `npm run build:docker` | Build image (current arch) |
| `npm run build:docker:amd64` | Build for linux/amd64 (iExec) |
| `npm run digest` | Print image digest for iexec.json |
| `npm run prepare:deploy` | Update iexec.json from OWNER, DOCKER_IMAGE, CHECKSUM |

---

## Dataset type

When using **protected data**, the dataset type configured when protecting the data must match the dataset type declared for this app in the iExec workflow (e.g. in the DataProtector / run configuration).

---

## Troubleshooting: `iapp deploy` — "Failed to transform your app into a TEE app: fetch failed"

The **"fetch failed"** happens at the start of the TEE transform step when the CLI requests a **Docker Hub token** from **`https://auth.docker.io`** (so iExec’s sconify service can push the TEE image to your Docker Hub). It is usually **not** the WebSocket to iapp-api.iex.ec.

**Check connectivity:**
```bash
npm run check:iapp-api
```
This tests both `auth.docker.io` and `iapp-api.iex.ec`. If `auth.docker.io` fails, that’s the cause.

**Things to try:**

1. **Network** – Use another network (e.g. mobile hotspot) in case your current one blocks `auth.docker.io` or `iapp-api.iex.ec`.
2. **Proxy** – If behind a corporate proxy, set `HTTP_PROXY` and `HTTPS_PROXY`; Node’s `fetch` may need these to reach auth.docker.io.
3. **Retry** – Run `iapp deploy` again; the failure is sometimes transient.
4. **Debug** – Run `DEBUG=iapp iapp deploy` for more detail (e.g. `iapp sconify error: TypeError: fetch failed`).

---

## Troubleshooting: "Pushing docker image" — `Head "https://registry-1.docker.io/...": EOF`

This happens when **Docker** (the daemon) cannot complete the push to Docker Hub. The connection to `registry-1.docker.io` is dropped (EOF). It’s a Docker ↔ Docker Hub connectivity issue, not the iapp CLI.

**Things to try:**

1. **Retry** – Run `iapp deploy` again; EOF is often transient (flaky network or Docker Hub).
2. **Network** – Use a different network (e.g. mobile hotspot) or turn VPN off to see if the problem is firewall/VPN.
3. **Docker login** – Run `docker logout` then `docker login` and retry the deploy.
4. **Docker Desktop** – Restart Docker Desktop and retry.
5. **Docker Hub status** – Check [status.docker.com](https://status.docker.com) for incidents.

---

## Troubleshooting: UNAUTHORIZED / "authentication required" (correct PAT still fails)

The **Docker daemon** (which runs `docker push`) uses credentials from **`docker login`**, not from `iapp.config.json`. So even with the right PAT in `iapp.config.json`, the push can fail if your shell’s Docker login is wrong or stale.

**Do this:**

1. **Log out and log in with the same PAT:**
   ```bash
   docker logout
   docker login -u jagadeesh2606
   ```
   When prompted for **Password**, paste your Docker Hub **Personal Access Token** (the same one in `iapp.config.json`). Do not use your Docker Hub account password if you have 2FA enabled—only the PAT works.

2. **Confirm the PAT has Write access**  
   Docker Hub → Account settings → Security → Personal access tokens. The token must have **Read & Write** (or at least **Write**). Create a new token if needed and update both `docker login` and `dockerhubAccessToken` in `iapp.config.json`.

3. **Deploy again:**
   ```bash
   iapp deploy
   ```

---

## Troubleshooting: "Failed to transform your app into a TEE app: Internal error" (500)

The sconify API at iapp-api.iex.ec returned **500 Internal error**. Common causes:

1. **Unsupported base image** – TEE transformation supports only certain base images. This project’s Dockerfile uses **`node:22-alpine3.21`** to match the official iapp JavaScript template. If you changed `FROM`, restore it or use the template’s base image.
2. **Retry** – Server-side 500s are often transient. Run `iapp deploy` again (use a new version e.g. 0.0.2 if prompted).
3. **Report to iExec** – If it persists, share the session id from the debug output (e.g. `DEBUG=iapp iapp deploy`) with iExec (Discord / GitHub) so they can check server logs.
