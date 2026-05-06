document.addEventListener("DOMContentLoaded", function () {


    // Apply dark mode on settings page too (reads same storage key)
chrome.storage.local.get("darkMode", function (result) {
  if (result.darkMode === true) {
    document.body.classList.add("dark");
  }
});



// ── LIVE THEME SYNC ───────────────────────────────────────────────────────
// This listener fires whenever ANY chrome.storage value changes — even if
// the change came from a completely different page (like the popup).
chrome.storage.onChanged.addListener(function (changes, area) {
  // "changes" is an object containing every key that changed
  // Each key maps to { oldValue, newValue }
  // "area" is "local", "sync", or "session" — tells us which storage was changed

  // We only care about the "local" storage area (where we saved darkMode)
  // and only when the "darkMode" key specifically changed
  if (area === "local" && changes.darkMode) {

    // changes.darkMode.newValue is the value that was just saved
    if (changes.darkMode.newValue === true) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }
});





  // ── LOAD ALL SAVED SETTINGS ──────────────────────────────
  chrome.storage.sync.get(
    ["geminiApiKey", "scraperEnabled", "bookmarksEnabled", "aiEnabled","historyEnabled"],
    function (result) {
      if (result.geminiApiKey) {
        document.getElementById("api-key-input").value = result.geminiApiKey;
      }
      document.getElementById("toggle-scraper").checked   = result.scraperEnabled   ?? true;
      document.getElementById("toggle-bookmarks").checked = result.bookmarksEnabled ?? true;
      document.getElementById("toggle-ai").checked        = result.aiEnabled        ?? true;
      document.getElementById("toggle-history").checked = result.historyEnabled ?? true;
    }
  );

  // ── SHOW / HIDE API KEY ───────────────────────────────────
  document.getElementById("btn-toggle-visibility").addEventListener("click", function () {
    const input = document.getElementById("api-key-input");
    if (input.type === "password") {
      input.type = "text";
      this.textContent = "🙈";
    } else {
      input.type = "password";
      this.textContent = "👁️";
    }
  });

  // ── SAVE API KEY ──────────────────────────────────────────
  document.getElementById("btn-save-key").addEventListener("click", function () {
    const key = document.getElementById("api-key-input").value.trim();
    if (!key) {
      document.getElementById("save-status").textContent = "⚠️ Please paste a key first.";
      document.getElementById("save-status").style.color = "#dc2626";
      return;
    }
    chrome.storage.sync.set({ geminiApiKey: key }, function () {
      const status = document.getElementById("save-status");
      status.textContent = "✅ API key saved!";
      status.style.color = "#059669";
      setTimeout(function () { status.textContent = ""; }, 3000);
    });
  });

  // ── SAVE FEATURE TOGGLES (manual button) ─────────────────
  document.getElementById("btn-save-toggles").addEventListener("click", function () {
    saveToggles();
  });

  // ── AUTO-SAVE TOGGLES ON FLIP ─────────────────────────────
  // This is OUTSIDE the btn-save-toggles handler — that was the bug.
  // Now it runs immediately when DOMContentLoaded fires,
  // so the listeners are attached as soon as the page loads.
  ["toggle-scraper", "toggle-bookmarks", "toggle-ai","toggle-history"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function () {
      saveToggles();
    });
  });

});

// ── SAVE TOGGLES HELPER ───────────────────────────────────
// A separate function so both the button AND the auto-save
// can call the exact same logic without repeating code.
function saveToggles() {
  chrome.storage.sync.set({
    scraperEnabled:   document.getElementById("toggle-scraper").checked,
    bookmarksEnabled: document.getElementById("toggle-bookmarks").checked,
    aiEnabled:        document.getElementById("toggle-ai").checked,
    historyEnabled:   document.getElementById("toggle-history").checked
  }, function () {
    const status = document.getElementById("toggle-status");
    status.textContent = "✅ Saved!";
    status.style.color = "#059669";
    setTimeout(function () { status.textContent = ""; }, 2000);
  });
}