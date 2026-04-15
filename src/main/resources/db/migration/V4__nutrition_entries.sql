create table nutrition_entries (
    id uuid primary key,
    user_id uuid not null references users(id) on delete cascade,
    food_name text not null,
    brand_name text,
    fdc_id bigint,
    consumed_on date not null,
    servings numeric(10,2) not null,
    calories numeric(10,2) not null,
    serving_size numeric(10,2),
    serving_size_unit text,
    created_at timestamptz not null default now()
);

create index idx_nutrition_entries_user_consumed_on
    on nutrition_entries(user_id, consumed_on desc);
