# MyVintage

A vintage marketplace web application where users can browse, list, and trade vintage items. Features AI-powered smart search (Gemini), Google OAuth login, image uploads, offers/transactions, and a Swagger API explorer.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 8, React Router 7, Axios |
| Backend | Node.js, Express 5, TypeScript, Mongoose (MongoDB) |
| Auth | JWT (access + refresh tokens), Google OAuth 2.0 (Passport) |
| AI | Google Gemini 2.5 Flash Lite (smart search) |
| Docs | Swagger UI (`/api-docs`) |
| Database | MongoDB 7 |

## Project Structure

```
MyVintage/
├── client/          # React + Vite frontend
├── server/          # Express + TypeScript backend
│   ├── src/
│   │   ├── config/      # Passport, Swagger config
│   │   ├── controllers/ # Route handlers
│   │   ├── models/      # Mongoose schemas
│   │   ├── routes/      # Express routers
│   │   └── services/    # AI, DB, OAuth logic
│   ├── seed/        # Seed data + images for dev
│   └── tests/       # Jest + Supertest tests
└── docker-compose.yml  # MongoDB + seed service
```

---

## Deployment Guide (Step by Step)

### Prerequisites

- **Node.js** >= 22
- **npm** >= 10
- **MongoDB** 7+ (local install, Docker, or a cloud instance like MongoDB Atlas)
- **Git**

### Step 1 — Clone the Repository

```bash
git clone https://github.com/lirjudelewicz/MyVintage.git
cd MyVintage
```

### Step 2 — Start MongoDB

**Option A — Docker (recommended for local dev):**

```bash
docker compose up -d mongo
```

This starts MongoDB on `localhost:27017`.

**Option B — MongoDB Atlas (cloud):**

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a database user and whitelist your IP.
3. Copy the connection string (e.g. `mongodb+srv://user:pass@cluster.mongodb.net/myvintage`).

**Option C — Local install:**

Make sure `mongod` is running on port 27017.

### Step 3 — Configure the Backend

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and fill in the required values:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MongoDB connection string (e.g. `mongodb://localhost:27017/myvintage`) | Yes |
| `JWT_SECRET` | Random secret for signing access tokens — generate with `openssl rand -hex 32` | Yes |
| `REFRESH_TOKEN_SECRET` | Random secret for refresh tokens — generate with `openssl rand -hex 32` | Yes |
| `JWT_EXPIRES_IN` | Access token lifetime (default: `15m`) | No |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifetime (default: `7d`) | No |
| `PORT` | Backend port (default: `4000`) | No |
| `GEMINI_API_KEY` | Google Gemini API key for AI smart search — get one free at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | No (falls back to keyword search) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID — create at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) | No (disables Google login) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No (disables Google login) |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL (default: `http://localhost:4000/api/auth/google/callback`) | No |
| `CLIENT_URL` | Frontend origin for CORS (default: `http://localhost:5173`) | No |

### Step 4 — Install Dependencies and Build the Backend

```bash
# Still in server/
npm install
npm run start    # compiles TypeScript and starts the server
```

For development with hot-reload:

```bash
npm run dev
```

The server runs on `http://localhost:4000` by default. API docs are available at `http://localhost:4000/api-docs`.

### Step 5 — (Optional) Seed the Database

Populate the database with sample users, posts, and images:

```bash
# From the server/ directory
npm run seed
```

Or use Docker Compose to seed automatically:

```bash
# From the project root
docker compose up seed
```

### Step 6 — Configure the Frontend

```bash
cd ../client
cp .env.example .env
```

In development the default empty `VITE_API_URL` is fine — Vite proxies `/api` and `/media` requests to the backend automatically.

### Step 7 — Install Dependencies and Build the Frontend

```bash
npm install
```

**Development:**

```bash
npm run dev
```

Opens on `http://localhost:5173`.

**Production build:**

```bash
npm run build
```

The output goes into `client/dist/`. Serve it with any static file server or reverse proxy.

### Step 8 — Production Deployment with nginx (Recommended)

For production, use **nginx** as a reverse proxy that serves the frontend static files and proxies API requests to the backend.

Example `/etc/nginx/sites-available/myvintage`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend — static files
    root /path/to/MyVintage/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Media uploads proxy
    location /media/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
    }
}
```

Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/myvintage /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Step 9 — Keep the Backend Running (PM2)

Use **PM2** to keep the Node server alive in production:

```bash
npm install -g pm2

cd /path/to/MyVintage/server
npm run start                     # build first
pm2 start dist/src/app.js --name myvintage
pm2 save
pm2 startup                       # auto-start on reboot
```

---

## Running Tests

```bash
cd server
npm test
```

Tests use an in-memory MongoDB instance, so no external database is needed.

## API Documentation

Once the server is running, visit:

```
http://localhost:4000/api-docs
```

Swagger UI provides interactive documentation for all API endpoints.

## Environment Variables Reference

See [`server/.env.example`](server/.env.example) and [`client/.env.example`](client/.env.example) for full lists with comments.
