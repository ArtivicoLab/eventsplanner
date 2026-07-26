import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

// CI sets VITE_COMMIT_SHA per build, but that env var is blank in local dev —
// fall back to the actual local HEAD sha so the footer always reflects the
// code that's running (see CLAUDE.md's "Version control" section).
const localSha = (() => {
  try {
    return execSync("git rev-parse --short=7 HEAD").toString().trim();
  } catch {
    return "";
  }
})();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __LOCAL_COMMIT_SHA__: JSON.stringify(localSha),
  },
  // Fixed port: once a Google OAuth client is created for this app, its
  // Authorized JavaScript origin should be registered as
  // http://localhost:5518 specifically — strictPort so a stale server on
  // this port fails loudly instead of silently drifting to another port
  // (which breaks sign-in without any obvious error). 5518 keeps this app
  // clear of its siblings: TrackerA=5508, B=5510, C=5512, D=5514, E=5516.
  server: {
    port: 5518,
    strictPort: true,
  },
});
