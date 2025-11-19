// background.js

const ICON_COLORS = {
  found: '#10b981',
  none: '#9ca3af',
  error: '#ef4444'
};

function buildIcon(color, size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return canvas.convertToBlob().then((blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  });
}

async function setStatusIcon(status) {
  const color = ICON_COLORS[status] || ICON_COLORS.none;
  const sizes = [16, 32, 48, 128];
  const iconMap = {};

  for (const size of sizes) {
    iconMap[size] = await buildIcon(color, size);
  }

  await chrome.action.setIcon({ path: iconMap });
}

// Listen for messages from the popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'schema-status') {
    setStatusIcon(request.status).catch((error) => console.warn('Icon update failed', error));
    return;
  }

  if (request.action === 'authenticate') {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('Authentication Error:', chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ token: token });
      }
    });

    return true;
  }
});
