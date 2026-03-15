# RSU AI Assistant

A Telegram bot that answers questions for Rangsit University students, backed by a Vertex AI RAG corpus and managed through a Next.js admin dashboard.

---

## Architecture

```
Students
  │
  ▼ Telegram
┌─────────────────────────────────┐
│  Backend  (Express.js :3000)    │
│                                 │
│  POST /webhook                  │
│    └─ textHandler               │
│    └─ imageHandler              │
│    └─ commandHandler            │
│                                 │
│  POST /api/admin/*  (JWT auth)  │
│    └─ upload document           │
│    └─ list documents            │
│    └─ delete document           │
│                                 │
│  Workers                        │
│    └─ ragStatusWorker (30s)     │
└────────────┬────────────────────┘
             │
    ┌────────┼─────────────┐
    ▼        ▼             ▼
 Supabase  Google Cloud  Vertex AI
 Postgres  Storage (GCS)  RAG Corpus
                          Gemini 2.5 Flash

Admins
  │
  ▼ Browser
┌─────────────────────────────┐
│  Admin Dashboard (Next.js)  │
│  localhost:3001             │
│                             │
│  /login     Supabase Auth   │
│  /dashboard/upload          │
│  /dashboard/documents       │
└─────────────────────────────┘
```

---

## Features

### Telegram Bot
- Answers university and IT questions via RAG-grounded Gemini responses
- Supports plain text messages, images, and image + caption
- Conversation memory per user — follow-up questions work naturally
- `/start` and `/help` commands
- Thinking indicator while generating responses
- Automatic HTML formatting for Telegram (bold, code blocks, headers)

### Admin Dashboard
- Supabase email/password authentication
- Upload PDF/DOCX/TXT documents → auto-imported into Vertex AI RAG corpus
- View all documents with status (importing / imported / failed)
- Delete documents — removes from RAG corpus, GCS bucket, database, and clears all conversation history
- Real-time import status via background worker polling

### Security
- All `/api/admin/*` routes require a valid Supabase JWT
- Telegram webhook signature verification (`X-Telegram-Bot-Api-Secret-Token`)
- Secrets validated at server startup — fails fast with a clear error
- `.env` excluded from git

---

## Tech Stack

| Layer | Technology |
|---|---|
| Bot / Backend | Node.js, Express.js 5 |
| AI | Google Vertex AI — Gemini 2.5 Flash |
| RAG | Vertex AI RAG Engine |
| File Storage | Google Cloud Storage |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Admin UI | Next.js 15, Tailwind CSS, shadcn/ui |
| Conversation Memory | Supabase `conversation_history` table |

---

## Project Structure

```
rsu-ai-assistant/
├── backend/
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── commandHandler.js      /start, /help commands
│   │   │   ├── imageHandler.js        image + caption pipeline
│   │   │   └── textHandler.js         text message pipeline
│   │   ├── lib/
│   │   │   └── supabase.js            Supabase admin client
│   │   ├── middleware/
│   │   │   └── authMiddleware.js      JWT verification for admin routes
│   │   ├── routes/
│   │   │   ├── adminDocumentsRouter.js
│   │   │   └── telegramRouter.js
│   │   ├── services/
│   │   │   ├── aiService.js           Gemini + RAG pipeline
│   │   │   ├── conversationStore.js   Per-user chat history (Supabase)
│   │   │   ├── documentDeleteService.js
│   │   │   ├── documentService.js     Supabase CRUD for documents
│   │   │   ├── gcsDeleteService.js
│   │   │   ├── gcsService.js          GCS upload
│   │   │   ├── promptService.js       System prompt builder
│   │   │   ├── ragDeleteService.js    Vertex AI RAG file deletion
│   │   │   ├── ragImportService.js    Vertex AI RAG import
│   │   │   ├── ragOperationService.js LRO polling + file lookup
│   │   │   └── telegramService.js     Telegram API wrapper
│   │   ├── utils/
│   │   │   └── logger.js              Structured JSON logger
│   │   ├── workers/
│   │   │   └── ragStatusWorker.js     Polls RAG import status every 30s
│   │   └── server.js
│   ├── scripts/
│   │   └── setCommands.js             Register Telegram bot commands (run once)
│   ├── .env.example                   ← copy to .env and fill in values
│   └── package.json
│
└── admin-dashboard/
    ├── app/
    │   ├── login/
    │   └── dashboard/
    │       ├── page.tsx               Overview
    │       ├── upload/                Upload documents
    │       ├── documents/             Document list + delete
    │       └── activity-logs/
    ├── components/
    │   └── dashboard/
    │       ├── upload-form.tsx
    │       └── delete-document-button.tsx
    └── lib/supabase/
        ├── client.ts                  Browser client
        └── server.ts                  Server component client
```

