// URL SHORTENER - front-end logic
// Plain functions and event listeners; talks to the Spring Boot REST API.

const shortenForm = document.getElementById("shorten-form");
const longUrlInput = document.getElementById("long-url");
const shortenButton = document.getElementById("shorten-button");
const shortenError = document.getElementById("shorten-error");
const shortenResult = document.getElementById("shorten-result");
const resultCode = document.getElementById("result-code");
const resultLink = document.getElementById("result-link");

const statsForm = document.getElementById("stats-form");
const statsCodeInput = document.getElementById("stats-code");
const statsButton = document.getElementById("stats-button");
const statsError = document.getElementById("stats-error");
const statsResult = document.getElementById("stats-result");

const REFRESH_INTERVAL_MS = 5000;
let latestShortCode = null;

// ---------- Helpers ----------

// Returns the parsed JSON body, or null if the body is empty or not JSON
async function readJson(response) {
    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

// Turns an ApiError body from the server into a list of messages to display
function getErrorMessages(body, status) {
    if (body && Array.isArray(body.fieldErrors) && body.fieldErrors.length > 0) {
        return body.fieldErrors.map(function (fieldError) {
            return fieldError.message;
        });
    }
    if (body && body.message) {
        return [body.message];
    }
    return ["REQUEST FAILED (HTTP " + status + ")"];
}

function showError(box, messages) {
    const list = box.querySelector(".error-list");
    list.innerHTML = "";
    messages.forEach(function (message) {
        const item = document.createElement("li");
        item.textContent = message;
        list.appendChild(item);
    });
    box.hidden = false;
}

function hideError(box) {
    box.hidden = true;
}

function setBusy(button, busy, busyText, idleText) {
    button.disabled = busy;
    button.textContent = busy ? busyText : idleText;
}

// ---------- Shorten ----------

function showShortenResult(body) {
    resultCode.textContent = body.shortCode;
    resultLink.href = body.shortUrl;
    resultLink.textContent = body.shortUrl;
    shortenResult.hidden = false;

    // Show stats for the new code right away; autoRefreshStats keeps them current
    latestShortCode = body.shortCode;
    statsCodeInput.value = body.shortCode;
    statsForm.requestSubmit();
}

async function handleShortenSubmit(event) {
    event.preventDefault();
    hideError(shortenError);
    shortenResult.hidden = true;
    setBusy(shortenButton, true, "WORKING...", "SHORTEN");

    try {
        const response = await fetch("/api/shorten", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ longUrl: longUrlInput.value.trim() })
        });
        const body = await readJson(response);

        if (!response.ok) {
            showError(shortenError, getErrorMessages(body, response.status));
            return;
        }
        showShortenResult(body);
    } catch (error) {
        showError(shortenError, ["CONNECTION LOST. IS THE SERVER RUNNING?"]);
    } finally {
        setBusy(shortenButton, false, "WORKING...", "SHORTEN");
    }
}

shortenForm.addEventListener("submit", handleShortenSubmit);

// ---------- Stats ----------

// "2026-09-23T21:22:18.629139Z" -> "2026-09-23 21:22:18 UTC"
function formatTimestamp(isoString) {
    return isoString.replace("T", " ").slice(0, 19) + " UTC";
}

function isStatsShowing(shortCode) {
    return !statsResult.hidden && document.getElementById("stats-short-code").textContent === shortCode;
}

function showStatsResult(body) {
    document.getElementById("stats-short-code").textContent = body.shortCode;
    document.getElementById("stats-long-url").textContent = body.longUrl;
    document.getElementById("stats-clicks").textContent = String(body.clickCount).padStart(6, "0");
    document.getElementById("stats-created").textContent = formatTimestamp(body.createdAt);
    statsResult.hidden = false;
}

async function handleStatsSubmit(event) {
    event.preventDefault();
    hideError(statsError);
    statsResult.hidden = true;

    const shortCode = statsCodeInput.value.trim();
    if (shortCode === "") {
        showError(statsError, ["ENTER A SHORT CODE"]);
        return;
    }

    setBusy(statsButton, true, "WORKING...", "CHECK");
    try {
        const response = await fetch("/api/stats/" + encodeURIComponent(shortCode));
        const body = await readJson(response);

        if (!response.ok) {
            showError(statsError, getErrorMessages(body, response.status));
            return;
        }
        showStatsResult(body);
    } catch (error) {
        showError(statsError, ["CONNECTION LOST. IS THE SERVER RUNNING?"]);
    } finally {
        setBusy(statsButton, false, "WORKING...", "CHECK");
    }
}

statsForm.addEventListener("submit", handleStatsSubmit);

// ---------- Auto-refresh ----------

// Every 5 seconds, re-fetch stats for the most recently shortened code while the stats
// panel is showing it. setTimeout schedules the next run only after this one finishes,
// so slow responses can never pile up the way they can with setInterval.
async function autoRefreshStats() {
    if (latestShortCode !== null && isStatsShowing(latestShortCode) && !document.hidden) {
        try {
            const response = await fetch("/api/stats/" + encodeURIComponent(latestShortCode));
            // Re-check: the user may have looked up a different code while this request was running
            if (response.ok && isStatsShowing(latestShortCode)) {
                showStatsResult(await response.json());
            }
        } catch (error) {
            // Server unreachable; try again on the next run
        }
    }
    setTimeout(autoRefreshStats, REFRESH_INTERVAL_MS);
}

autoRefreshStats();
