import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXERS_PATH = join(__dirname, '..', 'fixers.json');
const STATUS_PATH = join(__dirname, '..', 'fixer-status.json');
const COOLDOWN_DURATION = 30 * 60 * 1000; // 30 minutes

let fixers = {};
let fixerStatus = {};

export function initializeFixerStatus() {
  // Load fixers
  fixers = JSON.parse(readFileSync(FIXERS_PATH, 'utf-8'));

  // Load or create fixer status
  if (existsSync(STATUS_PATH)) {
    fixerStatus = JSON.parse(readFileSync(STATUS_PATH, 'utf-8'));
  } else {
    fixerStatus = {};
    saveFixerStatus();
  }

  console.log(`✅ Loaded ${Object.keys(fixers).length} social media platforms`);
  console.log(`📊 Loaded status for ${Object.keys(fixerStatus).length} fixers`);
}

function saveFixerStatus() {
  writeFileSync(STATUS_PATH, JSON.stringify(fixerStatus, null, 2));
}

function getFixerKey(domain, fixer) {
  return `${domain}:${fixer}`;
}

function isFixerOnCooldown(domain, fixer) {
  const key = getFixerKey(domain, fixer);
  const status = fixerStatus[key];

  if (!status || !status.lastFailure) {
    return false;
  }

  const timeSinceFailure = Date.now() - status.lastFailure;
  return timeSinceFailure < COOLDOWN_DURATION;
}

function markFixerFailed(domain, fixer) {
  const key = getFixerKey(domain, fixer);

  if (!fixerStatus[key]) {
    fixerStatus[key] = {
      failures: 0,
      successes: 0,
      lastFailure: null,
      lastSuccess: null
    };
  }

  fixerStatus[key].failures++;
  fixerStatus[key].lastFailure = Date.now();

  saveFixerStatus();
  console.log(`❌ Marked ${key} as failed (cooldown until ${new Date(Date.now() + COOLDOWN_DURATION).toISOString()})`);
}

function markFixerSuccess(domain, fixer) {
  const key = getFixerKey(domain, fixer);

  if (!fixerStatus[key]) {
    fixerStatus[key] = {
      failures: 0,
      successes: 0,
      lastFailure: null,
      lastSuccess: null
    };
  }

  fixerStatus[key].successes++;
  fixerStatus[key].lastSuccess = Date.now();
  fixerStatus[key].lastFailure = null; // Clear cooldown on success

  saveFixerStatus();
  console.log(`✅ Marked ${key} as successful`);
}

export function isAlreadyConverted(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '');

    // Check if this hostname is a fixer domain
    for (const domain of Object.keys(fixers)) {
      const fixerList = fixers[domain];
      for (let i = 0; i < fixerList.length; i++) {
        const fixer = fixerList[i];
        if (hostname === fixer || hostname.endsWith('.' + fixer)) {
          return {
            isConverted: true,
            domain: domain,
            fixer: fixer,
            fixerIndex: i
          };
        }
      }
    }

    return { isConverted: false };
  } catch (error) {
    return { isConverted: false };
  }
}

export function convertUrl(originalUrl, startIndex = 0) {
  try {
    const url = new URL(originalUrl);
    const hostname = url.hostname.toLowerCase().replace('www.', '');

    // Find matching domain in fixers
    let matchedDomain = null;
    for (const domain of Object.keys(fixers)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        matchedDomain = domain;
        break;
      }
    }

    if (!matchedDomain) {
      return {
        converted: false,
        url: originalUrl,
        domain: hostname
      };
    }

    const availableFixers = fixers[matchedDomain];

    // Find the first fixer that's not on cooldown, starting from startIndex
    for (let i = startIndex; i < availableFixers.length; i++) {
      const fixer = availableFixers[i];

      if (!isFixerOnCooldown(matchedDomain, fixer)) {
        // Replace the domain with the fixer
        const newUrl = originalUrl.replace(hostname, fixer);

        return {
          converted: true,
          url: newUrl,
          domain: matchedDomain,
          fixer: fixer,
          fixerIndex: i,
          originalUrl: originalUrl
        };
      }
    }

    // If all fixers are on cooldown, use the first one anyway
    if (startIndex < availableFixers.length) {
      const fixer = availableFixers[startIndex];
      const newUrl = originalUrl.replace(hostname, fixer);

      console.log(`⚠️ All fixers on cooldown, using ${fixer} anyway`);

      return {
        converted: true,
        url: newUrl,
        domain: matchedDomain,
        fixer: fixer,
        fixerIndex: startIndex,
        originalUrl: originalUrl
      };
    }

    return {
      converted: false,
      url: originalUrl,
      domain: matchedDomain
    };
  } catch (error) {
    console.error('Error converting URL:', error);
    return {
      converted: false,
      url: originalUrl,
      error: error.message
    };
  }
}

export { markFixerFailed, markFixerSuccess };
