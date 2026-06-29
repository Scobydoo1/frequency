-- FREQUENCY — initial Postgres schema (Neon)
-- Replaces the Vercel Blob model: signals/<prompt>.json + users/<callsign>.json +
-- freqreq/<to>/<from>.json + friendsof/<a>/<b>.json described in ARCHITECTURE.md.

create table if not exists users (
  callsign      text primary key,
  password_salt text,
  password_hash text,
  -- Google is an *alternate* sign-in / recovery path, never a public identity:
  -- google_email is stored for account recovery only and is never returned by
  -- any API response. A callsign-only account has both google_* columns null.
  google_sub    text unique,
  google_email  text,
  created_at    timestamptz not null default now(),
  last_signal_text   text,
  last_signal_prompt text,
  last_signal_at     bigint,
  last_tuned_day     integer
);

create table if not exists signals (
  id        text primary key,
  prompt_id text not null,
  text      text not null,
  name      text references users(callsign) on delete set null,
  ts        bigint not null
);
create index if not exists signals_prompt_ts_idx on signals (prompt_id, ts desc);

create table if not exists prompt_counters (
  prompt_id   text primary key,
  submissions integer not null default 0
);

create table if not exists friend_requests (
  to_callsign   text not null references users(callsign) on delete cascade,
  from_callsign text not null references users(callsign) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (to_callsign, from_callsign)
);

-- mirrored rows (a→b and b→a), matching the old friendsof/<a>/<b> + friendsof/<b>/<a>
-- blob pair — keeps store.js logic close to the original and each row owner-writable.
create table if not exists friendships (
  owner_callsign  text not null references users(callsign) on delete cascade,
  friend_callsign text not null references users(callsign) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (owner_callsign, friend_callsign)
);
