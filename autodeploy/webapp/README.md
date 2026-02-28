# AutoDeploy — Web App

Portale self-service per il provisioning VM Windows su Azure.

## Architettura

```
webapp/
├── frontend/        # React + Vite (UI form + stato job)
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/         # Node.js + Express (proxy REST verso Rundeck API)
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   └── services/
│   ├── .env.example
│   └── package.json
│
└── README.md
```

## Flusso

1. L'utente compila il form (nome VM, join dominio sì/no).
2. Il frontend invia un POST al backend (`/api/deploy`).
3. Il backend genera il JSON corretto e chiama la Rundeck API:
   - Job 1: Terraform (provisioning infra)
   - Job 2: Ansible (domain join) — solo se richiesto
4. Il frontend mostra avanzamento e log in tempo reale (polling).

## Sviluppo locale

```bash
# Backend
cd backend
npm install
cp .env.example .env   # configurare RUNDECK_URL e RUNDECK_TOKEN
npm run dev

# Frontend (in un altro terminale)
cd frontend
npm install
npm run dev
```

Il frontend in dev proxya le chiamate `/api/*` al backend (porta 3001).

## Deploy su auto01

```bash
# 1. Clona / pull il repo
cd /srv/autodeploy   # o la directory del repo
git pull

# 2. Build frontend
cd autodeploy/webapp/frontend
npm install
npm run build          # genera dist/

# 3. Backend
cd ../backend
npm install
cp .env.example .env
```

Modifica `.env` con i valori reali:

| Variabile          | Come ottenerla                                                        |
|--------------------|-----------------------------------------------------------------------|
| `RUNDECK_URL`      | `http://10.0.0.5:4440`                                               |
| `RUNDECK_TOKEN`    | Rundeck UI → User menu → Profile → API Tokens → "+" → genera token  |
| `JOB1_ID`          | Rundeck UI → Jobs → Job 1 → UUID nella URL o dettagli               |
| `JOB2_ID`          | Rundeck UI → Jobs → Job 2 → UUID nella URL o dettagli               |
| `PORT`             | `3001` (default)                                                      |

```bash
# 4. Avvia il server
npm start              # oppure npm run dev (con nodemon)
```

Apri il browser su `http://10.0.0.5:3001`.

> **Produzione**: in `server.js` il backend serve automaticamente i file statici
> dalla cartella `../frontend/dist` — non serve un web server separato.

## File structure

```
webapp/
├── frontend/
│   ├── src/
│   │   ├── main.jsx               # React entry point
│   │   ├── App.jsx                 # Orchestrazione workflow
│   │   ├── index.css               # Stili (dark theme)
│   │   ├── api.js                  # Fetch wrapper verso backend
│   │   └── components/
│   │       ├── DeployForm.jsx      # Form: nome VM + join checkbox
│   │       └── JobStatus.jsx       # Polling status + log streaming
│   ├── index.html
│   ├── vite.config.js              # Proxy /api → :3001
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── server.js               # Express server
│   │   ├── routes/
│   │   │   ├── deploy.js           # POST /api/deploy, POST /api/deploy/job2
│   │   │   └── jobs.js             # GET /api/jobs/:id, GET /api/jobs/:id/log
│   │   └── services/
│   │       └── rundeck.js          # Rundeck API v46 client
│   ├── .env.example
│   └── package.json
│
└── README.md
```
