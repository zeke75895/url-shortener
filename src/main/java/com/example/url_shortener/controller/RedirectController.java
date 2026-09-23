package com.example.url_shortener.controller;

import java.net.URI;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.example.url_shortener.service.UrlShortenerService;

@RestController
public class RedirectController {

    private final UrlShortenerService urlShortenerService;

    public RedirectController(UrlShortenerService urlShortenerService) {
        this.urlShortenerService = urlShortenerService;
    }

    // Only match 6-character alphanumeric codes so paths like /favicon.ico or /h2-console are not captured
    @GetMapping("/{shortCode:[A-Za-z0-9]{6}}")
    public ResponseEntity<Void> redirect(@PathVariable String shortCode) {
        String longUrl = urlShortenerService.getOriginalUrl(shortCode);
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(longUrl))
                .build();
    }
}
