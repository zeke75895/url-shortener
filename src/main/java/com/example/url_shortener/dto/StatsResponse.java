package com.example.url_shortener.dto;

import java.time.Instant;

import com.example.url_shortener.model.UrlMapping;

public record StatsResponse(String shortCode, String longUrl, long clickCount, Instant createdAt) {

    public static StatsResponse from(UrlMapping mapping) {
        return new StatsResponse(
                mapping.getShortCode(),
                mapping.getLongUrl(),
                mapping.getClickCount(),
                mapping.getCreatedAt());
    }
}
