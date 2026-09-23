package com.example.url_shortener.service;

import java.security.SecureRandom;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.url_shortener.exception.ShortCodeGenerationException;
import com.example.url_shortener.exception.UrlNotFoundException;
import com.example.url_shortener.model.UrlMapping;
import com.example.url_shortener.repository.UrlMappingRepository;

@Service
public class UrlShortenerService {

    private static final String ALPHABET =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final int CODE_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 5;

    private final UrlMappingRepository repository;
    private final SecureRandom random = new SecureRandom();

    public UrlShortenerService(UrlMappingRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public String shortenUrl(String longUrl) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            String shortCode = generateShortCode();
            if (!repository.existsByShortCode(shortCode)) {
                repository.save(new UrlMapping(longUrl, shortCode));
                return shortCode;
            }
        }
        throw new ShortCodeGenerationException(MAX_ATTEMPTS);
    }

    // Resolves a short code for a redirect and records the click
    @Transactional
    public String getOriginalUrl(String shortCode) {
        String longUrl = repository.findByShortCode(shortCode)
                .map(UrlMapping::getLongUrl)
                .orElseThrow(() -> new UrlNotFoundException(shortCode));
        repository.incrementClickCount(shortCode);
        return longUrl;
    }

    @Transactional(readOnly = true)
    public UrlMapping getStats(String shortCode) {
        return repository.findByShortCode(shortCode)
                .orElseThrow(() -> new UrlNotFoundException(shortCode));
    }

    private String generateShortCode() {
        StringBuilder code = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            code.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }
}
