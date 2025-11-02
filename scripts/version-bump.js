#!/usr/bin/env node
/**
 * Version Bump Script
 * Automatically bumps version in package.json and updates README.md
 * 
 * Usage:
 *   node scripts/version-bump.js [major|minor|patch]
 */

const fs = require('fs');
const path = require('path');

// Get bump type from command line
const bumpType = process.argv[2] || 'patch';
const validTypes = ['major', 'minor', 'patch'];

if (!validTypes.includes(bumpType)) {
  console.error(`❌ Invalid bump type: ${bumpType}`);
  console.error(`   Valid types: ${validTypes.join(', ')}`);
  process.exit(1);
}

// Read package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Parse current version
const [major, minor, patch] = packageJson.version.split('.').map(Number);

// Calculate new version
let newVersion;
if (bumpType === 'major') {
  newVersion = `${major + 1}.0.0`;
} else if (bumpType === 'minor') {
  newVersion = `${major}.${minor + 1}.0`;
} else {
  newVersion = `${major}.${minor}.${patch + 1}`;
}

console.log(`📦 Bumping version: ${packageJson.version} → ${newVersion} (${bumpType})`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
console.log(`✅ Updated package.json to ${newVersion}`);

// Update README.md
const readmePath = path.join(__dirname, '..', 'README.md');
let readme = fs.readFileSync(readmePath, 'utf8');

// Update version badge
const oldVersion = `${major}.${minor}.${patch}`;
readme = readme.replace(
  new RegExp(`version-${oldVersion.replace(/\./g, '\.')}-blue`, 'g'),
  `version-${newVersion}-blue`
);

fs.writeFileSync(readmePath, readme);
console.log(`✅ Updated README.md badge to ${newVersion}`);

console.log('');
console.log('📝 Next steps:');
console.log(`   1. Review changes: git diff`);
console.log(`   2. Commit: git add package.json README.md && git commit -m "chore: bump version to ${newVersion}"`);
console.log(`   3. Tag: git tag v${newVersion}`);
console.log(`   4. Push: git push && git push --tags`);
