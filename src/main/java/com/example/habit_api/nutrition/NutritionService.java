package com.example.habit_api.nutrition;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private static final String SEARCH_CACHE_VERSION = "v2";

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

    public List<FoodSearchResultResponse> searchFoods(String rawQuery, int page, int size) {
        String query = normalizeQuery(rawQuery);
        String cacheKey = searchCacheKey(query, page, size);
        Instant staleBefore = Instant.now().minus(searchCacheMinutes, ChronoUnit.MINUTES);

        var cached = cacheRepository.findByNormalizedQuery(cacheKey);
        if (cached.isPresent() && !cached.get().getFetchedAt().isBefore(staleBefore)) {
            return readResults(cached.get().getResponseJson());
        }

        List<FoodSearchResultResponse> freshResults = usdaFoodClient.searchFoods(query, page, size);
        NutritionSearchCache cacheEntry = cached.orElseGet(NutritionSearchCache::new);
        cacheEntry.setNormalizedQuery(cacheKey);
        cacheEntry.setFetchedAt(Instant.now());
        cacheEntry.setResponseJson(writeResults(freshResults));
        cacheRepository.save(cacheEntry);

        return freshResults;
    }

    public NutritionEntryResponse createEntry(UUID userId, CreateNutritionEntryRequest request) {
        NutritionEntry entry = new NutritionEntry();
        entry.setUserId(userId);
        applyEntryValues(entry, request.foodName(), request.brandName(), request.fdcId(),
            request.consumedOn() != null ? request.consumedOn() : LocalDate.now(),
            request.servings(), request.caloriesPerServing(), request.servingSize(), request.servingSizeUnit());
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

    public List<NutritionDayResponse> listEntriesGrouped(UUID userId, int days) {
        int safeDays = Math.max(1, Math.min(days, 30));
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(safeDays - 1L);

        return entryRepository.findAllByUserIdAndConsumedOnBetweenOrderByConsumedOnDescCreatedAtDesc(userId, start, end)
            .stream()
            .map(NutritionEntryResponse::from)
            .collect(Collectors.groupingBy(
                NutritionEntryResponse::consumedOn,
                LinkedHashMap::new,
                Collectors.toList()
            ))
            .entrySet()
            .stream()
            .map(entry -> new NutritionDayResponse(
                entry.getKey(),
                entry.getValue().stream()
                    .map(NutritionEntryResponse::calories)
                    .reduce(BigDecimal.ZERO, BigDecimal::add),
                entry.getValue()
            ))
            .toList();
    }

    public void deleteEntry(UUID userId, UUID entryId) {
        NutritionEntry entry = entryRepository.findByIdAndUserId(entryId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        entryRepository.delete(entry);
    }

    public NutritionEntryResponse updateEntry(UUID userId, UUID entryId, UpdateNutritionEntryRequest request) {
        NutritionEntry entry = entryRepository.findByIdAndUserId(entryId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        applyEntryValues(entry, request.foodName(), request.brandName(), request.fdcId(),
            request.consumedOn(), request.servings(), request.caloriesPerServing(),
            request.servingSize(), request.servingSizeUnit());
        entryRepository.save(entry);
        return NutritionEntryResponse.from(entry);
    }

    public void deleteEntriesByDate(UUID userId, LocalDate consumedOn) {
        LocalDate date = consumedOn != null ? consumedOn : LocalDate.now();
        List<NutritionEntry> entries = entryRepository.findAllByUserIdAndConsumedOn(userId, date);
        entryRepository.deleteAll(entries);
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

    private String searchCacheKey(String query, int page, int size) {
        return SEARCH_CACHE_VERSION + "|" + query + "|page=" + page + "|size=" + size;
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

    private void applyEntryValues(NutritionEntry entry,
                                  String foodName,
                                  String brandName,
                                  Long fdcId,
                                  LocalDate consumedOn,
                                  BigDecimal servings,
                                  BigDecimal caloriesPerServing,
                                  BigDecimal servingSize,
                                  String servingSizeUnit) {
        entry.setFoodName(foodName.trim());
        entry.setBrandName(normalizeOptionalText(brandName));
        entry.setFdcId(fdcId);
        entry.setConsumedOn(consumedOn);
        entry.setServings(servings);
        entry.setCalories(caloriesPerServing.multiply(servings).setScale(2, RoundingMode.HALF_UP));
        entry.setServingSize(servingSize);
        entry.setServingSizeUnit(normalizeOptionalText(servingSizeUnit));
    }
}
