# PinkPop Quiz Studio (custom quizzes + score dashboard)

This version lets people create their own multiple-choice quiz, choose correct answers, share a unique link, and view saved results in a creator-only dashboard.

## Features
- Email/password account sign-up and login
- Create quizzes with 2–20 questions and four answer choices per question
- Pick the correct answer for every question
- Unique public link for each quiz
- Visitors can play without creating an account
- Creator dashboard: total plays, average score, perfect scores, correct-answer rate per question, recent attempts
- Responsive pink/blue design
- Delete a quiz and its attempts
- Supabase free tier can support a small starter project

## Important: backend setup is required
This version needs Supabase to store quizzes and scores across devices. The ZIP does not include your private project credentials; you must create your own Supabase project.

### 1. Create a Supabase project
1. Visit https://supabase.com and create a project.
2. In the project dashboard, find the project URL and the publishable/anon public key (Project Settings / API keys; labels may change).
3. Open `config.js` and replace the two `PASTE_YOUR...` values.
4. Never put a `service_role` or secret key in `config.js`.

### 2. Create the database
1. In Supabase, open **SQL Editor → New query**.
2. Copy all of `supabase-schema.sql` into the editor and run it.
3. In Authentication settings, ensure email/password sign-in is enabled. For easier initial testing, you may disable email confirmation while developing; before a public launch, choose email confirmation and appropriate anti-abuse settings.
4. Review the table policies in `supabase-schema.sql`. Public visitors can read quiz questions and submit a score, but only the owner can read the attempt dashboard.

### 3. Run locally
Open `index.html` in a browser after setting up `config.js`. If browser restrictions interfere, use a simple local static server or deploy first. All four files (`index.html`, `style.css`, `config.js`, `app.js`) must remain together.

### 4. Free public hosting with GitHub Pages
1. Create a **public** GitHub repository, e.g. `pinkpop-quiz`.
2. Upload `index.html`, `style.css`, `config.js`, `app.js`, and `supabase-schema.sql` to the repository root. `README.md` is optional.
3. Open **Settings → Pages**.
4. Choose **Deploy from a branch**, branch `main`, folder `/(root)`, and save.
5. Wait for the deployment, then open the URL displayed in the Pages settings.
6. Test account sign-up, create a quiz, open its public link in a private/incognito tab, submit an attempt, and verify the creator dashboard updates.

## Security and limitations to understand
- The Supabase anon/publishable key is intended for browser use; database security comes from Row Level Security policies. Never expose the service-role key.
- Current client-side scoring is a starter implementation, not cheat-proof. A technically savvy visitor could tamper with the score submission because correct answers are included in the public quiz payload. Do not use it for exams, prizes, or anything high-stakes. A production version should score in a trusted server-side Edge Function and avoid exposing answer keys before submission.
- Public quizzes are readable by anyone with the URL (the current database policy also allows quiz reads so the quiz can be played). Don't put private/sensitive content in a quiz.
- Anonymous attempts are not tied to a name/account. The dashboard counts attempts and scores, but does not identify participants.
- Add rate limiting / anti-spam protection before sharing widely. Public anonymous inserts can be abused.
- This is a fun quiz platform, not a psychological assessment.