---

## Setup

### Prerequisites

- Node.js 20+
- A Supabase project
- A Google Cloud project with Vertex AI and GCS enabled
- A Telegram bot token (from BotFather)
- ngrok (for local webhook testing)

### 1. Clone and install

```bash
# Backend
cd backend
npm install

# Admin Dashboard
cd admin-dashboard
npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Fill in all values in .env
```

Required variables:

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Any random string — used to verify webhook requests |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | e.g. `asia-southeast1` |
| `RAG_CORPUS_NAME` | Full resource name of your Vertex AI RAG corpus |
| `GCS_BUCKET_NAME` | GCS bucket for uploaded documents |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (never expose publicly) |

For the admin dashboard, create `admin-dashboard/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

### 3. Create Supabase tables

Run in Supabase SQL Editor:

```sql
-- Document records
create table documents (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  filename         text,
  uploaded_by      text,
  status           text default 'pending',
  gcs_uri          text,
  rag_operation_name text,
  rag_file_name    text,
  error_message    text,
  deleted_at       timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Per-user conversation history
create table conversation_history (
  id         bigserial primary key,
  user_id    bigint      not null,
  role       text        not null check (role in ('user', 'model')),
  content    text        not null,
  created_at timestamptz not null default now()
);

create index on conversation_history (user_id, created_at desc);
```

### 4. Register Telegram webhook

Start ngrok:
```bash
ngrok http 3000
```

Register the webhook (replace with your ngrok URL):
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-ngrok-url.ngrok-free.app/webhook",
    "secret_token": "your-webhook-secret"
  }'
```

### 5. Register bot commands (run once)

```bash
cd backend
node scripts/setCommands.js
```

### 6. Run

```bash
# Backend
cd backend
node src/server.js

# Admin Dashboard (separate terminal)
cd admin-dashboard
npm run dev
```

Admin dashboard: http://localhost:3001

---

## How the RAG pipeline works

```
User message
     │
     ▼
conversationStore.getHistory(userId)     ← load past messages from Supabase
     │
     ▼
askRAG(question, null, history)
     │
     ├─ buildSystemPrompt()              ← RSU assistant instructions
     │
     ├─ Vertex AI RAG retrieval          ← top-5 chunks from corpus
     │
     └─ Gemini 2.5 Flash                 ← grounded response
          │
          ▼
conversationStore.pushToHistory()        ← save turn to Supabase
          │
          ▼
     Telegram reply
```

For images:
```
Photo + caption
     │
     ▼
Gemini Vision → image description
     │
     ▼
Enrich query: [Image Context] + [Student Question]
     │
     ▼
Same RAG pipeline as above
```

---

## Document upload pipeline

```
Admin uploads file
     │
     ▼
POST /api/admin/documents/upload  (JWT verified)
     │
     ├─ Create DB record (status: pending)
     ├─ Upload to GCS
     ├─ Start Vertex AI RAG import (async LRO)
     └─ Update DB record (status: importing)
          │
          ▼ (ragStatusWorker polls every 30s)
     LRO complete?
          ├─ Yes → list corpus files, match by GCS URI → save rag_file_name
          │        update status: imported
          └─ No  → keep polling
```

## Document delete pipeline

```
Admin clicks Delete
     │
     ▼
DELETE /api/admin/documents/:id  (JWT verified)
     │
     ├─ 1. Delete from Vertex AI RAG corpus  (rag_file_name)
     ├─ 2. Delete from GCS                   (gcs_uri)
     ├─ 3. Hard delete DB row
     └─ 4. Clear all conversation_history    ← stale context removed
```

> All conversation history is wiped on document deletion so users
> are never served answers grounded in knowledge that no longer exists.