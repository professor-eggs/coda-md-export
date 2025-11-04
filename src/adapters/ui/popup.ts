/**
 * Popup UI script
 * Handles user interactions for API key configuration and export
 */

import { ChromeStorageAdapter } from '../storage/chrome-storage.adapter';
import { CodaApiAdapter } from '../api/coda-api.adapter';
import { ConfigurationService } from '../../domain/services/configuration.service';
import { PageDetectionService } from '../../domain/services/page-detection.service';
import { ExportService } from '../../domain/services/export.service';
import { CodaPageIdentifier } from '../../domain/models/api.schema';
import { ExportState } from '../../domain/models/export.schema';

// Initialize adapters and services
const storage = new ChromeStorageAdapter();
const apiClient = new CodaApiAdapter();
const configService = new ConfigurationService(storage, apiClient);
const pageDetectionService = new PageDetectionService(apiClient, storage);
const exportService = new ExportService(apiClient, storage);

// DOM elements
const messageContainer = document.getElementById('message-container') as HTMLDivElement;
const unconfiguredView = document.getElementById('unconfigured-view') as HTMLDivElement;
const configuredView = document.getElementById('configured-view') as HTMLDivElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const saveButton = document.getElementById('save-button') as HTMLButtonElement;
const saveButtonText = document.getElementById('save-button-text') as HTMLSpanElement;
const saveButtonLoading = document.getElementById('save-button-loading') as HTMLSpanElement;
const clearButton = document.getElementById('clear-button') as HTMLButtonElement;
const userNameElement = document.getElementById('user-name') as HTMLElement;

// Page info elements
const pageInfoLoading = document.getElementById('page-info-loading') as HTMLDivElement;
const pageInfoDetected = document.getElementById('page-info-detected') as HTMLDivElement;
const pageInfoNotDetected = document.getElementById('page-info-not-detected') as HTMLDivElement;
const pageDocId = document.getElementById('page-doc-id') as HTMLSpanElement;
const pagePageId = document.getElementById('page-page-id') as HTMLSpanElement;
const pageInfoError = document.getElementById('page-info-error') as HTMLSpanElement;

// Export elements
const exportButton = document.getElementById('export-button') as HTMLButtonElement;
const exportButtonText = document.getElementById('export-button-text') as HTMLSpanElement;
const exportButtonLoading = document.getElementById('export-button-loading') as HTMLSpanElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;
const copyButtonText = document.getElementById('copy-button-text') as HTMLSpanElement;
const copyButtonLoading = document.getElementById('copy-button-loading') as HTMLSpanElement;
const exportProgressSection = document.getElementById('export-progress-section') as HTMLDivElement;
const exportProgressTitle = document.getElementById('export-progress-title') as HTMLElement;
const exportProgressMessage = document.getElementById('export-progress-message') as HTMLSpanElement;

// Store current page info for export
let currentPageInfo: CodaPageIdentifier | null = null;

/**
 * Show message to user
 */
function showMessage(message: string, type: 'success' | 'error' | 'info'): void {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  messageContainer.innerHTML = '';
  messageContainer.appendChild(alertDiv);

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      messageContainer.innerHTML = '';
    }, 3000);
  }
}

/**
 * Set loading state for save button
 */
function setLoading(isLoading: boolean): void {
  saveButton.disabled = isLoading;
  if (isLoading) {
    saveButtonText.classList.add('hidden');
    saveButtonLoading.classList.remove('hidden');
  } else {
    saveButtonText.classList.remove('hidden');
    saveButtonLoading.classList.add('hidden');
  }
}

/**
 * Set export button loading state
 */
function setExportLoading(isLoading: boolean): void {
  exportButton.disabled = isLoading;
  copyButton.disabled = isLoading;
  if (isLoading) {
    exportButtonText.classList.add('hidden');
    exportButtonLoading.classList.remove('hidden');
  } else {
    exportButtonText.classList.remove('hidden');
    exportButtonLoading.classList.add('hidden');
  }
}

/**
 * Set copy button loading state
 */
function setCopyLoading(isLoading: boolean): void {
  copyButton.disabled = isLoading;
  exportButton.disabled = isLoading;
  if (isLoading) {
    copyButtonText.classList.add('hidden');
    copyButtonLoading.classList.remove('hidden');
  } else {
    copyButtonText.classList.remove('hidden');
    copyButtonLoading.classList.add('hidden');
  }
}

/**
 * Update page info UI
 */
async function updatePageInfo(): Promise<void> {
  pageInfoLoading.classList.remove('hidden');
  pageInfoDetected.classList.add('hidden');
  pageInfoNotDetected.classList.add('hidden');

  const result = await pageDetectionService.getCurrentPageInfo();

  pageInfoLoading.classList.add('hidden');

  if (result.detected && result.pageInfo) {
    currentPageInfo = result.pageInfo;
    pageDocId.textContent = result.pageInfo.docId;
    pagePageId.textContent = result.pageInfo.pageId;
    pageInfoDetected.classList.remove('hidden');
    exportButton.disabled = false;
    copyButton.disabled = false;
  } else {
    currentPageInfo = null;
    exportButton.disabled = true;
    copyButton.disabled = true;
    if (result.error) {
      pageInfoError.textContent = result.error;
    } else {
      pageInfoError.textContent = 'Error detecting page';
    }
    pageInfoNotDetected.classList.remove('hidden');
  }
}

