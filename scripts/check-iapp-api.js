#!/usr/bin/env node
/**
 * Check connectivity to hosts used by iapp deploy during "Transforming your image into a TEE image".
 * Run: node scripts/check-iapp-api.js
 * The "fetch failed" error is usually from auth.docker.io (Docker Hub token), not iapp-api.iex.ec.
 */
import https from "node:https";

const timeoutMs = 10000;

function check(host, label) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://${host}/`,
      { timeout: timeoutMs },
      (res) => {
        res.destroy();
        resolve();
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function main() {
  console.log("Checking hosts used by iapp deploy (TEE transform step)...\n");

  // This is the fetch that usually fails: CLI gets a token so sconify can push TEE image to your Docker Hub
  try {
    await check("auth.docker.io", "Docker Hub auth");
    console.log("✔ auth.docker.io — reachable (CLI fetches token here; 'fetch failed' often points here)");
  } catch (err) {
    console.error("✖ auth.docker.io — failed:", err.message);
    console.error("  → Fix: use another network, or set HTTP_PROXY/HTTPS_PROXY if behind a proxy.\n");
    process.exit(1);
  }

  // Optional: also check iapp-api (WebSocket host)
  try {
    await check("iapp-api.iex.ec", "iExec TEE API");
    console.log("✔ iapp-api.iex.ec — reachable");
  } catch (err) {
    console.error("✖ iapp-api.iex.ec — failed:", err.message);
    process.exit(1);
  }

  console.log("\nBoth hosts OK. If iapp deploy still fails, try again later or run: DEBUG=iapp iapp deploy");
}

main();
