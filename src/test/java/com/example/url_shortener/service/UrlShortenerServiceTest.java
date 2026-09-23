package com.example.url_shortener.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.url_shortener.exception.ShortCodeGenerationException;
import com.example.url_shortener.exception.UrlNotFoundException;
import com.example.url_shortener.model.UrlMapping;
import com.example.url_shortener.repository.UrlMappingRepository;

@ExtendWith(MockitoExtension.class)
class UrlShortenerServiceTest {

    private static final String LONG_URL = "https://spring.io/projects/spring-boot";
    private static final String SHORT_CODE = "abc123";

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

    @Test
    void getOriginalUrl_returnsLongUrl_andIncrementsClickCount() {
        when(repository.findByShortCode(SHORT_CODE))
                .thenReturn(Optional.of(new UrlMapping(LONG_URL, SHORT_CODE)));

        String longUrl = service.getOriginalUrl(SHORT_CODE);

        assertThat(longUrl).isEqualTo(LONG_URL);
        InOrder order = inOrder(repository);
        order.verify(repository).findByShortCode(SHORT_CODE);
        order.verify(repository).incrementClickCount(SHORT_CODE);
    }

    @Test
    void getOriginalUrl_throwsUrlNotFound_forUnknownCode_andDoesNotCountClick() {
        when(repository.findByShortCode(SHORT_CODE)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getOriginalUrl(SHORT_CODE))
                .isInstanceOf(UrlNotFoundException.class)
                .hasMessageContaining(SHORT_CODE);

        verify(repository, never()).incrementClickCount(anyString());
    }

    @Test
    void getStats_returnsMapping_withoutIncrementingClickCount() {
        UrlMapping mapping = new UrlMapping(LONG_URL, SHORT_CODE);
        when(repository.findByShortCode(SHORT_CODE)).thenReturn(Optional.of(mapping));

        assertThat(service.getStats(SHORT_CODE)).isSameAs(mapping);
        verify(repository, never()).incrementClickCount(anyString());
    }

    @Test
    void getStats_throwsUrlNotFound_forUnknownCode() {
        when(repository.findByShortCode(SHORT_CODE)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getStats(SHORT_CODE))
                .isInstanceOf(UrlNotFoundException.class);
    }
}
