alter table users add column if not exists deleted_at timestamptz;

alter table users drop constraint if exists users_email_key;
create unique index if not exists users_email_uq_active on users (email) where deleted_at is null;
