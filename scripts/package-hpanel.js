import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("🚀 Preparing API build for Hostinger hPanel...");

// 1. Run build locally
console.log("📦 Compiling TypeScript (npm run build)...");
execSync("npm run build", { cwd: projectRoot, stdio: "inherit" });

// 2. Target Zip File
const outputZip = path.join(projectRoot, "serverembassy-api-hpanel.zip");

if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}

// 3. Files/Folders to include (including src & tsconfig.json so Hostinger's build pipeline can execute `yarn run build`)
const candidateItems = [
  "src",
  "dist",
  "tsconfig.json",
  "index.js",
  "package.json",
  "yarn.lock",
  "package-lock.json",
  ".env.example",
  ".htaccess",
];

const itemsToZip = candidateItems.filter((item) => {
  const itemPath = path.join(projectRoot, item);
  return fs.existsSync(itemPath);
});

console.log("🤐 Archiving production build into serverembassy-api-hpanel.zip...");
console.log("   Including:", itemsToZip.join(", "));

try {
  execSync(`zip -r "${outputZip}" ${itemsToZip.join(" ")}`, {
    cwd: projectRoot,
    stdio: "inherit",
  });
  console.log("\n✅ SUCCESS: Hostinger hPanel build created successfully!");
  console.log(`📁 Zip Package: ${outputZip}`);
  const stats = fs.statSync(outputZip);
  console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} catch (error) {
  console.error("❌ Failed to create zip package:", error);
  process.exit(1);
}
