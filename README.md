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