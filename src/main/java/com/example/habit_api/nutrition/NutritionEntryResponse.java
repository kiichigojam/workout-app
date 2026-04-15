package com.example.habit_api.nutrition;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record NutritionEntryResponse(
    UUID id,
    String foodName,
    String brandName,
    Long fdcId,
    LocalDate consumedOn,
    BigDecimal servings,
    BigDecimal calories,
    BigDecimal servingSize,
    String servingSizeUnit,
    Instant createdAt
) {
    public static NutritionEntryResponse from(NutritionEntry entry) {
        return new NutritionEntryResponse(
            entry.getId(),
            entry.getFoodName(),
            entry.getBrandName(),
            entry.getFdcId(),
            entry.getConsumedOn(),
            entry.getServings(),
            entry.getCalories(),
            entry.getServingSize(),
            entry.getServingSizeUnit(),
            entry.getCreatedAt()
        );
    }
}
