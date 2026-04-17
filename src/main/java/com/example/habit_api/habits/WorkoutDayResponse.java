package com.example.habit_api.habits;

import java.time.LocalDate;
import java.util.List;

public record WorkoutDayResponse(
    LocalDate date,
    int totalWorkouts,
    List<WorkoutEntryResponse> workouts
) {}
