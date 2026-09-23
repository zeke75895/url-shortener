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

const recentEmpty = document.getElementById("recent-empty");
const recentTable = document.getElementById("recent-table");
const recentBody = document.getElementById("recent-body");
const recentClearButton = document.getElementById("recent-clear");

const RECENT_LINKS_KEY = "urlShortener.recentLinks";
const MAX_RECENT_LINKS = 5;

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

    addRecentLink(body.shortCode, longUrlInput.value.trim());

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
    updateRecentClickCount(body.shortCode, body.clickCount);
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

// ---------- Recent links (saved in localStorage) ----------

// Each saved link looks like { shortCode, longUrl, clickCount }, newest first
function loadRecentLinks() {
    try {
        const links = JSON.parse(localStorage.getItem(RECENT_LINKS_KEY));
        return Array.isArray(links) ? links : [];
    } catch (error) {
        return [];
    }
}

function saveRecentLinks(links) {
    try {
        localStorage.setItem(RECENT_LINKS_KEY, JSON.stringify(links));
    } catch (error) {
        // Storage is full or blocked (e.g. private mode); the list just won't persist
    }
}

function addRecentLink(shortCode, longUrl) {
    const links = loadRecentLinks().filter(function (link) {
        return link.shortCode !== shortCode;
    });
    links.unshift({ shortCode: shortCode, longUrl: longUrl, clickCount: 0 });
    saveRecentLinks(links.slice(0, MAX_RECENT_LINKS));
    renderRecentLinks();
}

function updateRecentClickCount(shortCode, clickCount) {
    const links = loadRecentLinks();
    const link = links.find(function (item) {
        return item.shortCode === shortCode;
    });
    if (link && link.clickCount !== clickCount) {
        link.clickCount = clickCount;
        saveRecentLinks(links);
        renderRecentLinks();
    }
}

function renderRecentLinks() {
    const links = loadRecentLinks();
    recentBody.innerHTML = "";

    links.forEach(function (link) {
        const row = document.createElement("tr");

        const codeCell = document.createElement("td");
        const codeLink = document.createElement("a");
        codeLink.href = window.location.origin + "/" + encodeURIComponent(link.shortCode);
        codeLink.target = "_blank";
        codeLink.rel = "noopener";
        codeLink.textContent = link.shortCode;
        codeCell.appendChild(codeLink);

        const urlCell = document.createElement("td");
        urlCell.className = "cell-url";
        urlCell.textContent = link.longUrl;
        urlCell.title = link.longUrl;

        const clicksCell = document.createElement("td");
        clicksCell.className = "col-clicks";
        clicksCell.textContent = String(link.clickCount).padStart(6, "0");

        row.append(codeCell, urlCell, clicksCell);
        recentBody.appendChild(row);
    });

    const hasLinks = links.length > 0;
    recentTable.hidden = !hasLinks;
    recentClearButton.hidden = !hasLinks;
    recentEmpty.hidden = hasLinks;
}

function handleClearRecent() {
    saveRecentLinks([]);
    renderRecentLinks();
}

recentClearButton.addEventListener("click", handleClearRecent);

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

// ---------- Start-up ----------

renderRecentLinks();

// After a page refresh, keep tracking the newest saved link
const savedLinks = loadRecentLinks();
if (savedLinks.length > 0) {
    latestShortCode = savedLinks[0].shortCode;
    statsCodeInput.value = latestShortCode;
}

autoRefreshStats();
