# RSU AI Assistant

RSU AI Assistant is a Telegram-based university help desk bot with a protected admin dashboard for managing knowledge files. The current codebase uses a Node/Express backend, Google Vertex AI for generation and retrieval, Google Cloud Storage for file uploads, Supabase for admin auth and relational data, and Redis for runtime conversation state, rolling summaries, and lightweight memory.

## Current architecture

```text
Students/Admins
   │
   ├── Telegram Bot
   │      └── /webhook
   │            ├── commandHandler   -> /start, /help, /login, /logout, /me, /cancel
   │            ├── textHandler      -> quick replies, login flow, memory, summary, RAG
   │            └── imageHandler     -> Telegram file download -> Gemini vision -> RAG
   │
   └── Admin Dashboard (Next.js 16, localhost:3001 by default)
          ├── /login
          ├── /dashboard
          ├── /dashboard/upload
          ├── /dashboard/documents
          └── /dashboard/activity-logs
                    │
                    ▼
             Express Backend (localhost:3000 by default)
                    ├── /api/admin/documents          GET
                    ├── /api/admin/documents/upload   POST
                    └── /api/admin/documents/:id      DELETE
                    │
                    ├── Supabase
                    │     ├── admin auth token validation
                    │     ├── documents table
                    │     ├── students table
                    │     └── telegram_links table
                    │
                    ├── Redis
                    │     ├── active sessions
                    │     ├── recent messages
                    │     ├── rolling summaries
                    │     └── long-term memory items
                    │
                    └── Google Cloud
                          ├── GCS bucket for uploaded files
                          ├── Vertex AI Gemini 2.5 Flash
                          └── Vertex AI RAG corpus
```

## What the current codebase already does

### Telegram bot
- Handles `/start`, `/help`, `/login`, `/logout`, `/me`, and `/cancel`.
- Verifies Telegram webhook requests with `x-telegram-bot-api-secret-token` when `TELEGRAM_WEBHOOK_SECRET` is set.
- Supports text messages and photos with optional captions.
- Uses a fast path for simple greetings and common short messages.
- Stores session state in Redis instead of creating relational chat tables.
- Builds AI context from three Redis-backed layers:
  - recent message history
  - rolling conversation summary
  - extracted long-term memory items
- Supports a protected login flow against Supabase `students` and `telegram_links` tables.
- Sends a temporary “Thinking...” message, then edits it with the final answer.

### Retrieval and generation pipeline
- Uses `gemini-2.5-flash` through `@google-cloud/vertexai`.
- Uses Vertex AI retrieval tools with the configured RAG corpus.
- Text path: session -> context builder -> prompt -> RAG retrieval -> grounded answer.
- Image path: Telegram image download -> Gemini image description -> enriched query -> RAG retrieval.
- Includes system prompt rules for privacy and student-data refusal.

### Admin dashboard
- Uses Next.js App Router.
- Uses Supabase email/password auth for admin sign-in.
- Sends the Supabase access token to backend admin routes as a Bearer token.
- Upload page supports these file types:
  - PDF
  - DOCX
  - PPTX
  - HTML/HTM
  - JSON
  - JSONL / NDJSON
  - Markdown
  - TXT
- Documents page fetches existing knowledge files and supports delete.

### Knowledge-file pipeline
1. Admin uploads a file to the backend.
2. Backend validates title, extension, MIME type, and max size.
3. Backend creates a `documents` row in Supabase.
4. Backend uploads the file buffer to GCS.
5. Backend starts a Vertex AI `ragFiles:import` operation.
6. Backend stores the long-running operation name in the document row.
7. Optional background worker polls import operations and marks documents as imported or failed.
8. Delete flow removes the RAG file first, then the GCS object, then the database row.

## Repository structure

