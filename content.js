// content.js
// This file runs INSIDE the webpage
// It listens for scrape requests from popup.js and returns data

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

  if (message.action === "scrape-title") {
    sendResponse({ data: [document.title || "No title found"] });
  }

  else if (message.action === "scrape-links") {
    const links = document.querySelectorAll("a");
    const results = [];
    for (let i = 0; i < links.length; i++) {
      const href = links[i].href;
      const text = (links[i].innerText || "").trim();
      if (href && href.startsWith("http")) {
        results.push((text || "(no text)") + "  →  " + href);
      }
    }
    sendResponse({ data: results.slice(0, 30) });
  }

  else if (message.action === "scrape-headings") {
    const headings = document.querySelectorAll("h1, h2, h3");
    const results = [];
    for (let i = 0; i < headings.length; i++) {
      const text = (headings[i].innerText || "").trim();
      if (text) {
        results.push("[" + headings[i].tagName + "]  " + text);
      }
    }
    sendResponse({ data: results.slice(0, 30) });
  }

  else if (message.action === "scrape-images") {
    const imgs = document.querySelectorAll("img");
    const results = [];
    for (let i = 0; i < imgs.length; i++) {
      const src = imgs[i].src;
      const alt = imgs[i].alt || "no description";
      if (src && src.startsWith("http")) {
        results.push(alt + "  →  " + src);
      }
    }
    sendResponse({ data: results.slice(0, 30) });
  }
        // for AI 
        else if (message.action === "scrape-text") {
        // Get the body text, remove extra whitespace
        const text = document.body.innerText
          .replace(/\s+/g, " ")   // multiple spaces → one space
          .trim()
          .slice(0, 3000);         // first 3000 characters (API has limits)

        sendResponse({ data: text });
      }

  return true;
});   