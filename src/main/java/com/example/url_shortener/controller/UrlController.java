package com.example.url_shortener.controller;

import java.net.URI;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.url_shortener.dto.ShortenRequest;
import com.example.url_shortener.dto.ShortenResponse;
import com.example.url_shortener.dto.StatsResponse;
import com.example.url_shortener.service.UrlShortenerService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class UrlController {

    private final UrlShortenerService urlShortenerService;
    private final String baseUrl;

    public UrlController(UrlShortenerService urlShortenerService,
                         @Value("${app.base-url}") String baseUrl) {
        this.urlShortenerService = urlShortenerService;
        this.baseUrl = baseUrl;
    }

    @PostMapping("/shorten")
    public ResponseEntity<ShortenResponse> shorten(@Valid @RequestBody ShortenRequest request) {
        String shortCode = urlShortenerService.shortenUrl(request.longUrl());
        String shortUrl = baseUrl + "/" + shortCode;
        return ResponseEntity.created(URI.create(shortUrl))
                .body(new ShortenResponse(shortCode, shortUrl));
    }

    @GetMapping("/stats/{shortCode}")
    public StatsResponse stats(@PathVariable String shortCode) {
        return StatsResponse.from(urlShortenerService.getStats(shortCode));
    }
}