```text
telegram-rag-bot-main/
├── README.md
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── scripts/
│   │   ├── hashPassword.js
│   │   └── setCommands.js
│   └── src/
│       ├── server.js
│       ├── handlers/
│       │   ├── commandHandler.js
│       │   ├── imageHandler.js
│       │   └── textHandler.js
│       ├── lib/
│       │   ├── redis.js
│       │   └── supabase.js
│       ├── middleware/
│       │   └── authMiddleware.js
│       ├── routes/
│       │   ├── adminDocumentsRouter.js
│       │   └── telegramRouter.js
│       ├── services/
│       │   ├── aiService.js
│       │   ├── authService.js
│       │   ├── contextBuilder.js
│       │   ├── documentDeleteService.js
│       │   ├── documentService.js
│       │   ├── gcsDeleteService.js
│       │   ├── gcsService.js
│       │   ├── memoryService.js
│       │   ├── messageService.js
│       │   ├── promptService.js
│       │   ├── ragDeleteService.js
│       │   ├── ragImportService.js
│       │   ├── ragOperationService.js
│       │   ├── redisService.js
│       │   ├── sessionService.js
│       │   ├── summaryService.js
│       │   └── telegramService.js
│       ├── utils/
│       │   └── logger.js
│       └── workers/
│           └── ragStatusWorker.js
└── admin-dashboard/
    ├── package.json
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── login/page.tsx
    │   └── dashboard/
    │       ├── layout.tsx
    │       ├── page.tsx
    │       ├── upload/page.tsx
    │       ├── documents/page.tsx
    │       └── activity-logs/page.tsx
    ├── components/
    │   ├── login-form.tsx
    │   ├── dashboard/
    │   │   ├── app-header.tsx
    │   │   ├── app-sidebar.tsx
    │   │   ├── delete-document-button.tsx
    │   │   ├── logout-button.tsx
    │   │   └── upload-form.tsx
    │   └── ui/
    ├── lib/
    │   ├── supabase/client.ts
    │   ├── supabase/server.ts
    │   └── utils.ts
    └── types/
        └── document.ts
```

## Backend request flow

### Text message flow
```text
Telegram -> /webhook
         -> textHandler
         -> quick reply? yes -> sendTelegramMessage
         -> no
         -> getOrCreateActiveSession (Redis)
         -> login flow? yes -> authService -> sendTelegramMessage
         -> no
         -> sendThinking
         -> buildAIContext
               ├── recent messages
               ├── latest summary
               └── relevant memory items
         -> create user message
         -> askRAG
         -> create model message
         -> editTelegramMessage
         -> extractMemory + saveMemoryItems
         -> maybe generateRollingSummary + saveSummary
```

### Image message flow
```text
Telegram image -> /webhook -> imageHandler
               -> get Telegram file path
               -> download image bytes
               -> askAIWithImage (Gemini vision)
               -> askRAG(enriched image query)
               -> save messages in Redis
               -> edit thinking message with final answer
```

### Admin upload flow
```text
Next.js upload form
  -> POST /api/admin/documents/upload
  -> validate auth token
  -> validate file
  -> create documents row
  -> upload file to GCS
  -> start Vertex AI ragFiles:import
  -> update document status to importing
  -> worker resolves operation result later
```

## Tech stack

| Layer | Current choice |
|---|---|
| Backend API | Node.js + Express 5 |
| Admin UI | Next.js 16 App Router |
| Styling | Tailwind CSS + shadcn/ui |
| Bot transport | Telegram Bot API |
| LLM | Gemini 2.5 Flash |
| Retrieval | Vertex AI RAG corpus |
| File storage | Google Cloud Storage |
| Relational data | Supabase Postgres |
| Admin auth | Supabase Auth |
| Session/memory | Redis / ioredis |

## Environment variables

### `backend/.env`

Required by `src/server.js`:

```env
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_SECRET=your-random-secret
PORT=3000
DEBUG=false

GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=asia-southeast1
RAG_CORPUS_NAME=projects/YOUR_PROJECT/locations/asia-southeast1/ragCorpora/YOUR_CORPUS_ID
RAG_EMBEDDING_QPM=1000
GCS_BUCKET_NAME=your-gcs-bucket-name

ADMIN_DASHBOARD_URL=http://localhost:3001

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

REDIS_URL=redis://localhost:6379
ENABLE_RAG_STATUS_WORKER=true

# local development when using a downloaded service-account JSON key
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account-key.json
```

### `admin-dashboard/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

## Setup

