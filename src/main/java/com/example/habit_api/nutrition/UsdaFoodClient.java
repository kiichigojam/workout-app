package com.example.habit_api.nutrition;

import java.math.BigDecimal;
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

    private final RestClient restClient;
    private final String apiKey;

    public UsdaFoodClient(RestClient.Builder restClientBuilder,
                          @Value("${nutrition.usda.baseUrl}") String baseUrl,
                          @Value("${nutrition.usda.apiKey:}") String apiKey) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.apiKey = apiKey;
    }

    public List<FoodSearchResultResponse> searchFoods(String query) {
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
                .body(new UsdaSearchRequest(query, 10, 1, DEFAULT_DATA_TYPES))
                .retrieve()
                .body(UsdaSearchResponse.class);

            if (response == null || response.foods() == null) {
                return List.of();
            }

            return response.foods().stream()
                .map(this::toSearchResult)
                .sorted(Comparator
                    .comparing(UsdaFoodClient::hasServingData).reversed()
                    .thenComparing(UsdaFoodClient::hasBrandData).reversed())
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
        boolean hasServingData = hasServingData(food);
        return new FoodSearchResultResponse(
            food.fdcId(),
            food.description(),
            firstNonBlank(food.brandName(), food.brandOwner()),
            food.dataType(),
            extractCalories(food.foodNutrients()),
            hasServingData ? food.servingSize() : new BigDecimal("100"),
            hasServingData ? food.servingSizeUnit() : "g",
            hasServingData ? "per_serving" : "per_100g"
        );
    }

    private BigDecimal extractCalories(List<UsdaFoodNutrient> nutrients) {
        if (nutrients == null) {
            return null;
        }

        return nutrients.stream()
            .filter(nutrient -> nutrient != null && nutrient.value() != null)
            .filter(nutrient -> "1008".equals(nutrient.nutrientNumber())
                || "Energy".equalsIgnoreCase(nutrient.nutrientName()))
            .map(UsdaFoodNutrient::value)
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

    private static boolean hasBrandData(FoodSearchResultResponse result) {
        return StringUtils.hasText(result.brandName());
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
        BigDecimal value
    ) {}
}
