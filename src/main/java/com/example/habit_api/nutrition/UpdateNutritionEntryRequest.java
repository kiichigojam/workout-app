package com.example.habit_api.nutrition;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateNutritionEntryRequest(
    @NotBlank @Size(max = 255) String foodName,
    @Size(max = 255) String brandName,
    Long fdcId,
    @NotNull LocalDate consumedOn,
    @NotNull @DecimalMin(value = "0.01") @Digits(integer = 8, fraction = 2) BigDecimal servings,
    @NotNull @DecimalMin(value = "0.01") @Digits(integer = 8, fraction = 2) BigDecimal caloriesPerServing,
    @Digits(integer = 8, fraction = 2) BigDecimal servingSize,
    @Size(max = 50) String servingSizeUnit
) {}
