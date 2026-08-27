# CoopConnect backend

FastAPI service for the CoopConnect frontend.

## Run locally

```bash
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

The API is available at `http://localhost:8000`, with interactive docs at `/docs`.

## Deployment settings

Use a Python-capable host for this service and configure:

- `DATABASE_URL`: a managed PostgreSQL URL in production. SQLite remains the local default.
- `FRONTEND_ORIGINS`: comma-separated frontend origins, such as `https://your-site.netlify.app`.

The included `Procfile` starts the service using the host-provided `PORT`.

## Netlify deployment

Deploy the repository to Netlify using the included `netlify.toml`. Deploy the
FastAPI service separately with `render.yaml`, then set the Netlify environment
variable `API_BASE_URL` to the public Render URL, for example
`https://coop-connect-api.onrender.com`. Also set the Render variable
`FRONTEND_ORIGINS` to the Netlify site URL. Netlify's `/api/*` redirect then
proxies all browser requests to FastAPI.