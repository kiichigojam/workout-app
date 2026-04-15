package com.example.habit_api.nutrition;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NutritionSearchCacheRepository extends JpaRepository<NutritionSearchCache, UUID> {
    Optional<NutritionSearchCache> findByNormalizedQuery(String normalizedQuery);
}
