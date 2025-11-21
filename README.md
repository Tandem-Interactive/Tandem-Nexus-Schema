# Tandem NEXUS Schema

An enterprise-grade Chrome extension for designing, validating, and deploying structured data. Tandem NEXUS Schema automatically discovers on-page JSON-LD and microdata, helps you craft schema.org entities through a guided visual builder, and integrates with Google Tag Manager (GTM) and Gemini for AI-assisted generation.

## Table of Contents
1. [Feature Overview](#feature-overview)
2. [Prerequisites](#prerequisites)
3. [Install Google Chrome](#install-google-chrome)
4. [Install the Extension](#install-the-extension)
5. [First-Run Setup](#first-run-setup)
6. [Using Tandem NEXUS Schema](#using-tandem-nexus-schema)
7. [Troubleshooting](#troubleshooting)
8. [Project Structure](#project-structure)

## Feature Overview
- **Automatic schema discovery**: Scans every visited page for JSON-LD and microdata, surfaces errors, and updates status in real time.
- **Visual schema builder**: Curated schema.org library with intelligent defaults, nested type presets, and property suggestions for rapid authoring.
- **AI-assisted drafting**: Uses Google Gemini (configurable model) to generate schema from page context or custom prompts.
- **GTM-aware workflows**: Detects GTM container IDs and supports authenticated calls to Google Tag Manager APIs via OAuth2.
- **Offline-ready schema index**: Falls back to a bundled schema index when the remote catalog cannot be fetched.
- **Clipboard-friendly output**: Quickly copy generated JSON-LD or download a ready-to-use manifest for redeployments.

## Prerequisites
- macOS, Windows, or Linux with permissions to install a browser.
- Ability to load unpacked extensions (Chrome Developer Mode).
- A Google Gemini API key (created at [Google AI Studio](https://aistudio.google.com/)).
- An OAuth2 Client ID with the scopes listed in `manifest.json` if you plan to push changes to GTM.

## Install Google Chrome
**macOS**
1. Download the latest `GoogleChrome.dmg` from https://www.google.com/chrome/.
2. Open the DMG and drag **Google Chrome** into **Applications**.
3. Launch Chrome from **Applications** or Spotlight.

**Windows**
1. Download `ChromeSetup.exe` from https://www.google.com/chrome/.
2. Run the installer and allow it to complete.
3. Open **Google Chrome** from the Start menu.

**Ubuntu/Debian**
```bash
# Download and install the stable .deb
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt update
sudo apt install -y ./google-chrome-stable_current_amd64.deb
```

> **Tip:** Chrome and Chromium are both supported; ensure the browser version supports Manifest V3 extensions.

## Install the Extension
1. Clone or download this repository to your machine.
2. Open **Google Chrome** and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right).
4. Click **Load unpacked** and select the project directory (the folder containing `manifest.json`).
5. Verify the extension appears as **Tandem NEXUS Schema** with the action icon enabled.

## First-Run Setup
1. Click the extension icon to open the popup.
2. Complete the setup wizard:
   - **Gemini API Key**: Paste your key from Google AI Studio.
   - **Google OAuth Client ID**: Provide a client ID if you need GTM API access. The wizard can generate a tailored `manifest.json` with your client ID.
3. Save settings. They are stored in Chrome sync storage so they follow you across browsers when signed in.

## Using Tandem NEXUS Schema
1. Open any page you want to audit.
2. Click the extension icon.
3. Use the toolbar:
   - **Scan Page**: Re-scan for JSON-LD and microdata. Errors are flagged and a status badge is updated.
   - **Visual Builder**: Choose a schema.org type, edit fields (with nested presets for properties like `address`, `offers`, and `aggregateRating`), and preview the JSON-LD.
   - **AI Generate**: Use the captured page context or provide a prompt to have Gemini draft schema. Select the model name if you prefer a non-default Gemini model.
   - **GTM Integration**: If authenticated, push schema updates to Tag Manager containers detected on the page.
   - **Export/Clipboard**: Copy JSON-LD to your clipboard or download the generated manifest for re-use.
4. Repeat scans; the extension automatically observes DOM mutations and refreshes results on content changes.

## Troubleshooting
- **Authentication errors**: Ensure the OAuth client ID in `manifest.json` is not the placeholder and that the required scopes are enabled in Google Cloud Console.
- **Schema index unavailable**: The extension will fall back to `schema-index.json`. Confirm network access if remote updates are needed.
- **Clipboard blocked**: Some pages restrict clipboard writes. Use the download option as a fallback.
- **No schema detected**: Verify the page has loaded fully. Use **Scan Page** after dynamic content renders.

## Project Structure
- `manifest.json`: Chrome extension manifest (permissions, OAuth scopes, entry points).
- `background.js`: Handles authentication requests and runtime messaging.
- `content.js`: Injected into pages to detect existing schemas, GTM IDs, and send scan results to the popup.
- `popup.js`: Core UI logic, schema registry, AI integration, and setup wizard.
- `popup.html` / `style.css`: Popup UI markup and styles.
- `schema-index.json`: Bundled schema.org type and property catalog used when remote loading fails.

