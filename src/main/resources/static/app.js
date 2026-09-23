// URL SHORTENER - front-end logic
// Plain functions and event listeners; talks to the Spring Boot REST API.

const shortenForm = document.getElementById("shorten-form");
const longUrlInput = document.getElementById("long-url");
const shortenButton = document.getElementById("shorten-button");
const shortenError = document.getElementById("shorten-error");
const shortenResult = document.getElementById("shorten-result");
const resultCode = document.getElementById("result-code");
const resultLink = document.getElementById("result-link");
const resultQr = document.getElementById("result-qr");

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
    renderQrCode(resultQr, body.shortUrl);
    shortenResult.hidden = false;

    addRecentLink(body.shortCode, longUrlInput.value.trim());

    // Show stats for the new code right away; autoRefreshStats keeps them current
    statsCodeInput.value = body.shortCode;
    statsForm.requestSubmit();
}

// Draws the QR code as an SVG: one path made of 1x1 squares, plus a 4-module quiet zone
function renderQrCode(container, text) {
    let matrix;
    try {
        matrix = createQrMatrix(text);
    } catch (error) {
        container.hidden = true;
        return;
    }

    const quietZone = 4;
    const size = matrix.length + quietZone * 2;
    let pathData = "";
    matrix.forEach(function (row, y) {
        row.forEach(function (dark, x) {
            if (dark) {
                pathData += "M" + (x + quietZone) + " " + (y + quietZone) + "h1v1h-1z";
            }
        });
    });

    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "QR code for " + text);

    const path = document.createElementNS(svgNs, "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);

    container.replaceChildren(svg);
    container.hidden = false;
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

// Each saved link looks like { shortCode, longUrl, clickCount }, newest first.
// clickCount is null when the server no longer knows the code.
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
        if (link.clickCount === null) {
            clicksCell.textContent = "GONE";
            clicksCell.classList.add("gone");
            clicksCell.title = "Not found. The in-memory database resets when the app restarts.";
        } else {
            clicksCell.textContent = String(link.clickCount).padStart(6, "0");
        }

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

// Fetches fresh stats for one code and updates the recent links list and stats panel.
// A 404 means the link no longer exists (the in-memory database resets on restart).
async function refreshStatsFor(shortCode) {
    try {
        const response = await fetch("/api/stats/" + encodeURIComponent(shortCode));
        if (response.status === 404) {
            updateRecentClickCount(shortCode, null);
            return;
        }
        if (!response.ok) {
            return;
        }
        const body = await response.json();
        updateRecentClickCount(body.shortCode, body.clickCount);
        // Re-check: the user may have looked up a different code while this request was running
        if (isStatsShowing(body.shortCode)) {
            showStatsResult(body);
        }
    } catch (error) {
        // Server unreachable; try again on the next run
    }
}

// Every 5 seconds, refresh every click count on the page: the recent links (newest
// first, so this includes the most recently shortened code) plus whatever the stats
// panel is showing. setTimeout schedules the next run only after this one finishes,
// so slow responses can never pile up the way they can with setInterval.
async function autoRefreshStats() {
    if (!document.hidden) {
        const shortCodes = loadRecentLinks().map(function (link) {
            return link.shortCode;
        });
        const shownCode = document.getElementById("stats-short-code").textContent;
        if (!statsResult.hidden && !shortCodes.includes(shownCode)) {
            shortCodes.push(shownCode);
        }
        await Promise.all(shortCodes.map(refreshStatsFor));
    }
    setTimeout(autoRefreshStats, REFRESH_INTERVAL_MS);
}

// ---------- Start-up ----------

renderRecentLinks();

// After a page refresh, pre-fill the stats panel with the newest saved link
const savedLinks = loadRecentLinks();
if (savedLinks.length > 0) {
    statsCodeInput.value = savedLinks[0].shortCode;
}

autoRefreshStats();
