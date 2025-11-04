/**
 * Background service worker for the Chrome extension
 * Handles long-running operations, message passing, and badge updates
 */

// Listen for messages from content script about page detection
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.tab?.id) return;

  if (message.type === 'PAGE_DETECTED') {
    // Show green checkmark badge when on valid Coda page
    chrome.action.setBadgeText({ text: '✓', tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981', tabId: sender.tab.id }); // Green-500
    console.log('Coda page detected - badge enabled for tab', sender.tab.id);
  } else if (message.type === 'PAGE_NOT_DETECTED') {
    // Clear badge when not on valid Coda page
    chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
    console.log('Non-Coda page detected - badge cleared for tab', sender.tab.id);
  }
});

// Clear badge when tab is updated/navigated
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    // Clear badge immediately when navigation starts
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

// Clear badge when switching tabs to non-Coda pages
chrome.tabs.onActivated.addListener((activeInfo) => {
  // The content script will send a message if it's a Coda page
  // This just ensures badges are cleared for non-Coda pages
  chrome.tabs.get(activeInfo.tabId).then((tab) => {
    if (tab.url && !tab.url.includes('coda.io')) {
      chrome.action.setBadgeText({ text: '', tabId: activeInfo.tabId });
    }
  }).catch(() => {
    // Ignore errors (e.g., chrome:// pages)
  });
});

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Coda Markdown Export extension installed');
});

// Export the chrome object for testing
export {};
