package com.example.habit_api.habits;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitRepository extends JpaRepository<Habit, UUID> {
    List<Habit> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<Habit> findByIdAndUserId(UUID id, UUID userId);
}
