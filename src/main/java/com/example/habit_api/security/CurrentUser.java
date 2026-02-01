package com.example.habit_api.security;

import java.util.UUID;

import org.springframework.security.core.context.SecurityContextHolder;

public class CurrentUser {
    public static UUID id() {
        Object p = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return (UUID) p;
    }
}
