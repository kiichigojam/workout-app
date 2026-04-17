package com.example.habit_api.nutrition;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record NutritionDayResponse(
    LocalDate consumedOn,
    BigDecimal totalCalories,
    List<NutritionEntryResponse> entries
) {}
