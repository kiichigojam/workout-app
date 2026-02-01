package com.example.habit_api;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;

@RestController
public class HealthController {
    @GetMapping("/health")
    public String health() {
        return "HEALTH CHECK PASS";
    }
    
}
