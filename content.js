// content.js

// Prevent multiple injections
if (!window.hasTandemListener) {
  window.hasTandemListener = true;

  // Helper: Find GTM ID
  function getGtmId() {
    // Method 1: Check Script Tags
    const scripts = document.getElementsByTagName('script');
    for (let s of scripts) {
      if (s.src && s.src.includes('googletagmanager.com/gtm.js')) {
        const match = s.src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
        if (match) return match[1];
      }
    }
    // Method 2: Check raw HTML (sometimes GTM is inline or hidden)
    const html = document.documentElement.innerHTML;
    const match = html.match(/(GTM-[A-Z0-9]{6,})/);
    return match ? match[1] : null;
  }

  // Helper: Find Existing Schema
  function getExistingSchema() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const schemas = [];
    scripts.forEach(script => {
      try {
        const json = JSON.parse(script.innerText);
        schemas.push(json);
      } catch (e) {
        // Ignore invalid JSON
      }
    });
    return schemas.length > 0 ? schemas : null;
  }

  // Helper: Get Page Context for AI
  function getPageContent() {
    const title = document.title || "";
    const description = document.querySelector('meta[name="description"]')?.content || "";
    const h1 = document.querySelector('h1')?.innerText || "";
    
    // Get Headers structure
    const headers = Array.from(document.querySelectorAll('h2, h3'))
      .slice(0, 15)
      .map(h => `${h.tagName}: ${h.innerText}`)
      .join("\n");

    // Get main text content (first 2000 chars)
    const bodyText = document.body.innerText.substring(0, 2000).replace(/\s+/g, ' ');

    return `
      URL: ${window.location.href}
      Title: ${title}
      H1: ${h1}
      Description: ${description}
      Structure:
      ${headers}
      Content Snippet:
      ${bodyText}
    `.trim();
  }

  // Message Listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanPage") {
      sendResponse({
        url: window.location.href,
        gtmId: getGtmId(),
        content: getPageContent(),
        existingSchema: getExistingSchema()
      });
    }
    // Return true to allow async response if needed
    return true;
  });
}