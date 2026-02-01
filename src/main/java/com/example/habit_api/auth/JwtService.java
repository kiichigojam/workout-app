package com.example.habit_api.auth;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {
    private final byte[] keyBytes;
    private final long expirationMinutes;

    public JwtService (
        @Value("${app.jwt.secret}") String secret,
        @Value("${app.jwt.expirationMinutes}") long expirationMinutes
    ) {
        this.keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        this.expirationMinutes = expirationMinutes;
    }

    public String createToken(UUID userId) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(expirationMinutes * 60);
        return Jwts.builder()
            .subject(userId.toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(exp))
            .signWith(Keys.hmacShaKeyFor(keyBytes), Jwts.SIG.HS256)
            .compact();
    }

    public UUID parseUserId(String token) {
        String sub = Jwts.parser()
            .verifyWith(Keys.hmacShaKeyFor(keyBytes))
            .build()
            .parseSignedClaims(token)
            .getPayload()
            .getSubject();
        return UUID.fromString(sub);
    }
}
