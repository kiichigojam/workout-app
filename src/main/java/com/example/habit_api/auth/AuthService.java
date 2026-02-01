package com.example.habit_api.auth;

import org.springframework.stereotype.Service;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.habit_api.auth.dto.LoginRequest;
import com.example.habit_api.auth.dto.SignupRequest;
import com.example.habit_api.users.User;
import com.example.habit_api.users.UserRepository;

@Service
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService (UserRepository users, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    public String signup(SignupRequest req) {
        String email = req.email().toLowerCase();
        if(users.existsByEmailAndDeletedAtIsNull(email)) {
            throw new RuntimeException("EMAIL HAS BEEN TAKEN");
        }

        User u = new User();
        u.setEmail(email);
        u.setName(req.name());
        u.setPasswordHash(encoder.encode(req.password()));
        users.save(u);

        return jwt.createToken(u.getId());
    }

    public String login(LoginRequest req) {
        User u = users.findByEmailAndDeletedAtIsNull(req.email().toLowerCase())
            .orElseThrow(() -> new RuntimeException("WRONG USERNAME OR PASSWORD"));
        
        if (!encoder.matches(req.password(), u.getPasswordHash())) {
            throw new RuntimeException("WRONG PASSWORD");
        }

        return jwt.createToken(u.getId());
    }
}
