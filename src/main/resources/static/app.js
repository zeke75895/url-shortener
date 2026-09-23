// URL SHORTENER - front-end logic
// Plain functions and event listeners; talks to the Spring Boot REST API.

const shortenForm = document.getElementById("shorten-form");
const longUrlInput = document.getElementById("long-url");
const shortenButton = document.getElementById("shorten-button");
const shortenError = document.getElementById("shorten-error");
const shortenResult = document.getElementById("shorten-result");
const resultCode = document.getElementById("result-code");
const resultLink = document.getElementById("result-link");

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
