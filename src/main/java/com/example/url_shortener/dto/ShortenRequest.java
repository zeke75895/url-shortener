package com.example.url_shortener.dto;

import org.hibernate.validator.constraints.URL;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ShortenRequest(
        @NotBlank(message = "longUrl is required")
        @Size(max = 2048, message = "longUrl must be at most 2048 characters")
        // Empty values are allowed through here so only @NotBlank reports them
        @URL(regexp = "^$|^(http|https)://.*", message = "longUrl must be a valid http or https URL")
        String longUrl
) {
}
