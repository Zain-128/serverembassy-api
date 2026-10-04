# Hostinger hPanel API Deployment Guide

This guide details how to build, upload, and deploy the `serverembassy-api` Node.js backend on **Hostinger hPanel**.

---

## 1. Generating the hPanel Upload Package

Run the following command in `serverembassy-api/`:

```bash
npm run build:hpanel
```

This script will:
1. Compile TypeScript source code into JavaScript (`dist/`).
2. Include the root entry point `index.js`, `.htaccess`, `package.json`, `package-lock.json`, and `.env.example`.
3. Package everything into a deployment-ready zip file: **`serverembassy-api-hpanel.zip`**.

---

## 2. Uploading to Hostinger hPanel

1. Log in to your **Hostinger hPanel**.
2. Go to **Files** -> **File Manager** (or connect via FTP).
3. Create or navigate to your target API directory (e.g., `public_html/api` or a subdomain directory like `api.yourdomain.com`).
4. Upload **`serverembassy-api-hpanel.zip`** to that folder.
5. Extract the zip file in that folder.

---

## 3. Configuring Node.js Application in hPanel

1. In hPanel, go to **Advanced** -> **Node.js** (or search for **Node.js** in the search bar).
2. Click **Create Application**.
3. Set the following configuration:
   - **Node.js Version**: `18.x`, `20.x`, or `22.x`
   - **Application Root**: `api` (or relative path to where files were extracted)
   - **Application URL**: `api.yourdomain.com` (or your chosen path/domain)
   - **Application Startup File**: `index.js`
4. Save / Create the Application.

---

## 4. Installing Dependencies & Environment Variables

1. Under the Node.js application management page in hPanel:
   - Click **Run NPM Install** (or access Terminal in hPanel, `cd` to the directory, and run `npm install --omit=dev`).
2. Set Environment Variables in hPanel or create a `.env` file in your application root folder with:

```env
NODE_ENV=production
PORT=4000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret_key
JWT_EXPIRES_IN=7d
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

3. Click **Restart Application** in Hostinger hPanel.

---

## 5. Verification

Test your API endpoint:
- `https://api.yourdomain.com/health` (or `/api/health` depending on your routing setup).
