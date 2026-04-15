create table nutrition_search_cache (
    id uuid primary key,
    normalized_query text not null unique,
    response_json text not null,
    fetched_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_nutrition_search_cache_fetched_at
    on nutrition_search_cache(fetched_at);
