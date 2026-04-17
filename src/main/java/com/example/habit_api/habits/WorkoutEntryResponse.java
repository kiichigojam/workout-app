package com.example.habit_api.habits;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record WorkoutEntryResponse(
    UUID id,
    UUID habitId,
    String habitTitle,
    LocalDate checkinDate,
    Instant createdAt
) {}
