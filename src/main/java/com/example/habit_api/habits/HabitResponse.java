package com.example.habit_api.habits;

import java.time.Instant;
import java.util.UUID;

public record HabitResponse(
    UUID id,
    String title,
    String notes,
    boolean isActive,
    Instant createdAt
) {
    public static HabitResponse from(Habit habit) {
        return new HabitResponse(
            habit.getId(),
            habit.getTitle(),
            habit.getNotes(),
            habit.isActive(),
            habit.getCreatedAt()
        );
    }
}