/**
 * Handle copy button click
 */
async function handleCopy(): Promise<void> {
  if (!currentPageInfo) {
    showMessage('No page detected', 'error');
    return;
  }

  setCopyLoading(true);
  exportProgressSection.classList.remove('hidden');
  messageContainer.innerHTML = '';

  try {
    const result = await exportService.exportToClipboard(currentPageInfo, (progress) => {
      // Update progress UI
      exportProgressTitle.textContent = getProgressTitle(progress.state);
      exportProgressMessage.textContent = progress.message;
    });

    if (result.success) {
      showMessage('Markdown copied to clipboard!', 'success');
      exportProgressSection.classList.add('hidden');
    } else {
      showMessage(`Copy failed: ${result.error ?? 'Unknown error'}`, 'error');
      exportProgressSection.classList.add('hidden');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showMessage(`Copy failed: ${errorMessage}`, 'error');
    exportProgressSection.classList.add('hidden');
  } finally {
    setCopyLoading(false);
  }
}

/**
 * Handle export button click
 */
async function handleExport(): Promise<void> {
  if (!currentPageInfo) {
    showMessage('No page detected', 'error');
    return;
  }

  setExportLoading(true);
  exportProgressSection.classList.remove('hidden');
  messageContainer.innerHTML = '';

  try {
    const result = await exportService.exportPage(currentPageInfo, (progress) => {
      // Update progress UI
      exportProgressTitle.textContent = getProgressTitle(progress.state);
      exportProgressMessage.textContent = progress.message;
    });

    if (result.success) {
      showMessage(`File downloaded: ${result.fileName}`, 'success');
      exportProgressSection.classList.add('hidden');
    } else {
      showMessage(`Export failed: ${result.error ?? 'Unknown error'}`, 'error');
      exportProgressSection.classList.add('hidden');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showMessage(`Export failed: ${errorMessage}`, 'error');
    exportProgressSection.classList.add('hidden');
  } finally {
    setExportLoading(false);
  }
}

/**
 * Get progress title from state
 */
function getProgressTitle(state: ExportState): string {
  switch (state) {
    case 'starting':
      return 'Starting Export...';
    case 'exporting':
      return 'Exporting...';
    case 'polling':
      return 'Checking Status...';
    case 'downloading':
      return 'Downloading...';
    case 'complete':
      return 'Complete!';
    case 'failed':
      return 'Failed';
    default:
      return 'Processing...';
  }
}

/**
 * Show the appropriate view based on configuration state
 */
async function updateView(): Promise<void> {
  try {
    const config = await configService.getConfiguration();

    if (config.isConfigured && config.apiKey) {
      // Try to validate current configuration
      const validation = await configService.validateCurrentConfiguration();

      if (validation.isValid && validation.userName) {
        userNameElement.textContent = `Connected as ${validation.userName}`;
        unconfiguredView.classList.add('hidden');
        configuredView.classList.remove('hidden');

        // Detect current page
        await updatePageInfo();
      } else {
        // Configuration exists but is invalid
        showMessage(validation.error ?? 'Configuration is invalid', 'error');
        unconfiguredView.classList.remove('hidden');
        configuredView.classList.add('hidden');
      }
    } else {
      unconfiguredView.classList.remove('hidden');
      configuredView.classList.add('hidden');
    }
  } catch (error) {
    showMessage('Failed to load configuration', 'error');
    unconfiguredView.classList.remove('hidden');
    configuredView.classList.add('hidden');
  }
}

/**
 * Handle save button click
 */
async function handleSave(): Promise<void> {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showMessage('Please enter an API key', 'error');
    return;
  }

  setLoading(true);
  messageContainer.innerHTML = '';

  try {
    const result = await configService.saveApiKey(apiKey);

    if (result.isValid && result.userName) {
      showMessage(`Connected as ${result.userName}`, 'success');
      apiKeyInput.value = '';
      await updateView();
    } else {
      showMessage(result.error ?? 'Failed to save API key', 'error');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showMessage(`Failed to save API key: ${errorMessage}`, 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Handle clear button click
 */
async function handleClear(): Promise<void> {
  if (!confirm('Are you sure you want to remove your API key?')) {
    return;
  }

  try {
    await configService.clearConfiguration();
    showMessage('API key removed', 'success');
    await updateView();
  } catch (error) {
    showMessage('Failed to remove API key', 'error');
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI
  void updateView();

  // Button click handlers
  saveButton.addEventListener('click', () => {
    void handleSave();
  });

  clearButton.addEventListener('click', () => {
    void handleClear();
  });

  exportButton.addEventListener('click', () => {
    void handleExport();
  });

  copyButton.addEventListener('click', () => {
    void handleCopy();
  });

  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      void handleSave();
    }
  });
});
