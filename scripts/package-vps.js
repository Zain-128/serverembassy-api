import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("🚀 Preparing API build for VPS deployment...");

// 1. Run build locally
console.log("📦 Compiling TypeScript (npm run build)...");
execSync("npm run build", { cwd: projectRoot, stdio: "inherit" });

// 2. Prepare PM2 ecosystem file
const pm2Config = `module.exports = {
  apps: [
    {
      name: "serverembassy-api",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 4000
      }
    }
  ]
};
`;
fs.writeFileSync(path.join(projectRoot, "ecosystem.config.cjs"), pm2Config);

// 3. Create README-VPS.md
const readmeVps = `# ServerEmbassy API - VPS Deployment Guide

## Quick Start on VPS

1. Upload and extract:
\`\`\`bash
unzip serverembassy-api-deploy.zip -d /var/www/serverembassy-api
cd /var/www/serverembassy-api
\`\`\`

2. Install production dependencies:
\`\`\`bash
npm ci --omit=dev
\`\`\`

3. Configure Environment:
\`\`\`bash
cp .env.example .env
nano .env # Set MONGODB_URI, JWT_SECRET, PORT=4000, etc.
\`\`\`

4. Start with PM2:
\`\`\`bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
\`\`\`

5. Test Healthcheck:
\`\`\`bash
curl http://localhost:4000/api/health
\`\`\`
`;
fs.writeFileSync(path.join(projectRoot, "README-VPS.md"), readmeVps);

// 4. Target Zip File
const outputZip = path.join(projectRoot, "serverembassy-api-deploy.zip");

if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}

// 5. Files/Folders to include
const candidateItems = [
  "dist",
  "index.js",
  "package.json",
  "package-lock.json",
  ".env.example",
  "ecosystem.config.cjs",
  ".htaccess",
  "README-VPS.md",
];

const itemsToZip = candidateItems.filter((item) => {
  const itemPath = path.join(projectRoot, item);
  return fs.existsSync(itemPath);
});

console.log("🤐 Archiving production build into serverembassy-api-deploy.zip...");
console.log("   Including:", itemsToZip.join(", "));

try {
  execSync(`zip -r "${outputZip}" ${itemsToZip.join(" ")}`, {
    cwd: projectRoot,
    stdio: "inherit",
  });
  console.log("\n✅ SUCCESS: VPS API build created successfully!");
  console.log(`📁 Zip Package: ${outputZip}`);
  const stats = fs.statSync(outputZip);
  console.log(`📏 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} catch (error) {
  console.error("❌ Failed to zip package:", error);
  process.exit(1);
}
