#!/usr/bin/env node
/**
 * Creates a compatibility shim so ajv-keywords@5 can find ajv@8's codegen module.
 *
 * Problem: ajv-keywords@5 requires ajv@^8 (needs ajv/dist/compile/codegen),
 * but react-scripts/webpack toolchain installs ajv@6 at the top level.
 * ajv@8 exists nested inside several webpack plugins' node_modules.
 *
 * Fix: Find any ajv@8 in nested node_modules and create a shim at the
 * top-level ajv/dist/compile/codegen so ajv-keywords@5 can resolve it.
 */

const fs = require('fs');
const path = require('path');

const frontendNodeModules = path.join(__dirname, '..', 'frontend', 'node_modules');

// Possible locations where ajv@8 may be nested
const ajv8Candidates = [
  path.join(frontendNodeModules, 'terser-webpack-plugin', 'node_modules', 'ajv'),
  path.join(frontendNodeModules, '@pmmmwh', 'react-refresh-webpack-plugin', 'node_modules', 'ajv'),
  path.join(frontendNodeModules, 'css-minimizer-webpack-plugin', 'node_modules', 'ajv'),
  path.join(frontendNodeModules, 'eslint-webpack-plugin', 'node_modules', 'ajv'),
];

function getAjvVersion(dir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return null;
  }
}

function isAjv8(dir) {
  const v = getAjvVersion(dir);
  return v && v.startsWith('8.');
}

// Find a valid ajv@8 location
const ajv8Dir = ajv8Candidates.find(isAjv8);

if (!ajv8Dir) {
  console.error('ajv-shim: Could not find ajv@8 in any nested location. Listing candidates:');
  ajv8Candidates.forEach(c => {
    console.error(`  ${c} → version: ${getAjvVersion(c) || 'NOT FOUND'}`);
  });
  process.exit(1);
}

console.log(`ajv-shim: Found ajv@${getAjvVersion(ajv8Dir)} at ${ajv8Dir}`);

// Create the shim directory
const shimDir = path.join(frontendNodeModules, 'ajv', 'dist', 'compile');
fs.mkdirSync(shimDir, { recursive: true });

// Write the shim file
const shimFile = path.join(shimDir, 'codegen.js');
const shimContent = `// Auto-generated shim: ajv-keywords@5 compatibility with top-level ajv@6
// Routes require('ajv/dist/compile/codegen') to the nested ajv@8 installation.
module.exports = require(${JSON.stringify(path.join(ajv8Dir, 'dist', 'compile', 'codegen'))});
`;
fs.writeFileSync(shimFile, shimContent);
console.log(`ajv-shim: Shim written to ${shimFile}`);

// Verify the shim works
try {
  require(shimFile);
  console.log('ajv-shim: Verification OK ✓');
} catch (e) {
  console.error('ajv-shim: Verification FAILED:', e.message);
  process.exit(1);
}
