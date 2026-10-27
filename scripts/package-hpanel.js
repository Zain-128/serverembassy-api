import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("🚀 Preparing ServerEmbassy API build package for Hostinger hPanel...");

// 1. Run TypeScript build locally
console.log("📦 Compiling TypeScript (npm run build)...");
execSync("npm run build", { cwd: projectRoot, stdio: "inherit" });

// 2. Ensure root startup files exist (index.js, server.js, app.js) so any hPanel selection works
const startupShim = `// Hostinger hPanel Node.js Application Startup File
import "./dist/index.js";
`;

fs.writeFileSync(path.join(projectRoot, "index.js"), startupShim);
fs.writeFileSync(path.join(projectRoot, "server.js"), startupShim);
fs.writeFileSync(path.join(projectRoot, "app.js"), startupShim);

// 3. Ensure .htaccess is optimized for LiteSpeed / Apache reverse proxy
const htaccessContent = `# Hostinger hPanel LiteSpeed / Apache Reverse Proxy Configuration for ServerEmbassy API
DirectoryIndex disabled
Options -Indexes

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_URI} ^/\\.well-known/ [NC]
  RewriteRule ^ - [L]

  RewriteCond %{HTTP:Upgrade} =websocket [NC]
  RewriteRule /(.*) ws://127.0.0.1:4000/$1 [P,L]

  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ http://127.0.0.1:4000/$1 [P,L]
</IfModule>
`;
fs.writeFileSync(path.join(projectRoot, ".htaccess"), htaccessContent);

// 4. Ensure ecosystem.config.cjs exists
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

// 5. Target Zip File
const outputZip = path.join(projectRoot, "serverembassy-api-hpanel.zip");
if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}

// 6. Files/Folders to include
const candidateItems = [
  "dist",
  "src",
  "tsconfig.json",
  "index.js",
  "server.js",
  "app.js",
  "package.json",
  "package-lock.json",
  ".env.example",
  ".htaccess",
  "ecosystem.config.cjs",
  "README-HPANEL.md",
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
  const stats = fs.statSync(outputZip);
  console.log("\n✅ SUCCESS: Hostinger hPanel build created successfully!");
  console.log(`📁 Zip Package: ${outputZip}`);
  console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} catch (error) {
  console.error("❌ Failed to create zip package:", error);
  process.exit(1);
}
