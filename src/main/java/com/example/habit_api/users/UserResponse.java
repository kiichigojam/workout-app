package com.example.habit_api.users;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(UUID id, String email, String name, Instant createdAt) {}
