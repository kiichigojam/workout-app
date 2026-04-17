package com.example.habit_api.nutrition;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NutritionEntryRepository extends JpaRepository<NutritionEntry, UUID> {
    List<NutritionEntry> findAllByUserIdAndConsumedOnOrderByCreatedAtDesc(UUID userId, LocalDate consumedOn);
    List<NutritionEntry> findAllByUserIdAndConsumedOnBetweenOrderByConsumedOnDescCreatedAtDesc(UUID userId, LocalDate start, LocalDate end);
    List<NutritionEntry> findAllByUserIdAndConsumedOn(UUID userId, LocalDate consumedOn);
    Optional<NutritionEntry> findByIdAndUserId(UUID id, UUID userId);
}
