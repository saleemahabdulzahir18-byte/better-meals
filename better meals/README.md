# Better Meals — Local Preview & Deployment

This repo contains a Vite + React frontend and a simple Express backend used for prototyping dietary profile and recipe recommendations.

Quick local preview (recommended)

1. Install Node LTS (if not installed)

```powershell
# Windows (winget)
winget install OpenJS.NodeJS.LTS -e
```

2. Start the backend and frontend in two terminals

```powershell
# Terminal A — backend
cd backend
npm install
npm run dev

# Terminal B — frontend
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

3. Create a private preview with ngrok

```powershell
npx ngrok http 5173
# Copy the https://... forwarding URL and share
```

Production / Vercel

- Deploy the backend to a server (Render, Railway, Heroku, or similar) and note its base URL (e.g. `https://api.example.com`).
- In your Vercel project settings for the `frontend` repo, set the environment variable `VITE_API_URL` to your backend base URL.
- Push to GitHub and import the repo in Vercel — it will build the frontend and use the provided `VITE_API_URL`.

Notes
- The frontend uses `VITE_API_URL` at runtime (fallback: `http://localhost:4000`).
- The `frontend/preview.html` file is a static mockup you can open without running servers to see a visual preview.