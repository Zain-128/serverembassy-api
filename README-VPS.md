# ServerEmbassy API - VPS Deployment Guide

## Quick Start on VPS

1. Upload and extract:
```bash
unzip serverembassy-api-deploy.zip -d /var/www/serverembassy-api
cd /var/www/serverembassy-api
```

2. Install production dependencies:
```bash
npm ci --omit=dev
```

3. Configure Environment:
```bash
cp .env.example .env
nano .env # Set MONGODB_URI, JWT_SECRET, PORT=4000, etc.
```

4. Start with PM2:
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

5. Test Healthcheck:
```bash
curl http://localhost:4000/api/health
```
