package com.example.habit_api.nutrition;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.habit_api.security.CurrentUser;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

@Validated
@RestController
@RequestMapping("/nutrition")
public class NutritionController {
    private final NutritionService nutritionService;

    public NutritionController(NutritionService nutritionService) {
        this.nutritionService = nutritionService;
    }

    @GetMapping("/search")
    public List<FoodSearchResultResponse> searchFoods(
        @RequestParam("q") @Size(min = 2, max = 100) String query,
        @RequestParam(value = "page", defaultValue = "1") @Min(1) int page,
        @RequestParam(value = "size", defaultValue = "10") @Min(1) @Max(50) int size
    ) {
        return nutritionService.searchFoods(query, page, size);
    }

    @PostMapping("/entries")
    public ResponseEntity<NutritionEntryResponse> createEntry(@Valid @RequestBody CreateNutritionEntryRequest request) {
        return ResponseEntity.status(201).body(nutritionService.createEntry(CurrentUser.id(), request));
    }

    @GetMapping("/entries")
    public NutritionEntriesResponse listEntries(
        @RequestParam(value = "date", required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return nutritionService.listEntries(CurrentUser.id(), date);
    }

    @GetMapping("/entries/grouped")
    public List<NutritionDayResponse> listEntriesGrouped(@RequestParam(value = "days", defaultValue = "7") int days) {
        return nutritionService.listEntriesGrouped(CurrentUser.id(), days);
    }

    @DeleteMapping("/entries/{entryId}")
    public ResponseEntity<Void> deleteEntry(@PathVariable UUID entryId) {
        nutritionService.deleteEntry(CurrentUser.id(), entryId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/entries/{entryId}")
    public NutritionEntryResponse updateEntry(@PathVariable UUID entryId, @Valid @RequestBody UpdateNutritionEntryRequest request) {
        return nutritionService.updateEntry(CurrentUser.id(), entryId, request);
    }

    @DeleteMapping("/entries")
    public ResponseEntity<Void> deleteEntriesByDate(
        @RequestParam(value = "date", required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        nutritionService.deleteEntriesByDate(CurrentUser.id(), date);
        return ResponseEntity.noContent().build();
    }
}
