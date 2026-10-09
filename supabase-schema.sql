-- PinkPop Quiz Studio schema for Supabase
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 220),
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and score <= total),
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quizzes_owner_created_idx on public.quizzes(owner_id, created_at desc);
create index if not exists quiz_attempts_quiz_created_idx on public.quiz_attempts(quiz_id, created_at desc);

alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;

drop policy if exists "Anyone can read quizzes to play them" on public.quizzes;
create policy "Anyone can read quizzes to play them"
on public.quizzes for select using (true);

drop policy if exists "Signed-in users create their own quizzes" on public.quizzes;
create policy "Signed-in users create their own quizzes"
on public.quizzes for insert to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Owners update their quizzes" on public.quizzes;
create policy "Owners update their quizzes"
on public.quizzes for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Owners delete their quizzes" on public.quizzes;
create policy "Owners delete their quizzes"
on public.quizzes for delete to authenticated
using (auth.uid() = owner_id);

-- A visitor can submit a result for a public quiz. Visitors cannot read attempts.
drop policy if exists "Anyone can submit quiz attempts" on public.quiz_attempts;
create policy "Anyone can submit quiz attempts"
on public.quiz_attempts for insert to anon, authenticated
with check (
  score >= 0 and total > 0 and score <= total
  and exists (select 1 from public.quizzes q where q.id = quiz_id)
);

-- Only the quiz owner can see attempts for that quiz.
drop policy if exists "Quiz owners can view their attempts" on public.quiz_attempts;
create policy "Quiz owners can view their attempts"
on public.quiz_attempts for select to authenticated
using (
  exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = auth.uid())
);

-- No update/delete policy for attempts: public visitors cannot modify saved results.
grant select, insert, update, delete on public.quizzes to authenticated;
grant select on public.quizzes to anon;
grant insert on public.quiz_attempts to anon, authenticated;
grant select on public.quiz_attempts to authenticated;
