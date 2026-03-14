package com.example.habit_api.habits;

import jakarta.validation.constraints.Size;

public record UpdateHabitRequest(
    @Size(max = 255) String title,
    @Size(max = 2000) String notes,
    Boolean isActive
) {}
