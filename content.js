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

  // Helper: Sanitize and parse JSON-LD safely
  function parseJsonLd(scriptContent) {
    // Preserve common whitespace while removing control characters that break parsing
    const cleaned = scriptContent.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]+/g, "");
    return JSON.parse(cleaned);
  }

  // Helper: Build a microdata object recursively
  function extractMicrodataItem(element) {
    const item = {};

    const type = element.getAttribute('itemtype');
    if (type) item['@type'] = type.trim();

    const id = element.getAttribute('itemid');
    if (id) item['@id'] = id.trim();

    const properties = element.querySelectorAll('[itemprop]');
    properties.forEach((prop) => {
      const propName = prop.getAttribute('itemprop');
      if (!propName) return;

      if (prop.hasAttribute('itemscope')) {
        item[propName] = extractMicrodataItem(prop);
        return;
      }

      const value = prop.getAttribute('content') || prop.textContent || '';
      if (item[propName]) {
        item[propName] = Array.isArray(item[propName]) ? [...item[propName], value.trim()] : [item[propName], value.trim()];
      } else {
        item[propName] = value.trim();
      }
    });

    return item;
  }

  // Helper: Find Existing Schema
  function getExistingSchema() {
    const schemas = [];

    // Parse JSON-LD blocks with robust error handling
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    scripts.forEach((script) => {
      try {
        const json = parseJsonLd(script.textContent || script.innerText || '');
        schemas.push(json);
      } catch (e) {
        console.warn('Tandem Nexus: Invalid JSON-LD found', e);
        schemas.push({
          error: 'Invalid JSON-LD',
          rawSnippet: (script.textContent || '').trim().slice(0, 120)
        });
      }
    });

    // Capture Microdata structures (top-level itemscope only)
    const microdataItems = document.querySelectorAll('[itemscope]:not([itemprop])');
    microdataItems.forEach((node) => {
      try {
        const item = extractMicrodataItem(node);
        if (Object.keys(item).length > 0) {
          schemas.push({ '@context': 'https://schema.org', ...item });
        }
      } catch (error) {
        console.warn('Tandem Nexus: Unable to parse microdata', error);
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
