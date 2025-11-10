/**
 * Manual test script for debugging nested page export
 * Run with: node manual-test.js
 */

const API_KEY = 'cd572c53-46e8-46b9-b175-d92d938cef81';
const DOC_ID = 'cOqEtrkQpb';
const PAGE_ID = 'suWgkz_Z'; // Fuzzy-Matching-Thresholds-Continuous-Improvement

async function getPage(docId, pageId) {
  const url = `https://coda.io/apis/v1/docs/${docId}/pages/${pageId}`;
  console.log(`\n📄 Fetching page: ${pageId}`);
  console.log(`   URL: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    console.error(`❌ Failed to fetch page ${pageId}: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(`   Response: ${text}`);
    return null;
  }

  const data = await response.json();
  console.log(`✅ Page: "${data.name}"`);
  console.log(`   ID: ${data.id}`);
  console.log(`   Type: ${data.contentType}`);
  console.log(`   Children: ${data.children?.length || 0}`);
  
  if (data.children && data.children.length > 0) {
    console.log(`   Child pages:`);
    data.children.forEach((child, idx) => {
      console.log(`     ${idx + 1}. ${child.name} (${child.id})`);
    });
  }

  return data;
}

async function discoverHierarchy(docId, pageId, depth = 0, maxDepth = 10, visited = new Set()) {
  const indent = '  '.repeat(depth);
  
  if (visited.has(pageId)) {
    console.log(`${indent}⚠️  Circular reference detected: ${pageId}`);
    return { pageId, depth, children: [] };
  }
  
  visited.add(pageId);
  
  const page = await getPage(docId, pageId);
  if (!page) {
    return null;
  }

  console.log(`${indent}📊 Depth ${depth}: ${page.name}`);

  const result = {
    pageId: page.id,
    pageName: page.name,
    depth,
    children: [],
  };

  if (depth >= maxDepth) {
    console.log(`${indent}⛔ Max depth ${maxDepth} reached, stopping`);
    return result;
  }

  if (page.children && page.children.length > 0) {
    console.log(`${indent}🔍 Discovering ${page.children.length} children...`);
    
    for (const child of page.children) {
      const childId = child.id;
      console.log(`${indent}  → Processing child: ${child.name} (${childId})`);
      
      const childResult = await discoverHierarchy(docId, childId, depth + 1, maxDepth, visited);
      if (childResult) {
        result.children.push(childResult);
      }
    }
  } else {
    console.log(`${indent}🍃 Leaf node (no children)`);
  }

  return result;
}

function printTree(node, indent = '') {
  console.log(`${indent}├─ ${node.pageName} (depth: ${node.depth})`);
  if (node.children && node.children.length > 0) {
    node.children.forEach((child, idx) => {
      const isLast = idx === node.children.length - 1;
      const newIndent = indent + (isLast ? '   ' : '│  ');
      printTree(child, newIndent);
    });
  }
}

function countPages(node) {
  let count = 1; // Count this node
  if (node.children) {
    node.children.forEach(child => {
      count += countPages(child);
    });
  }
  return count;
}

function getByDepth(node, result = {}) {
  if (!result[node.depth]) {
    result[node.depth] = [];
  }
  result[node.depth].push(node.pageName);
  
  if (node.children) {
    node.children.forEach(child => getByDepth(child, result));
  }
  
  return result;
}

