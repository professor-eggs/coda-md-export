/**
 * Content script for detecting Coda pages
 * This script runs on Coda pages to extract doc and page information
 */

import { CodaUrlParserAdapter } from '../url-parser/coda-url-parser.adapter';
import {
  PageDetectionResult,
  PageInfoResponse,
  PageInfoRequestSchema,
} from '../../domain/models/page-info.schema';

// Create parser instance
const urlParser = new CodaUrlParserAdapter();

/**
 * Detect the current page information
 */
function detectCurrentPage(): PageDetectionResult {
  try {
    const currentUrl = window.location.href;
    const pageInfo = urlParser.parseUrl(currentUrl);

    if (pageInfo) {
      return {
        detected: true,
        pageInfo,
        url: currentUrl,
      };
    }

    return {
      detected: false,
      url: currentUrl,
      error: 'Not a valid Coda page URL',
    };
  } catch (error) {
    return {
      detected: false,
      url: window.location.href,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle messages from popup
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    // Validate message format
    const validated = PageInfoRequestSchema.safeParse(message);

    if (!validated.success) {
      sendResponse({
        type: 'PAGE_INFO_RESPONSE',
        payload: {
          detected: false,
          error: 'Invalid message format',
        },
      } as PageInfoResponse);
      return true;
    }

    // Detect page info
    const pageInfo = detectCurrentPage();

    // Send response
    const response: PageInfoResponse = {
      type: 'PAGE_INFO_RESPONSE',
      payload: pageInfo,
    };

    sendResponse(response);
  } catch (error) {
    sendResponse({
      type: 'PAGE_INFO_RESPONSE',
      payload: {
        detected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    } as PageInfoResponse);
  }

  // Return true to indicate async response
  return true;
});

// Log that content script loaded
console.log('Coda Markdown Export: Content script loaded');

/**
 * Notify background script about page detection status
 */
function notifyPageDetection(): void {
  const detection = detectCurrentPage();

  if (detection.detected) {
    chrome.runtime.sendMessage({
      type: 'PAGE_DETECTED',
      pageInfo: detection.pageInfo,
    }).catch(() => {
      // Ignore errors if background script isn't ready
      console.log('Could not notify background script (extension may be reloading)');
    });
  } else {
    chrome.runtime.sendMessage({
      type: 'PAGE_NOT_DETECTED',
    }).catch(() => {
      // Ignore errors
    });
  }
}

// Notify on initial page load
notifyPageDetection();

// Monitor for URL changes (Coda is a single-page app)
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log('Coda Markdown Export: URL changed, re-detecting page');
    notifyPageDetection();
  }
});

// Start observing URL changes
urlObserver.observe(document, { subtree: true, childList: true });

// Also listen for popstate events (browser back/forward)
window.addEventListener('popstate', () => {
  console.log('Coda Markdown Export: Navigation detected, re-detecting page');
  notifyPageDetection();
});

// Export for testing
export { detectCurrentPage };
