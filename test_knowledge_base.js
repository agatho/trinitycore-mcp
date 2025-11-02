/**
 * Quick test script for Phase 5 knowledge base tools
 * Run with: node dist/test_knowledge_base.js
 */

const { searchPlayerbotWiki, listDocumentationCategories, getPlayerbotPattern } = require('./dist/tools/knowledge.js');

async function testKnowledgeBase() {
  console.log('=== Testing Phase 5 Knowledge Base Tools ===\n');

  try {
    // Test 1: List documentation categories
    console.log('Test 1: Listing documentation categories...');
    const categories = await listDocumentationCategories();
    console.log(`Found ${categories.totalDocuments} total documents`);
    console.log(`Categories: ${categories.categories.map(c => c.name).join(', ')}`);
    console.log(`Retrieval time: ${categories.retrievalTime.toFixed(2)}ms\n`);

    // Test 2: Search for "combat"
    console.log('Test 2: Searching for "combat"...');
    const searchResults = await searchPlayerbotWiki('combat', { limit: 3 });
    console.log(`Found ${searchResults.totalResults} results in ${searchResults.searchTime.toFixed(2)}ms`);
    for (const result of searchResults.results) {
      console.log(`  - ${result.document.title} (${result.document.category}, score: ${result.score.toFixed(2)})`);
    }
    console.log('');

    // Test 3: Get a specific pattern
    console.log('Test 3: Getting combat AI strategy pattern...');
    const pattern = await getPlayerbotPattern('patterns/combat/01_combat_ai_strategy');
    if (pattern) {
      console.log(`Pattern: ${pattern.title}`);
      console.log(`Difficulty: ${pattern.difficulty}`);
      console.log(`Tags: ${pattern.tags.join(', ')}`);
      console.log(`Code examples: ${pattern.codeExamples.length}`);
    } else {
      console.log('Pattern not found');
    }
    console.log('');

    // Test 4: Search for "getting started"
    console.log('Test 4: Searching for "getting started"...');
    const gettingStarted = await searchPlayerbotWiki('getting started', { category: 'getting_started' });
    console.log(`Found ${gettingStarted.totalResults} getting_started docs in ${gettingStarted.searchTime.toFixed(2)}ms`);
    for (const result of gettingStarted.results) {
      console.log(`  - ${result.document.title}`);
    }

    console.log('\n=== All tests passed! ===');

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testKnowledgeBase();
