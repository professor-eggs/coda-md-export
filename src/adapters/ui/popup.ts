/**
 * Popup UI script
 * Handles user interactions for API key configuration and export
 */

import { ChromeStorageAdapter } from '../storage/chrome-storage.adapter';
import { CodaApiAdapter } from '../api/coda-api.adapter';
import { BottleneckRateLimiterAdapter } from '../rate-limiter/bottleneck-rate-limiter.adapter';
import { ConfigurationService } from '../../domain/services/configuration.service';
import { PageDetectionService } from '../../domain/services/page-detection.service';
import { ExportService } from '../../domain/services/export.service';
import { PageHierarchyService } from '../../domain/services/page-hierarchy.service';
import { NestedExportService } from '../../domain/services/nested-export.service';
import { CodaPageIdentifier } from '../../domain/models/api.schema';
import { ExportState } from '../../domain/models/export.schema';
import {
  NestedExportSettings,
  NestedExportDepth,
  PageCountResult,
} from '../../domain/models/nested-export.schema';

// Initialize adapters and services
const storage = new ChromeStorageAdapter();
const rateLimiter = new BottleneckRateLimiterAdapter();
const apiClient = new CodaApiAdapter(undefined, rateLimiter);
const configService = new ConfigurationService(storage, apiClient);
const pageDetectionService = new PageDetectionService(apiClient, storage);
const exportService = new ExportService(apiClient, storage);
const hierarchyService = new PageHierarchyService(apiClient, storage);
const nestedExportService = new NestedExportService(apiClient, storage);

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
const exportProgressBarContainer = document.getElementById('export-progress-bar-container') as HTMLDivElement;
const exportProgressBar = document.getElementById('export-progress-bar') as HTMLDivElement;
const exportProgressText = document.getElementById('export-progress-text') as HTMLSpanElement;
const exportProgressPages = document.getElementById('export-progress-pages') as HTMLSpanElement;

// Nested export DOM elements
const includeNestedCheckbox = document.getElementById('include-nested-checkbox') as HTMLInputElement;
const nestedSettings = document.getElementById('nested-settings') as HTMLDivElement;
const depthSelector = document.getElementById('depth-selector') as HTMLSelectElement;
const checkPagesButton = document.getElementById('check-pages-button') as HTMLButtonElement;
const checkPagesText = document.getElementById('check-pages-text') as HTMLSpanElement;
const checkPagesLoading = document.getElementById('check-pages-loading') as HTMLSpanElement;
const pageCountDisplay = document.getElementById('page-count-display') as HTMLDivElement;
const totalPagesCount = document.getElementById('total-pages-count') as HTMLSpanElement;
const pagesByDepth = document.getElementById('pages-by-depth') as HTMLDivElement;

// Store current page info and discovered hierarchy
let currentPageInfo: CodaPageIdentifier | null = null;
let currentPageCount: PageCountResult | null = null;

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
 * Update progress bar
 */
function updateProgressBar(current: number, total: number): void {
  if (total === 0) {
    exportProgressBarContainer.style.display = 'none';
    return;
  }

  exportProgressBarContainer.style.display = 'block';
  const percentage = Math.round((current / total) * 100);
  
  exportProgressBar.style.width = `${percentage}%`;
  exportProgressText.textContent = `${percentage}%`;
  exportProgressPages.textContent = `${current} / ${total} pages`;
}

/**
 * Hide progress bar
 */
function hideProgressBar(): void {
  exportProgressBarContainer.style.display = 'none';
}

/**
 * Handle nested checkbox toggle
 */
function handleNestedCheckboxToggle(): void {
  const isChecked = includeNestedCheckbox.checked;
  if (isChecked) {
    nestedSettings.classList.remove('hidden');
  } else {
    nestedSettings.classList.add('hidden');
    pageCountDisplay.classList.add('hidden');
    currentPageCount = null;
  }

  // Save settings
  void saveNestedSettings();
}

/**
 * Handle check pages button click
 */
async function handleCheckPages(): Promise<void> {
  if (!currentPageInfo) {
    showMessage('No page detected', 'error');
    return;
  }

  checkPagesButton.disabled = true;
  checkPagesText.classList.add('hidden');
  checkPagesLoading.classList.remove('hidden');
  exportButton.disabled = true;
  copyButton.disabled = true;

  try {
    const settings = await getNestedSettings();
    currentPageCount = await hierarchyService.discoverPages(currentPageInfo, settings.depth);

    // Display results
    totalPagesCount.textContent = String(currentPageCount.totalPages);
    
    // Show breakdown by depth
    const depthBreakdown = Object.entries(currentPageCount.byDepth)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([depth, count]) => `Depth ${depth}: ${count} page${count !== 1 ? 's' : ''}`)
      .join(', ');
    pagesByDepth.textContent = depthBreakdown;

    pageCountDisplay.classList.remove('hidden');
    showMessage(`Found ${currentPageCount.totalPages} pages to export`, 'success');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showMessage(`Failed to check pages: ${errorMessage}`, 'error');
  } finally {
    checkPagesButton.disabled = false;
    checkPagesText.classList.remove('hidden');
    checkPagesLoading.classList.add('hidden');
    exportButton.disabled = false;
    copyButton.disabled = false;
  }
}

