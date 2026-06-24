# 🎓 Technical Quiz Competition Platform

A production-ready full-stack quiz competition platform supporting 300 concurrent participants with real-time leaderboards, anti-cheat enforcement, and a comprehensive admin dashboard.

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| **UI Components** | ShadCN UI, Framer Motion |
| **Backend** | Next.js API Routes, Supabase |
| **Database** | PostgreSQL (via Supabase) |
| **Auth** | Supabase Authentication |
| **Realtime** | Supabase Realtime |
| **Charts** | Recharts |
| **Exports** | SheetJS (Excel), jsPDF + html2canvas (PDF) |
| **QR Code** | qrcode.react |
| **Deployment** | Vercel |

---

## 📦 Setup Instructions

### 1. Prerequisites
- Node.js 18+
- npm
- A [Supabase](https://supabase.com) account

### 2. Clone & Install

```bash
cd quiz
npm install
```

### 3. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com/dashboard)
2. Go to **SQL Editor** and run the following files in order:
   - `supabase/schema.sql` — Creates all tables
   - `supabase/rls-policies.sql` — Sets up Row Level Security
   - `supabase/functions.sql` — Creates PostgreSQL functions
   - `supabase/seed.sql` — Inserts 20 quiz questions

### 4. Create Admin User

1. In Supabase Dashboard → **Authentication** → **Users** → **Add User**
2. Create a user with email & password (e.g., `admin@quiz.com`)
3. Copy the user's UUID from the Users table
4. Run this SQL in the SQL Editor:

```sql
INSERT INTO public.admins (auth_user_id, email, name) 
VALUES ('YOUR-USER-UUID-HERE', 'admin@quiz.com', 'Quiz Admin');
```

### 5. Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials from **Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🎮 How It Works

### Student Flow
1. **Login** → Enter register number, name, department, section, and room code
2. **Waiting Room** → Real-time participant count, wait for admin to start
3. **Quiz** → 20 MCQ questions, one at a time, 20-minute timer
4. **Results** → Score, rank, percentage, certificate download
5. **Leaderboard** → Real-time rankings with 🥇🥈🥉

### Admin Flow
1. **Login** → Email/password authentication
2. **Dashboard** → Overview stats (rooms, students, submissions)
3. **Create Room** → Generate room code + QR code
4. **Start Quiz** → Locks room, starts timer, enables anti-cheat
5. **Monitor** → Live participant statuses, violations, scores
6. **End Quiz** → Auto-submits remaining, calculates final ranks
7. **Export** → Download CSV, Excel, or PDF report
8. **Analytics** → Department-wise scores, question accuracy, timeline

---

## 🛡️ Anti-Cheat Features

| Feature | Implementation |
|---------|---------------|
| **Copy Protection** | Blocks Ctrl+C, Ctrl+V, Ctrl+X |
| **Right Click** | Disabled during quiz |
| **DevTools** | Blocks F12, Ctrl+Shift+I/J, Ctrl+U |
| **Tab Switching** | 3 switches → auto-submit |
| **Fullscreen** | Enforced; 3 exits → auto-submit |
| **Text Selection** | Disabled via CSS |
| **Activity Logging** | All violations tracked in database |

---

## 📊 Database Schema

| Table | Purpose |
|-------|---------|
| `admins` | Admin user records |
| `rooms` | Quiz rooms with status & config |
| `participants` | Student registrations & scores |
| `questions` | 20 MCQ questions |
| `room_questions` | Per-room question randomization |
| `answers` | Individual answer records |
| `violations` | Anti-cheat violation logs |
| `activity_logs` | Full activity tracking |

---

## 🚀 Deployment (Vercel)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy
5. Update `NEXT_PUBLIC_APP_URL` to your production URL

---

## 📁 Project Structure

```
src/
├── app/
│   ├── (student)/          # Student pages
│   │   ├── login/          # Registration
│   │   ├── waiting/[roomId]/ # Waiting room
│   │   ├── quiz/[roomId]/  # Quiz page
│   │   ├── result/[roomId]/ # Results
│   │   └── leaderboard/[roomId]/
│   ├── admin/              # Admin pages
│   │   ├── login/
│   │   ├── dashboard/
│   │   └── rooms/
│   └── api/                # API routes
├── components/
│   ├── ui/                 # ShadCN components
│   ├── providers/          # Context providers
│   └── shared/             # Shared components
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities & config
│   └── supabase/           # Supabase clients
└── middleware.ts            # Auth middleware
```

---

## 📝 License

MIT
