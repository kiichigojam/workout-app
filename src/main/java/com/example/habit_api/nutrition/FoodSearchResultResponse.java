package com.example.habit_api.nutrition;

import java.math.BigDecimal;

public record FoodSearchResultResponse(
    Long fdcId,
    String description,
    String brandName,
    String dataType,
    BigDecimal calories,
    BigDecimal servingSize,
    String servingSizeUnit,
    String caloriesBasis
) {}
