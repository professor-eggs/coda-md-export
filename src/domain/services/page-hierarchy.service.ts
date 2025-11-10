/**
 * Page Hierarchy Service - discovers nested pages and builds hierarchy tree
 */

import { ApiClientPort } from '../ports/api-client.port';
import { StoragePort } from '../ports/storage.port';
import { CodaPageIdentifier } from '../models/api.schema';
import {
  PageHierarchyNode,
  PageCountResult,
  NestedExportDepth,
} from '../models/nested-export.schema';

export class PageHierarchyService {
  constructor(
    private readonly apiClient: ApiClientPort,
    private readonly storage: StoragePort
  ) {}

  /**
   * Discover all nested pages starting from a root page
   * @param pageInfo Root page to start from
   * @param maxDepth Maximum depth to traverse (0 = just root, 'unlimited' = no limit)
   * @returns Page count result with hierarchy
   */
  async discoverPages(
    pageInfo: CodaPageIdentifier,
    maxDepth: NestedExportDepth
  ): Promise<PageCountResult> {
    const config = await this.storage.getConfiguration();
    if (!config.isConfigured || !config.apiKey) {
      throw new Error('API key not configured');
    }

    // Track visited pages to prevent infinite loops
    const visited = new Set<string>();

    // Build hierarchy tree
    const hierarchy = await this.buildHierarchy(
      config.apiKey,
      pageInfo.docId,
      pageInfo.pageId,
      0, // Current depth
      '0', // Path
      maxDepth,
      visited
    );

    // Count pages by depth
    const byDepth: Record<string, number> = {};
    let totalPages = 0;
    let maxDepthFound = 0;

    const countPages = (node: PageHierarchyNode) => {
      const depthKey = String(node.depth);
      byDepth[depthKey] = (byDepth[depthKey] || 0) + 1;
      totalPages++;
      maxDepthFound = Math.max(maxDepthFound, node.depth);

      for (const child of node.children) {
        countPages(child);
      }
    };

    countPages(hierarchy);

    return {
      totalPages,
      byDepth,
      hierarchy,
      maxDepth: maxDepthFound,
    };
  }

  /**
   * Recursively build page hierarchy
   */
  private async buildHierarchy(
    apiKey: string,
    docId: string,
    pageId: string,
    currentDepth: number,
    path: string,
    maxDepth: NestedExportDepth,
    visited: Set<string>
  ): Promise<PageHierarchyNode> {
    // Check if we've already visited this page (circular reference protection)
    if (visited.has(pageId)) {
      console.warn(`[PageHierarchyService] Circular reference detected: ${pageId}`);
      // Return node without children to prevent infinite loop
      return {
        pageId,
        docId,
        name: '(Circular Reference)',
        depth: currentDepth,
        path,
        children: [],
      };
    }

    // Mark as visited
    visited.add(pageId);

    // Get page details
    const page = await this.apiClient.getPage(apiKey, docId, pageId);

    // Check if we should stop recursing
    const shouldRecurse =
      maxDepth === 'unlimited' || currentDepth < maxDepth;

    // Build children if we haven't reached max depth
    const children: PageHierarchyNode[] = [];
    if (shouldRecurse && page.children && page.children.length > 0) {
      // Process children in parallel for better performance
      const childPromises = page.children.map((childRef, index) => {
        const childPath = `${path}.${index + 1}`;
        return this.buildHierarchy(
          apiKey,
          docId,
          childRef.id,
          currentDepth + 1,
          childPath,
          maxDepth,
          visited
        );
      });

      const childResults = await Promise.all(childPromises);
      children.push(...childResults);
    }

    return {
      pageId: page.id,
      docId,
      name: page.name,
      depth: currentDepth,
      path,
      children,
    };
  }

  /**
   * Get a flat list of all pages in the hierarchy (breadth-first order)
   * @param hierarchy Root of hierarchy tree
   * @returns Array of pages ordered by depth
   */
  getFlatPageList(hierarchy: PageHierarchyNode): PageHierarchyNode[] {
    const result: PageHierarchyNode[] = [];
    const queue: PageHierarchyNode[] = [hierarchy];

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      // Add children to queue (breadth-first)
      queue.push(...node.children);
    }

    return result;
  }

  /**
   * Get pages grouped by depth level
   * @param hierarchy Root of hierarchy tree
   * @returns Map of depth to pages at that depth
   */
  getPagesByDepth(hierarchy: PageHierarchyNode): Map<number, PageHierarchyNode[]> {
    const result = new Map<number, PageHierarchyNode[]>();

    const traverse = (node: PageHierarchyNode) => {
      const pagesAtDepth = result.get(node.depth) || [];
      pagesAtDepth.push(node);
      result.set(node.depth, pagesAtDepth);

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(hierarchy);

    return result;
  }
}

