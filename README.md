# Event

## Struktur
- `frontend/` React (Vite)
- `backend/` Node.js (Express)
- `docker-compose.yml` Postgres

## Starta Postgres
```bash
docker compose up -d
```

## Starta backend
```bash
cd backend
npm install
npm run dev
```

## Starta frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Testa:
- `http://localhost:3001/health`
- `http://localhost:3001/db`