### Prerequisites
- Node.js 20+
- A Telegram bot token from BotFather
- A Google Cloud project with Vertex AI and GCS enabled
- A Vertex AI RAG corpus already created
- A Supabase project
- A Redis instance

### 1. Install dependencies

```bash
cd backend
npm install

cd ../admin-dashboard
npm install
```

### 2. Configure backend env
Create `backend/.env` from the template and fill in all real values.

### 3. Configure dashboard env
Create `admin-dashboard/.env.local` and point `NEXT_PUBLIC_BACKEND_URL` to the backend you want to use. For local development this should usually be `http://localhost:3000`.

### 4. Start backend

```bash
cd backend
npm start
```

### 5. Start admin dashboard

```bash
cd admin-dashboard
npm run dev
```

### 6. Register Telegram commands

```bash
cd backend
node scripts/setCommands.js
```

### 7. Local Telegram webhook testing
Expose the backend with Cloudflared or ngrok, then set the Telegram webhook to your public `/webhook` URL using the same `TELEGRAM_WEBHOOK_SECRET` value.

## Suggested Supabase schema

This is the minimum schema implied by the current code.

### `documents`
```sql
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  filename text,
  uploaded_by text,
  status text default 'pending',
  gcs_uri text,
  rag_operation_name text,
  rag_file_name text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### `students`
```sql
create table if not exists students (
  student_id text primary key,
  full_name text not null,
  faculty text,
  major text,
  role text default 'student',
  status text default 'active',
  password_hash text not null
);
```

### `telegram_links`
```sql
create table if not exists telegram_links (
  telegram_user_id text primary key,
  telegram_chat_id text,
  student_id text not null references students(student_id),
  is_active boolean default true,
  linked_at timestamptz default now()
);
```

## Deployment notes

### Local development
- Dashboard usually runs on `http://localhost:3001`.
- Backend usually runs on `http://localhost:3000`.
- If the dashboard still uploads to Cloud Run, check `NEXT_PUBLIC_BACKEND_URL` and restart the Next.js dev server.

### Shared-cloud setup for teammates
A teammate can run this project locally while using the same GCP, Supabase, and Redis, as long as they have:
- a service-account JSON key for your GCP project
- the shared cloud environment values
- their own Telegram bot token if you want separate bots

## Current code review notes

I reviewed the repository structure and the implementation. The architecture is already coherent, but these are the main things worth fixing next:

1. **`backend/.env.example` is incomplete.**
   `src/server.js` requires `REDIS_URL`, but the template does not include it. It should also mention `GOOGLE_APPLICATION_CREDENTIALS` for local GCP auth.

2. **Document status naming is inconsistent.**
   Backend marks successful imports as `imported`, while the dashboard UI still expects `ready` in some places. Standardize on one status string.

3. **Documents page column order is mismatched.**
   The header says `Title | Filename | Status | Created | GCS URI | Actions`, but the row currently renders `Title | Filename | Created | Status | GCS URI | Actions`.

4. **Dashboard overview cards are still static placeholders.**
   The main dashboard page shows hard-coded zeros and “Ready”; it is not reading live backend data yet.

5. **`src/lib/redis.js` looks unused in the current runtime path.**
   The active implementation uses `services/redisService.js` with `ioredis`. This duplicate Redis client can confuse maintenance.

6. **There is no test coverage for the critical upload/delete/RAG flow.**
   The project has Jest listed, but there are no visible tests for the main operational paths.

7. **Admin route auth is good, but role checks are still basic.**
   The backend verifies the Supabase user token, but it does not yet enforce an explicit admin role from your database.

## Recommended next improvements
- Add a `/health` endpoint for backend diagnostics.
- Add real dashboard metrics for total, importing, imported, and failed documents.
- Standardize document status values across backend and frontend.
- Add retry-safe upload/delete handling and clearer operation logs.
- Add tests for `adminDocumentsRouter`, `authMiddleware`, and the Redis-backed session flow.
- Separate environments cleanly for local, shared-dev, and production.

## Scripts

### Hash a student password
```bash
cd backend
node scripts/hashPassword.js yourpassword
```

### Register Telegram commands
```bash
cd backend
node scripts/setCommands.js
```

## License

No license file is included in the repository right now. Add one before distributing the project more widely.
