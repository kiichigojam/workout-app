package com.example.habit_api.nutrition;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@Component
public class UsdaFoodClient {
    private static final List<String> DEFAULT_DATA_TYPES = List.of("Foundation", "SR Legacy", "Branded");
    private static final BigDecimal KJ_PER_KCAL = new BigDecimal("4.184");

    private final RestClient restClient;
    private final String apiKey;

    public UsdaFoodClient(RestClient.Builder restClientBuilder,
                          @Value("${nutrition.usda.baseUrl}") String baseUrl,
                          @Value("${nutrition.usda.apiKey:}") String apiKey) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.apiKey = apiKey;
    }

    public List<FoodSearchResultResponse> searchFoods(String query, int page, int size) {
        if (!StringUtils.hasText(apiKey)) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "USDA_API_KEY is not configured"
            );
        }

        try {
            UsdaSearchResponse response = restClient.post()
                .uri(uriBuilder -> uriBuilder
                    .path("/foods/search")
                    .queryParam("api_key", apiKey)
                    .build())
                .body(new UsdaSearchRequest(query, size, page, DEFAULT_DATA_TYPES))
                .retrieve()
                .body(UsdaSearchResponse.class);

            if (response == null || response.foods() == null) {
                return List.of();
            }

            return response.foods().stream()
                .map(this::toSearchResult)
                .sorted(Comparator
                    .comparing((FoodSearchResultResponse result) -> hasServingData(result)).reversed()
                    .thenComparing(result -> hasBrandData(result), Comparator.reverseOrder()))
                .toList();
        } catch (RestClientResponseException ex) {
            throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "USDA request failed with status " + ex.getStatusCode().value(),
                ex
            );
        } catch (RestClientException ex) {
            throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "USDA request failed",
                ex
            );
        }
    }

    private FoodSearchResultResponse toSearchResult(UsdaFood food) {
        boolean usePer100gFallback = isSrLegacyWithoutServingData(food);
        return new FoodSearchResultResponse(
            food.fdcId(),
            food.description(),
            firstNonBlank(food.brandName(), food.brandOwner()),
            food.dataType(),
            extractCalories(food.foodNutrients()),
            usePer100gFallback ? new BigDecimal("100") : food.servingSize(),
            usePer100gFallback ? "g" : food.servingSizeUnit(),
            usePer100gFallback ? "per_100g" : "per_serving"
        );
    }

    private BigDecimal extractCalories(List<UsdaFoodNutrient> nutrients) {
        if (nutrients == null) {
            return null;
        }

        return nutrients.stream()
            .filter(nutrient -> nutrient != null && nutrient.value() != null)
            .filter(this::isEnergyNutrient)
            .sorted(Comparator.comparing((UsdaFoodNutrient nutrient) -> isKcalNutrient(nutrient)).reversed())
            .map(this::toKcal)
            .findFirst()
            .orElse(null);
    }

    private String firstNonBlank(String first, String second) {
        if (StringUtils.hasText(first)) {
            return first;
        }
        return StringUtils.hasText(second) ? second : null;
    }

    private static boolean hasServingData(FoodSearchResultResponse result) {
        return result.servingSize() != null && StringUtils.hasText(result.servingSizeUnit());
    }

    private static boolean hasServingData(UsdaFood food) {
        return food.servingSize() != null && StringUtils.hasText(food.servingSizeUnit());
    }

    private boolean isSrLegacyWithoutServingData(UsdaFood food) {
        return "SR Legacy".equalsIgnoreCase(food.dataType()) && !hasServingData(food);
    }

    private static boolean hasBrandData(FoodSearchResultResponse result) {
        return StringUtils.hasText(result.brandName());
    }

    private boolean isEnergyNutrient(UsdaFoodNutrient nutrient) {
        return "1008".equals(nutrient.nutrientNumber())
            || "1062".equals(nutrient.nutrientNumber())
            || "Energy".equalsIgnoreCase(nutrient.nutrientName());
    }

    private boolean isKcalNutrient(UsdaFoodNutrient nutrient) {
        return "1008".equals(nutrient.nutrientNumber())
            || "kcal".equalsIgnoreCase(nutrient.unitName());
    }

    private BigDecimal toKcal(UsdaFoodNutrient nutrient) {
        if ("kJ".equalsIgnoreCase(nutrient.unitName())) {
            return nutrient.value().divide(KJ_PER_KCAL, 2, RoundingMode.HALF_UP);
        }
        return nutrient.value();
    }

    private record UsdaSearchRequest(
        String query,
        int pageSize,
        int pageNumber,
        List<String> dataType
    ) {}

    private record UsdaSearchResponse(List<UsdaFood> foods) {}

    private record UsdaFood(
        Long fdcId,
        String description,
        String brandName,
        String brandOwner,
        String dataType,
        BigDecimal servingSize,
        String servingSizeUnit,
        List<UsdaFoodNutrient> foodNutrients
    ) {}

    private record UsdaFoodNutrient(
        String nutrientName,
        String nutrientNumber,
        String unitName,
        BigDecimal value
    ) {}
}
