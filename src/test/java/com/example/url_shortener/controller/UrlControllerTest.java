package com.example.url_shortener.controller;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import com.example.url_shortener.exception.UrlNotFoundException;
import com.example.url_shortener.model.UrlMapping;
import com.example.url_shortener.service.UrlShortenerService;

@WebMvcTest(UrlController.class)
class UrlControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UrlShortenerService urlShortenerService;

    @Test
    void shorten_withValidUrl_returns201WithShortCodeAndShortUrl() throws Exception {
        given(urlShortenerService.shortenUrl("https://spring.io")).willReturn("abc123");

        mockMvc.perform(post("/api/shorten")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"longUrl": "https://spring.io"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "http://localhost:8080/abc123"))
                .andExpect(jsonPath("$.shortCode").value("abc123"))
                .andExpect(jsonPath("$.shortUrl").value("http://localhost:8080/abc123"));
    }

    @Test
    void shorten_withInvalidUrl_returns400WithFieldErrors() throws Exception {
        mockMvc.perform(post("/api/shorten")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"longUrl": "ftp://example.com"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.path").value("/api/shorten"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("longUrl"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("longUrl must be a valid http or https URL"));

        verifyNoInteractions(urlShortenerService);
    }

    @Test
    void shorten_withBlankUrl_returns400WithSingleRequiredError() throws Exception {
        mockMvc.perform(post("/api/shorten")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"longUrl": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.length()").value(1))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("longUrl is required"));

        verifyNoInteractions(urlShortenerService);
    }

    @Test
    void shorten_withMalformedJson_returns400() throws Exception {
        mockMvc.perform(post("/api/shorten")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{bad json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Request body is missing or is not valid JSON"));

        verifyNoInteractions(urlShortenerService);
    }

    @Test
    void stats_forKnownCode_returnsMappingDetails() throws Exception {
        UrlMapping mapping = new UrlMapping("https://spring.io", "abc123");
        // createdAt and clickCount are normally set by JPA and the database
        ReflectionTestUtils.setField(mapping, "createdAt", Instant.parse("2026-01-15T10:30:00Z"));
        ReflectionTestUtils.setField(mapping, "clickCount", 42L);
        given(urlShortenerService.getStats("abc123")).willReturn(mapping);

        mockMvc.perform(get("/api/stats/abc123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shortCode").value("abc123"))
                .andExpect(jsonPath("$.longUrl").value("https://spring.io"))
                .andExpect(jsonPath("$.clickCount").value(42))
                .andExpect(jsonPath("$.createdAt").value("2026-01-15T10:30:00Z"));
    }

    @Test
    void stats_forUnknownCode_returns404() throws Exception {
        given(urlShortenerService.getStats("zzz999")).willThrow(new UrlNotFoundException("zzz999"));

        mockMvc.perform(get("/api/stats/zzz999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("No URL found for short code: zzz999"))
                .andExpect(jsonPath("$.path").value("/api/stats/zzz999"));
    }
}
