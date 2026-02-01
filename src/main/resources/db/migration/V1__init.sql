create table users (
    id uuid primary key,
    email text not null unique,
    password_hash text not null,
    name text not null,
    created_at timestamptz not null default now()
);

create table habits (
    id uuid primary key,
    user_id uuid not null references users(id) on delete cascade,
    title text not null, 
    notes text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table habit_checkins (
    id uuid primary key,
    habit_id uuid not null references habits(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    checkin_date date not null,
    created_at timestamptz not null default now(),
    constraint uq_habit_date unique (habit_id, checkin_date)
);

create index idx_habits_user on habits(user_id);
create index idx_checkin_user_date on habit_checkins(user_id, checkin_date);
create index idx_checkin_habit_date on habit_checkins(habit_id, checkin_date);
