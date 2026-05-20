# Setup Steps

## Prerequisites
- Node.js 18+ installed
- Supabase account (free) — project already created
- Vercel account (free) — for deployment

---

## Step 1: Clone / Open Project
```bash
cd "/Users/shouryajain/Documents/Vibe/Claude Code/hostel-erp"
npm install
```

---

## Step 2: Configure Environment Variables

Edit `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://kdxbhueovchwbxbcjhxo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkeGJodWVvdmNod2J4YmNqaHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTkxOTgsImV4cCI6MjA5NDgzNTE5OH0.AGS0fA4qYKcIK_DiShFqD2d64_NqYWC3Yh-GDnK_vrE
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard>
```

### Where to get the Service Role Key
1. Go to https://supabase.com/dashboard
2. Select project **hostel-erp**
3. Left sidebar → **Settings → API**
4. Copy the `service_role` key (keep this secret — server only)

---

## Step 3: Create the Owner Account (One Time Only)

### Option A: Supabase Dashboard UI (Easiest)
1. Go to Supabase Dashboard → **Authentication → Users**
2. Click **Add User → Create new user**
3. Fill in:
   - **Email:** `9999999999@hostel.erp` (replace with owner's phone)
   - **Password:** choose a strong password
   - Toggle **Auto Confirm User**: ON
4. After user is created, click the user → **Edit**
5. Set **User Metadata** (raw JSON):
   ```json
   {
     "name": "Owner Name",
     "phone": "9999999999",
     "role": "owner"
   }
   ```
6. Save. The database trigger will auto-create the `profiles` row.

### Option B: Run Seed Script
```bash
OWNER_NAME="Your Name" \
OWNER_PHONE="9999999999" \
OWNER_PASSWORD="StrongPass@123" \
NEXT_PUBLIC_SUPABASE_URL=https://kdxbhueovchwbxbcjhxo.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
npx ts-node --project tsconfig.json scripts/seed-owner.ts
```

---

## Step 4: Run Development Server
```bash
npm run dev
```
Open http://localhost:3000

Login with:
- Phone: `9999999999` (whatever you set as owner's phone)
- Password: the owner password you set

---

## Step 5: Deploy to Vercel (When Ready)

```bash
npm install -g vercel
vercel login
vercel --prod
```

Set environment variables in Vercel dashboard (same as `.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Your app will be live at `https://your-project.vercel.app`

---

## Common Issues

| Issue | Fix |
|---|---|
| Login fails | Check phone format — must be 10 digits, no spaces |
| Profile not created after signup | Check if the `handle_new_user` trigger is active in Supabase |
| "Forbidden" on approve API | Make sure the logged-in user has `role = 'owner'` in `profiles` |
| Supabase project paused | Free tier pauses after 1 week idle — resume from dashboard |
