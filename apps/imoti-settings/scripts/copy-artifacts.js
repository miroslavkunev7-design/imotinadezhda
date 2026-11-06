const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "dist-installer");
const storeDir = process.env.SETTINGS_ARTIFACT_DIR ||
  "/cursor/stores/bc-01a19876-3883-7511-ae72-cb6e59cf6bcc/media/settings-app";
const readmeOnly = !fs.existsSync(srcDir);

fs.mkdirSync(storeDir, { recursive: true });

const note = [
  "# Imoti Nadezhda Settings — build artifacts",
  "",
  "Default install path: `D:\\\\ImotiNadezhda-Settings`",
  "Targets: Windows x64 portable + NSIS (desktop shortcut).",
  "",
  "Agent chat uses **separate** Settings n8n/TED + video endpoints",
  "(`VITE_SETTINGS_TED_API`, `VITE_SETTINGS_VIDEO_API`) — not official site TED.",
  "",
  readmeOnly
    ? "Installer binaries not produced on this Linux agent (no Win worker). Run `npm run build` on Windows x64 or wine-enabled CI, then re-run `npm run pack:artifacts`."
    : "Copied from apps/imoti-settings/dist-installer on " + new Date().toISOString(),
  ""
].join("\n");

fs.writeFileSync(path.join(storeDir, "README.md"), note);

if (!readmeOnly) {
  for (const name of fs.readdirSync(srcDir)) {
    const from = path.join(srcDir, name);
    const to = path.join(storeDir, name);
    if (fs.statSync(from).isFile()) fs.copyFileSync(from, to);
  }
}

console.log("Artifacts folder:", storeDir);
