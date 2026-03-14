package com.example.habit_api.habits;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record HabitCheckinResponse(
    UUID id,
    UUID habitId,
    LocalDate checkinDate,
    Instant createdAt
) {
    public static HabitCheckinResponse from(HabitCheckin checkin) {
        return new HabitCheckinResponse(
            checkin.getId(),
            checkin.getHabitId(),
            checkin.getCheckinDate(),
            checkin.getCreatedAt()
        );
    }
}
