// Headless Chrome for rendering: the installed Google Chrome first, so nothing has to be downloaded.
import { chromium } from 'playwright-core';

export async function launchBrowser() {
  const attempts = [];
  if (process.env.FORESHOCK_CHROME) attempts.push({ executablePath: process.env.FORESHOCK_CHROME });
  attempts.push({ channel: 'chrome' });
  attempts.push({}); // a Playwright-managed Chromium, if one is installed
  let last;
  for (const opts of attempts) {
    try {
      return await chromium.launch({ headless: true, ...opts });
    } catch (e) {
      last = e;
    }
  }
  throw new Error(
    'No Chrome to render with. Install Google Chrome, set FORESHOCK_CHROME=/path/to/chrome, '
    + `or run "npx playwright install chromium".\n${last?.message ?? ''}`,
  );
}