/**
 * Get current nested export settings
 */
async function getNestedSettings(): Promise<NestedExportSettings> {
  const depthValue = depthSelector.value;
  const depth: NestedExportDepth = depthValue === 'unlimited' ? 'unlimited' : Number(depthValue);

  return {
    includeNested: includeNestedCheckbox.checked,
    depth,
  };
}

/**
 * Save nested settings to storage
 */
async function saveNestedSettings(): Promise<void> {
  try {
    const settings = await getNestedSettings();
    await storage.saveNestedExportSettings(settings);
  } catch (error) {
    console.error('Failed to save nested settings:', error);
  }
}

/**
 * Load nested settings from storage
 */
async function loadNestedSettings(): Promise<void> {
  try {
    const settings = await storage.getNestedExportSettings();
    includeNestedCheckbox.checked = settings.includeNested;
    depthSelector.value = String(settings.depth);

    if (settings.includeNested) {
      nestedSettings.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Failed to load nested settings:', error);
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
  checkPagesButton.disabled = true;
  exportButton.disabled = true;
  exportProgressSection.classList.remove('hidden');
  messageContainer.innerHTML = '';

  try {
    const settings = await getNestedSettings();

    if (settings.includeNested) {
      // Use nested export service
      const result = await nestedExportService.exportNestedPages(
        currentPageInfo,
        settings,
        (progress) => {
          exportProgressTitle.textContent = 'Exporting...';
          exportProgressMessage.textContent = progress.message;
          
          // Update progress bar if we have page counts
          if (progress.totalPages && progress.pagesProcessed !== undefined) {
            updateProgressBar(progress.pagesProcessed, progress.totalPages);
          } else {
            hideProgressBar();
          }
        },
      );

      if (result.failedPages.length > 0) {
        const failedList = result.failedPages
          .map((f) => `- ${f.pageId}: ${f.error}`)
          .join('\n');
        console.warn(`Some pages failed to export:\n${failedList}`);
      }

      await navigator.clipboard.writeText(result.combinedContent);
      showMessage('Markdown copied to clipboard!', 'success');
      hideProgressBar();
      exportProgressSection.classList.add('hidden');
    } else {
      // Single page export
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
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showMessage(`Copy failed: ${errorMessage}`, 'error');
    exportProgressSection.classList.add('hidden');
  } finally {
    setCopyLoading(false);
    checkPagesButton.disabled = false;
    exportButton.disabled = false;
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
  checkPagesButton.disabled = true;
  copyButton.disabled = true;
  exportProgressSection.classList.remove('hidden');
  messageContainer.innerHTML = '';

  try {
    const settings = await getNestedSettings();

    if (settings.includeNested) {
      // Use nested export service
      const result = await nestedExportService.exportNestedPages(
        currentPageInfo,
        settings,
        (progress) => {
          exportProgressTitle.textContent = 'Exporting...';
          exportProgressMessage.textContent = progress.message;
          
          // Update progress bar if we have page counts
          if (progress.totalPages && progress.pagesProcessed !== undefined) {
            updateProgressBar(progress.pagesProcessed, progress.totalPages);
          } else {
            hideProgressBar();
          }
        },
      );

      if (result.failedPages.length > 0) {
        const failedList = result.failedPages
          .map((f) => `- ${f.pageId}: ${f.error}`)
          .join('\n');
        console.warn(`Some pages failed to export:\n${failedList}`);
        showMessage(
          `Export complete with ${result.failedPages.length} failed page(s). Check console for details.`,
          'info',
        );
      } else {
        showMessage(`File downloaded: ${currentPageInfo.pageId}.md`, 'success');
      }

      // Download the file
      const blob = new Blob([result.combinedContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentPageInfo.pageId}.md`;
      a.click();
      URL.revokeObjectURL(url);

      hideProgressBar();
      exportProgressSection.classList.add('hidden');
    } else {
      // Single page export
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
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showMessage(`Export failed: ${errorMessage}`, 'error');
    exportProgressSection.classList.add('hidden');
  } finally {
    setExportLoading(false);
    checkPagesButton.disabled = false;
    copyButton.disabled = false;
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

  // Nested export event listeners
  includeNestedCheckbox.addEventListener('change', () => {
    handleNestedCheckboxToggle();
  });

  depthSelector.addEventListener('change', () => {
    void saveNestedSettings();
    // Reset page count when depth changes
    pageCountDisplay.classList.add('hidden');
    currentPageCount = null;
  });

  checkPagesButton.addEventListener('click', () => {
    void handleCheckPages();
  });

  // Load nested settings
  void loadNestedSettings();
});