async function listPages(docId) {
  let allPages = [];
  let pageToken = undefined;
  let pageNum = 1;
  
  do {
    const url = new URL(`https://coda.io/apis/v1/docs/${docId}/pages`);
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }
    
    console.log(`\n📋 Fetching page ${pageNum} of results...`);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to list pages: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`   Response: ${text}`);
      return null;
    }

    const data = await response.json();
    allPages = allPages.concat(data.items);
    pageToken = data.nextPageToken;
    pageNum++;
    
  } while (pageToken);
  
  console.log(`\n✅ Found ${allPages.length} total pages\n`);
  
  // Search for fuzzy matching page
  const fuzzyPages = allPages.filter(p => 
    p.name.toLowerCase().includes('fuzzy') || 
    p.name.toLowerCase().includes('matching') ||
    p.name.toLowerCase().includes('threshold')
  );
  
  if (fuzzyPages.length > 0) {
    console.log('🔍 Pages matching "fuzzy/matching/threshold":\n');
    fuzzyPages.forEach((page, idx) => {
      console.log(`${idx + 1}. "${page.name}"`);
      console.log(`   ID: ${page.id}`);
      console.log(`   Browser Link: ${page.browserLink}`);
      console.log(`   Children: ${page.children?.length || 0}`);
      if (page.parent) {
        console.log(`   Parent: ${page.parent.name}`);
      }
      console.log('');
    });
  } else {
    console.log('⚠️  No pages found matching "fuzzy/matching/threshold"');
    console.log('\n📄 Showing first 10 pages for reference:\n');
    allPages.slice(0, 10).forEach((page, idx) => {
      console.log(`${idx + 1}. "${page.name}" (${page.id})`);
      if (page.children && page.children.length > 0) {
        console.log(`   Children: ${page.children.length}`);
      }
    });
  }

  return allPages;
}

async function main() {
  console.log('🧪 Manual Test: Nested Page Discovery');
  console.log('=====================================\n');
  console.log(`Doc ID: ${DOC_ID}`);
  console.log(`Looking for page with URL segment: ${PAGE_ID}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...`);
  console.log('\n');

  try {
    // First, list all pages to find the correct ID
    const pages = await listPages(DOC_ID);
    
    if (!pages || pages.length === 0) {
      console.log('❌ No pages found in document');
      return;
    }

    // Try to find the page by name or URL
    let targetPage = pages.find(p => 
      p.browserLink?.includes('Fuzzy-Matching-Thresholds') ||
      p.name.toLowerCase().includes('fuzzy') ||
      p.name.toLowerCase().includes('matching') ||
      p.id === PAGE_ID
    );

    if (!targetPage) {
      console.log(`\n⚠️  Could not find target page automatically.`);
      console.log(`\n💡 Let's try the first page with children as a test:\n`);
      
      // Find first page with children
      targetPage = pages.find(p => p.children && p.children.length > 0);
      
      if (!targetPage) {
        console.log(`❌ No pages with children found. Cannot test nested export.\n`);
        return;
      }
    }

    console.log(`\n🎯 Found target page: "${targetPage.name}" (${targetPage.id})\n`);
    console.log('🚀 Starting discovery with maxDepth = unlimited...\n');
    const hierarchy = await discoverHierarchy(DOC_ID, targetPage.id, 0, 999);

    if (hierarchy) {
      console.log('\n\n📊 RESULTS');
      console.log('=========\n');
      
      console.log('📋 Full Tree Structure:');
      printTree(hierarchy);
      
      const totalPages = countPages(hierarchy);
      console.log(`\n📈 Total pages discovered: ${totalPages}`);
      
      const byDepth = getByDepth(hierarchy);
      console.log('\n📊 Pages by depth:');
      Object.keys(byDepth).sort((a, b) => Number(a) - Number(b)).forEach(depth => {
        console.log(`  Depth ${depth}: ${byDepth[depth].length} page(s)`);
        byDepth[depth].forEach(pageName => {
          console.log(`    - ${pageName}`);
        });
      });

      console.log('\n\n✅ Discovery complete!');
      console.log('\n💡 If you expected more pages, check:');
      console.log('   1. Are the missing pages actually children of discovered pages?');
      console.log('   2. Do they appear in the "children" array in the API response?');
      console.log('   3. Could there be a circular reference being detected?');
    } else {
      console.log('\n❌ Failed to discover hierarchy');
    }
  } catch (error) {
    console.error('\n❌ Error during discovery:', error);
    console.error(error.stack);
  }
}

main();

