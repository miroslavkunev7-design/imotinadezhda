const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const srcDir = path.join(__dirname, "..", "dist-installer");
const storeDir =
  process.env.SETTINGS_ARTIFACT_DIR ||
  "/cursor/stores/bc-01a19876-3883-7511-ae72-cb6e59cf6bcc/media/settings-app";

fs.mkdirSync(storeDir, { recursive: true });

const readmeOnly = !fs.existsSync(srcDir);

function streamCopy(from, to) {
  // Prefer dd: some Cursor store mounts reject large Node copyFileSync / close
  try {
    execFileSync("dd", [`if=${from}`, `of=${to}`, "bs=4M", "status=none"], {
      stdio: "inherit"
    });
  } catch (err) {
    console.warn(`streamCopy failed for ${path.basename(to)}:`, err.message);
    return false;
  }
  if (!fs.existsSync(to) || fs.statSync(to).size === 0) {
    console.warn(`streamCopy produced empty ${path.basename(to)}`);
    try {
      fs.unlinkSync(to);
    } catch {
      /* ignore */
    }
    return false;
  }
  const size = fs.statSync(to).size;
  console.log(`copied ${path.basename(to)} (${(size / 1024 / 1024).toFixed(1)} MiB)`);
  return true;
}

const noteLines = [
  "# Imoti Nadezhda Settings — build artifacts",
  "",
  "Default install path: `D:\\\\ImotiNadezhda-Settings`",
  "Targets: Windows x64 portable + NSIS (desktop shortcut).",
  "",
  "Agent chat uses **separate** Settings n8n/TED + video endpoints",
  "(`VITE_SETTINGS_TED_API`, `VITE_SETTINGS_VIDEO_API`) — not official site TED.",
  "",
  readmeOnly
    ? "Installer binaries missing — run `npm run build` then `npm run pack:artifacts`."
    : "Copied from apps/imoti-settings/dist-installer on " + new Date().toISOString(),
  ""
];

if (!readmeOnly) {
  const prefer = [
    "ImotiNadezhda-Settings-Setup.exe",
    "ImotiNadezhda-Settings-1.0.0-x64.exe",
    "ImotiNadezhda-Settings-1.0.0-portable.exe",
    "ImotiNadezhda-Settings-1.0.0-portable.7z",
    "ImotiNadezhda-Settings-1.0.0-portable.zip"
  ];

  const nsis = fs
    .readdirSync(srcDir)
    .find((n) => /^ImotiNadezhda-Settings-.*-x64\.exe$/.test(n));
  if (nsis && !fs.existsSync(path.join(srcDir, "ImotiNadezhda-Settings-Setup.exe"))) {
    fs.copyFileSync(
      path.join(srcDir, nsis),
      path.join(srcDir, "ImotiNadezhda-Settings-Setup.exe")
    );
  }

  const failed = [];
  for (const name of prefer) {
    const from = path.join(srcDir, name);
    if (!fs.existsSync(from)) continue;
    if (!streamCopy(from, path.join(storeDir, name))) failed.push(name);
  }

  if (failed.length) {
    noteLines.push(
      "Store mount could not accept: `" + failed.join("`, `") + "`.",
      "Prefer `ImotiNadezhda-Settings-Setup.exe` / `*-portable.exe` / `*-portable.7z`.",
      ""
    );
  }
}

fs.writeFileSync(path.join(storeDir, "README.md"), noteLines.join("\n"));
console.log("Artifacts folder:", storeDir);
