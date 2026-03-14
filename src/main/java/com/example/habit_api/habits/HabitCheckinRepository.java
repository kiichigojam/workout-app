package com.example.habit_api.habits;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitCheckinRepository extends JpaRepository<HabitCheckin, UUID> {
    List<HabitCheckin> findAllByHabitIdAndUserIdOrderByCheckinDateDesc(UUID habitId, UUID userId);
    boolean existsByHabitIdAndUserIdAndCheckinDate(UUID habitId, UUID userId, LocalDate checkinDate);
    Optional<HabitCheckin> findByHabitIdAndUserIdAndCheckinDate(UUID habitId, UUID userId, LocalDate checkinDate);
}
