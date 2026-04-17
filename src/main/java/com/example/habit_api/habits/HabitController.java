package com.example.habit_api.habits;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
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

@RestController
@RequestMapping("/habits")
public class HabitController {
    private final HabitRepository habits;
    private final HabitCheckinRepository checkins;

    public HabitController(HabitRepository habits, HabitCheckinRepository checkins) {
        this.habits = habits;
        this.checkins = checkins;
    }

    @GetMapping
    public List<HabitResponse> listHabits() {
        UUID userId = CurrentUser.id();
        return habits.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
            .map(HabitResponse::from)
            .toList();
    }

    @GetMapping("/{habitId}")
    public ResponseEntity<HabitResponse> getHabit(@PathVariable UUID habitId) {
        UUID userId = CurrentUser.id();
        return habits.findByIdAndUserId(habitId, userId)
            .map(HabitResponse::from)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<HabitResponse> createHabit(@Valid @RequestBody CreateHabitRequest req) {
        Habit habit = new Habit();
        habit.setUserId(CurrentUser.id());
        habit.setTitle(req.title().trim());
        habit.setNotes(normalizeNotes(req.notes()));
        habit.setActive(true);
        habits.save(habit);

        return ResponseEntity.status(201).body(HabitResponse.from(habit));
    }

    @PatchMapping("/{habitId}")
    public ResponseEntity<HabitResponse> updateHabit(@PathVariable UUID habitId,
                                                     @Valid @RequestBody UpdateHabitRequest req) {
        UUID userId = CurrentUser.id();
        var habit = habits.findByIdAndUserId(habitId, userId);
        if (habit.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Habit value = habit.get();
        if (req.title() != null) {
            value.setTitle(req.title().trim());
        }
        if (req.notes() != null) {
            value.setNotes(normalizeNotes(req.notes()));
        }
        if (req.isActive() != null) {
            value.setActive(req.isActive());
        }

        habits.save(value);
        return ResponseEntity.ok(HabitResponse.from(value));
    }

    @DeleteMapping("/{habitId}")
    public ResponseEntity<Void> deleteHabit(@PathVariable UUID habitId) {
        UUID userId = CurrentUser.id();
        var habit = habits.findByIdAndUserId(habitId, userId);
        if (habit.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        habits.delete(habit.get());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{habitId}/checkins")
    public ResponseEntity<List<HabitCheckinResponse>> listCheckins(@PathVariable UUID habitId) {
        UUID userId = CurrentUser.id();
        if (habits.findByIdAndUserId(habitId, userId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        List<HabitCheckinResponse> response = checkins.findAllByHabitIdAndUserIdOrderByCheckinDateDesc(habitId, userId)
            .stream()
            .map(HabitCheckinResponse::from)
            .toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/checkins/grouped")
    public List<WorkoutDayResponse> listCheckinsGrouped(@RequestParam(value = "days", defaultValue = "7") int days) {
        UUID userId = CurrentUser.id();
        int safeDays = Math.max(1, Math.min(days, 30));
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(safeDays - 1L);

        Map<UUID, String> habitTitles = habits.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
            .collect(java.util.stream.Collectors.toMap(Habit::getId, Habit::getTitle));

        return checkins.findAllByUserIdAndCheckinDateBetweenOrderByCheckinDateDescCreatedAtDesc(userId, start, end)
            .stream()
            .map(checkin -> new WorkoutEntryResponse(
                checkin.getId(),
                checkin.getHabitId(),
                habitTitles.getOrDefault(checkin.getHabitId(), "Unknown habit"),
                checkin.getCheckinDate(),
                checkin.getCreatedAt()
            ))
            .collect(java.util.stream.Collectors.groupingBy(
                WorkoutEntryResponse::checkinDate,
                LinkedHashMap::new,
                java.util.stream.Collectors.toList()
            ))
            .entrySet()
            .stream()
            .map(entry -> new WorkoutDayResponse(entry.getKey(), entry.getValue().size(), entry.getValue()))
            .toList();
    }

    @PostMapping("/{habitId}/checkins")
    public ResponseEntity<HabitCheckinResponse> createCheckin(@PathVariable UUID habitId,
                                                              @RequestBody(required = false) CreateHabitCheckinRequest req) {
        UUID userId = CurrentUser.id();
        if (habits.findByIdAndUserId(habitId, userId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        LocalDate checkinDate = req != null && req.checkinDate() != null ? req.checkinDate() : LocalDate.now();
        if (checkins.existsByHabitIdAndUserIdAndCheckinDate(habitId, userId, checkinDate)) {
            return ResponseEntity.status(409).build();
        }

        HabitCheckin checkin = new HabitCheckin();
        checkin.setHabitId(habitId);
        checkin.setUserId(userId);
        checkin.setCheckinDate(checkinDate);
        checkins.save(checkin);

        return ResponseEntity.status(201).body(HabitCheckinResponse.from(checkin));
    }

    @DeleteMapping("/{habitId}/checkins/{checkinDate}")
    public ResponseEntity<Void> deleteCheckin(@PathVariable UUID habitId,
                                              @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkinDate) {
        UUID userId = CurrentUser.id();
        if (habits.findByIdAndUserId(habitId, userId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        var checkin = checkins.findByHabitIdAndUserIdAndCheckinDate(habitId, userId, checkinDate);
        if (checkin.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        checkins.delete(checkin.get());
        return ResponseEntity.noContent().build();
    }

    private String normalizeNotes(String notes) {
        if (notes == null) {
            return null;
        }

        String trimmed = notes.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
