# C7-001 Phase 2 Governance Closure Script
# Updates docs/governance/nexcargo-development-state.md

$file = "G:\NexCargo\nexcargov2\docs\governance\nexcargo-development-state.md"
$encoding = [System.Text.UTF8Encoding]::new($false)
$content = [System.IO.File]::ReadAllText($file, $encoding)

Write-Output "File read successfully. Length: $($content.Length)"

# 1. Replace "future workflows." with Phase 2 info appended
# This appears in line 133 (Current Active Module section)
$count = ([regex]::Matches($content, 'future workflows\.')).Count
Write-Output "Found '$count' occurrences of 'future workflows.'"

$phase2Append = " C7-001 Phase 2 (working tree uncommitted): Tracking UI / Driver Experience — 4 shared components, 4 route groups, 1 enhanced page, 2 minimal API wires, 14 new files verified against filesystem. Boundary compliance: PASS. Exclusion scan: PASS. MOD-002 exclusive driver_assignments write ownership preserved per D-7. Next governance gate: SEPARATE HAO decision for next C7 increment."

# Only replace on line 133 context (the long line starting with MOD-002...)
$oldLine133 = "C6 does NOT imply completion of all role-specific dashboards or future workflows."
$newLine133 = "C6 does NOT imply completion of all role-specific dashboards or future workflows." + $phase2Append

# Replace only the LAST occurrence (line 550 area) - no, actually we need ALL occurrences updated
# But we only want to add Phase 2 info where it's relevant. Let's add to ALL three occurrences
# since they all end sections about C6.
$content = $content -replace 'future workflows\.', ($phase2Append.TrimStart(' '))

Write-Output "Replacements made."

# 2. Update Continuity Notes "Next governance action" line
$content = $content -replace 'Next governance actions: \(a\) HAO authorization for C7 \(TRACKING / FLEET / DOCUMENTS / SUPPORT\); \(b\) separate HAO authorization for Wave 5 Increment 1\.', 'Next governance gate: SEPARATE HAO decision for the next C7 increment — NOT implied by Phase 2 closure. Wave 5 Increment 1 remains pending separate authorization.'

# 3. Update "Current Work in Progress" line
$content = $content -replace 'NONE  All Waves 04 complete\. Final Governance-Only Reconciliation completed \(2026-08-31\)\. No implementation work authorized or in progress', 'NONE — Implementation work authorized and verified (C7-001 Phase 2 complete in working tree, uncommitted). Final Governance-Only Reconciliation completed (2026-08-31). No further implementation work authorized until next HAO decision.'

[System.IO.File]::WriteAllText($file, $content, $encoding)
Write-Output "File written. New length: $([System.IO.File]::ReadAllText($file, $encoding).Length)"
