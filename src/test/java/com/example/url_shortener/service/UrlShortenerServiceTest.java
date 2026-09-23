package com.example.url_shortener.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.url_shortener.exception.ShortCodeGenerationException;
import com.example.url_shortener.model.UrlMapping;
import com.example.url_shortener.repository.UrlMappingRepository;

@ExtendWith(MockitoExtension.class)
class UrlShortenerServiceTest {

    private static final String LONG_URL = "https://spring.io/projects/spring-boot";

    @Mock
    private UrlMappingRepository repository;

    @InjectMocks
    private UrlShortenerService service;

    @Test
    void shortenUrl_returnsSixCharAlphanumericCode_andSavesMapping() {
        when(repository.existsByShortCode(anyString())).thenReturn(false);

        String shortCode = service.shortenUrl(LONG_URL);

        assertThat(shortCode).matches("[A-Za-z0-9]{6}");

        ArgumentCaptor<UrlMapping> saved = ArgumentCaptor.forClass(UrlMapping.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getLongUrl()).isEqualTo(LONG_URL);
        assertThat(saved.getValue().getShortCode()).isEqualTo(shortCode);
    }

    @Test
    void shortenUrl_retriesWhenGeneratedCodeAlreadyExists() {
        // First generated code collides, second one is free
        when(repository.existsByShortCode(anyString())).thenReturn(true, false);

        String shortCode = service.shortenUrl(LONG_URL);

        verify(repository, times(2)).existsByShortCode(anyString());
        verify(repository).existsByShortCode(shortCode);

        ArgumentCaptor<UrlMapping> saved = ArgumentCaptor.forClass(UrlMapping.class);
        verify(repository, times(1)).save(saved.capture());
        assertThat(saved.getValue().getShortCode()).isEqualTo(shortCode);
    }

    @Test
    void shortenUrl_throwsAfterFiveCollisions_andSavesNothing() {
        when(repository.existsByShortCode(anyString())).thenReturn(true);

        assertThatThrownBy(() -> service.shortenUrl(LONG_URL))
                .isInstanceOf(ShortCodeGenerationException.class)
                .hasMessageContaining("5 attempts");

        verify(repository, times(5)).existsByShortCode(anyString());
        verify(repository, never()).save(any());
    }
}
