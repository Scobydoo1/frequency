-- Echoes: every time a signal is revealed to another player it counts as a
-- "find". found_seen is how many finds the author has already acknowledged in
-- the "your echoes" panel — the difference is their unread notifications.
alter table signals add column if not exists found_count integer not null default 0;
alter table signals add column if not exists found_seen  integer not null default 0;
