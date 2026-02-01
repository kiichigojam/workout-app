package com.example.habit_api.users;

import java.time.Instant;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.habit_api.security.CurrentUser;

@RestController
@RequestMapping("/users")
public class UserController {
    private final UserRepository users;

    public UserController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser() {
        UUID userId = CurrentUser.id();
        return users.findByIdAndDeletedAtIsNull(userId)
            .map(u -> ResponseEntity.ok(new UserResponse(u.getId(), u.getEmail(), u.getName(), u.getCreatedAt())))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteCurrentUser() {
        UUID userId = CurrentUser.id();
        var user = users.findByIdAndDeletedAtIsNull(userId);
        if (user.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        var u = user.get();
        u.setDeletedAt(Instant.now());
        users.save(u);
        return ResponseEntity.noContent().build();
    }
}
