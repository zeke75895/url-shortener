package com.example.url_shortener.controller;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.example.url_shortener.exception.UrlNotFoundException;
import com.example.url_shortener.service.UrlShortenerService;

@WebMvcTest(RedirectController.class)
class RedirectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UrlShortenerService urlShortenerService;

    @Test
    void redirect_forKnownCode_returns302WithLocation() throws Exception {
        given(urlShortenerService.getOriginalUrl("abc123")).willReturn("https://spring.io");

        mockMvc.perform(get("/abc123"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://spring.io"));
    }

    @Test
    void redirect_forUnknownCode_returns404() throws Exception {
        given(urlShortenerService.getOriginalUrl("zzz999")).willThrow(new UrlNotFoundException("zzz999"));

        mockMvc.perform(get("/zzz999"))
                .andExpect(status().isNotFound())
                .andExpect(header().doesNotExist("Location"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("No URL found for short code: zzz999"))
                .andExpect(jsonPath("$.path").value("/zzz999"));
    }

    @Test
    void redirect_ignoresPathsThatAreNotSixCharCodes() throws Exception {
        mockMvc.perform(get("/favicon.ico"))
                .andExpect(status().isNotFound());

        verifyNoInteractions(urlShortenerService);
    }
}
