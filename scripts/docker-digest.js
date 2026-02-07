#!/usr/bin/env node
/**
 * After building the image, print its digest for iexec.json app.checksum.
 * Usage: npm run build:docker (or build:docker:amd64), then npm run digest
 * Or: docker build ... && node scripts/docker-digest.js
 */
import { execSync } from "child_process";

const image = process.env.DOCKER_IMAGE || "shadowsettle/settlement:latest";
try {
  const out = execSync(`docker image inspect ${image} --format '{{.Id}}'`, { encoding: "utf8" });
  const id = out.trim();
  if (id.startsWith("sha256:")) {
    console.log("0x" + id.replace("sha256:", ""));
  } else {
    console.log(id);
  }
} catch (e) {
  console.error("Build the image first: npm run build:docker");
  process.exit(1);
}
