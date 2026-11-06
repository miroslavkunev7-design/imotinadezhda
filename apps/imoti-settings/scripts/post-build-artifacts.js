const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const outDir = path.join(__dirname, "..", "dist-installer");
if (!fs.existsSync(outDir)) {
  console.warn("post-build: dist-installer missing — skip");
  process.exit(0);
}

const nsis = fs
  .readdirSync(outDir)
  .find((n) => /^ImotiNadezhda-Settings-.*-x64\.exe$/.test(n));
if (nsis) {
  fs.copyFileSync(
    path.join(outDir, nsis),
    path.join(outDir, "ImotiNadezhda-Settings-Setup.exe")
  );
  console.log("wrote ImotiNadezhda-Settings-Setup.exe");
}

const unpacked = path.join(outDir, "win-unpacked");
if (fs.existsSync(unpacked)) {
  const seven = path.join(outDir, "ImotiNadezhda-Settings-1.0.0-portable.7z");
  if (fs.existsSync(seven)) fs.unlinkSync(seven);
  execFileSync(
    "7z",
    ["a", "-t7z", "-mx=9", seven, "."],
    { cwd: unpacked, stdio: "inherit" }
  );
  console.log("wrote ImotiNadezhda-Settings-1.0.0-portable.7z");

  // Full zip for Windows Expand-Archive (may exceed some store mounts ~100MB)
  const zipPath = path.join(outDir, "ImotiNadezhda-Settings-1.0.0-portable.zip");
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: unpacked, stdio: "inherit" });
  console.log("wrote ImotiNadezhda-Settings-1.0.0-portable.zip");
}
