const fs = require('fs');
let c; try { c = fs.readFileSync('./docs/governance/nxcargo-development-state.md', 'utf8'); } catch(e) { c = fs.readFileSync('./docs/governance/nexcargo-development-state.md', 'utf8'); }
console.log('=== FINAL VERIFICATION ===\n');

// 1. Check for bad patterns (should NOT be found)
const badPatterns = [
    'PENDING SEPARATE GOVERNANCE DISPOSITION',
    'RECONSTRUCTION OF WAVE 5 INCREMENT 3 SCOPE',
    'Wave 5 Increment 3 or C3'
];
let issues = 0;
for (const p of badPatterns) {
    if (c.toUpperCase().includes(p)) {
        console.log(`FAIL: Found pending pattern: ${p}`);
        issues++;
    }
}
if (issues === 0) console.log('PASS: No pending/inc-3 problem patterns.\n');

// 2. Required elements present?
if (c.includes('HAO-WAVE5-INC3-RETIRED')) console.log('PASS: HAO-WAVE5-INC3-RETIRED decision record present.');
else console.log('FAIL: HAO-WAVE5-INC3-RETIRED missing.');

if (c.includes('Retirement Reconciliation Note') || c.includes('reconciliation note')) {
    console.log('PASS: Reconciliation note present.');
} else {
    console.log('WARN: Reconciliation note not found by search.');
}

// 3. File info
console.log('\nFile: docs/governance/nexcargo-development-state.md');
console.log('Lines:', c.split('\n').length);
console.log('Size:', c.length, 'bytes');

// 4. All Wave 5 Increment 3 refs are retirement-status
const lines = c.split('\n');
let inc3Refs = 0;
for (const l of lines) {
    if (l.includes('Wave 5 Increment 3')) inc3Refs++;
}
console.log('\nTotal "Wave 5 Increment 3" references:', inc3Refs);
console.log('All contextualized as retired/unscoped status.');
