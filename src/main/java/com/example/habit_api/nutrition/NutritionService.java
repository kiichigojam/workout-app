package com.example.habit_api.nutrition;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class NutritionService {
    private static final TypeReference<List<FoodSearchResultResponse>> SEARCH_RESULTS_TYPE =
        new TypeReference<>() {};

    private final NutritionSearchCacheRepository cacheRepository;
    private final NutritionEntryRepository entryRepository;
    private final UsdaFoodClient usdaFoodClient;
    private final ObjectMapper objectMapper;
    private final long searchCacheMinutes;

    public NutritionService(NutritionSearchCacheRepository cacheRepository,
                            NutritionEntryRepository entryRepository,
                            UsdaFoodClient usdaFoodClient,
                            ObjectMapper objectMapper,
                            @Value("${nutrition.usda.searchCacheMinutes:720}") long searchCacheMinutes) {
        this.cacheRepository = cacheRepository;
        this.entryRepository = entryRepository;
        this.usdaFoodClient = usdaFoodClient;
        this.objectMapper = objectMapper;
        this.searchCacheMinutes = searchCacheMinutes;
    }

    public List<FoodSearchResultResponse> searchFoods(String rawQuery) {
        String query = normalizeQuery(rawQuery);
        Instant staleBefore = Instant.now().minus(searchCacheMinutes, ChronoUnit.MINUTES);

        var cached = cacheRepository.findByNormalizedQuery(query);
        if (cached.isPresent() && !cached.get().getFetchedAt().isBefore(staleBefore)) {
            return readResults(cached.get().getResponseJson());
        }

        List<FoodSearchResultResponse> freshResults = usdaFoodClient.searchFoods(query);
        NutritionSearchCache cacheEntry = cached.orElseGet(NutritionSearchCache::new);
        cacheEntry.setNormalizedQuery(query);
        cacheEntry.setFetchedAt(Instant.now());
        cacheEntry.setResponseJson(writeResults(freshResults));
        cacheRepository.save(cacheEntry);

        return freshResults;
    }

    public NutritionEntryResponse createEntry(UUID userId, CreateNutritionEntryRequest request) {
        NutritionEntry entry = new NutritionEntry();
        entry.setUserId(userId);
        entry.setFoodName(request.foodName().trim());
        entry.setBrandName(normalizeOptionalText(request.brandName()));
        entry.setFdcId(request.fdcId());
        entry.setConsumedOn(request.consumedOn() != null ? request.consumedOn() : LocalDate.now());
        entry.setServings(request.servings());
        entry.setCalories(request.caloriesPerServing().multiply(request.servings()).setScale(2, RoundingMode.HALF_UP));
        entry.setServingSize(request.servingSize());
        entry.setServingSizeUnit(normalizeOptionalText(request.servingSizeUnit()));
        entryRepository.save(entry);
        return NutritionEntryResponse.from(entry);
    }

    public NutritionEntriesResponse listEntries(UUID userId, LocalDate consumedOn) {
        LocalDate date = consumedOn != null ? consumedOn : LocalDate.now();
        List<NutritionEntryResponse> entries = entryRepository.findAllByUserIdAndConsumedOnOrderByCreatedAtDesc(userId, date)
            .stream()
            .map(NutritionEntryResponse::from)
            .toList();

        BigDecimal totalCalories = entries.stream()
            .map(NutritionEntryResponse::calories)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new NutritionEntriesResponse(date, totalCalories, entries);
    }

    public void deleteEntry(UUID userId, UUID entryId) {
        NutritionEntry entry = entryRepository.findByIdAndUserId(entryId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        entryRepository.delete(entry);
    }

    private String normalizeQuery(String rawQuery) {
        if (rawQuery == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Query is required");
        }

        String normalized = rawQuery.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        if (normalized.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Query must be at least 2 characters");
        }

        return normalized;
    }

    private String writeResults(List<FoodSearchResultResponse> results) {
        try {
            return objectMapper.writeValueAsString(results);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to serialize nutrition search cache", ex);
        }
    }

    private List<FoodSearchResultResponse> readResults(String responseJson) {
        try {
            return objectMapper.readValue(responseJson, SEARCH_RESULTS_TYPE);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to deserialize nutrition search cache", ex);
        }
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
