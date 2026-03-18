# 🚂 Railway.app Deployment Guide

## Deploy Your DLM to Railway in 5 Minutes!

Railway.app is perfect for deploying your Distributed Log Monitoring System because it supports Docker Compose natively and offers generous free tier credits.

---

## 📋 **Prerequisites:**

- ✅ GitHub account (you have it!)
- ✅ DML repository on GitHub (done! https://github.com/Nishant27203/DML)
- ✅ Railway account (free to create)

---

## 🎯 **Step-by-Step Deployment:**

### **Step 1: Create Railway Account**

1. Go to **[https://railway.app](https://railway.app)**
2. Click **"Start a New Project"**
3. Sign in with **GitHub** (recommended) or email

---

### **Step 2: Deploy from GitHub**

#### **Option A: Using Railway Dashboard (Easiest)**

1. **Click "New Project"** → **"Deploy from GitHub repo"**
2. **Search for your repo:** `Nishant27203/DML`
3. **Select it** and click **"Deploy Now"**

Railway will automatically:
- Detect your `docker-compose.yml`
- Build all 5 services
- Set up networking between services
- Deploy to the cloud

---

#### **Option B: Using Railway CLI (More Control)**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project in your DLM folder
cd /Users/nishant/DLM
railway init

# Link to your GitHub repo
railway link

# Deploy everything
railway up
```

---

## ⚙️ **Configuration Needed:**

Railway will auto-detect most settings, but you may need to configure:

### **1. Environment Variables**

In Railway dashboard, add these variables:

```bash
# PostgreSQL
POSTGRES_USER=dlm_user
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=dlm_db
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# Elasticsearch
ELASTICSEARCH_PORT=9200

# Ingestion API
INGESTION_PORT=3001

# Worker
WORKER_CONCURRENCY=5
```

### **2. Port Mappings**

Railway provides public URLs for services. You'll get:
- Ingestion API: `https://your-project.railway.app`
- Analytics API: `https://another-url.railway.app`

---

## 💰 **Pricing & Free Tier:**

- **Free tier:** $5/month credit (enough for small projects)
- **Hobby plan:** $5/month (more resources)
- **Pro plan:** Pay-as-you-go

**Estimated cost for DLM:** ~$5-10/month depending on usage

---

## 🔧 **Post-Deployment Steps:**

### **1. Update Environment Variables**

After deployment, update your `.env` file with Railway-provided URLs:

```bash
# Railway gives you permanent URLs
INGESTION_API_URL=https://your-ingestion.railway.app
ELASTICSEARCH_URL=https://your-es.railway.app
REDIS_URL=redis://your-redis.railway.app
DATABASE_URL=postgresql://user:pass@your-postgres.railway.app
```

### **2. Test Your Live System**

```bash
# Send test log to your Railway deployment
curl -X POST https://your-ingestion.railway.app/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test" \
  -d '{"logs":[{"service_name":"production-app","log_level":"info","message":"Deployed to Railway!","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}]}'
```

### **3. Monitor Logs**

Railway dashboard shows real-time logs for all services:
- Ingestion API logs
- Worker processing logs
- Database queries
- Elasticsearch indexing

---

## 🎨 **Railway-Specific Optimizations:**

### **Create `railway.json` for Better Control**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "startCommand": "docker-compose up",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### **Or Use Railway's Native Format**

Create separate services in Railway UI:
1. **PostgreSQL Service** (one-click database)
2. **Redis Service** (one-click cache)
3. **Elasticsearch Service** (custom Dockerfile)
4. **Ingestion API** (from `services/ingestion-api/Dockerfile`)
5. **Worker Service** (from `services/worker-service/Dockerfile`)

---

## 📊 **Benefits of Railway vs Self-Hosting:**

| Feature | Railway | Self-Hosted Docker |
|---------|---------|-------------------|
| Setup Time | 5 minutes | 30+ minutes |
| SSL/HTTPS | Automatic | Manual |
| Backups | Built-in | Manual |
| Scaling | One-click | Complex |
| Monitoring | Built-in | Manual setup |
| Cost | $5-10/month | Free (local only) |
| Uptime | 99.9% SLA | Depends on you |

---

## 🔄 **Continuous Deployment:**

Once connected to GitHub:
- Every `git push` automatically deploys to Railway
- See changes live in ~2 minutes
- Rollback to previous versions easily

```bash
# Just push updates
cd /Users/nishant/DLM
git add .
git commit -m "Update feature"
git push origin main
# Railway auto-deploys!
```

---

## 🚨 **Troubleshooting:**

### **Build Fails:**
- Check Railway build logs in dashboard
- Ensure all Dockerfiles work locally
- Verify `docker-compose.yml` syntax

### **Services Can't Connect:**
- Use Railway's internal service URLs
- Check environment variables
- Verify ports are exposed correctly

### **Database Issues:**
- Railway PostgreSQL is managed (no init.sql by default)
- Run init script manually or use migrations

---

## 🎯 **Quick Start Command:**

If you have Railway CLI:

```bash
cd /Users/nishant/DLM
railway login
railway init --template docker-compose
railway up
```

---

## 📈 **Next Steps After Deployment:**

1. **Add custom domain** (optional)
   - Railway → Settings → Domains
   
2. **Set up monitoring alerts**
   - Railway → Metrics → Alerts
   
3. **Configure auto-scaling**
   - Railway → Service → Scaling
   
4. **Share your live URL!**
   - `https://your-dlm-production.railway.app`

---

## 🌟 **Why Railway is Perfect for DLM:**

✅ **Docker Compose Support** - Works with your existing setup
✅ **All Services in One Place** - DB, Redis, ES, APIs
✅ **Automatic SSL** - HTTPS out of the box
✅ **Easy Scaling** - Handle more logs as needed
✅ **Great Developer Experience** - Intuitive dashboard
✅ **Affordable** - Free tier available

---

## 🔗 **Useful Links:**

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Your Repo: https://github.com/Nishant27203/DML
- Railway Dashboard: https://railway.app/dashboard

---

**Ready to deploy? Head to [railway.app](https://railway.app) and connect your GitHub repo!** 🚀
