# ============================================
# SETUP B: ANTIGRAVITY + OPENCODE + OPENROUTER
# (Credit-Saving Mode - Qwen 3.7 Flash)
# ============================================

# 1. Force OpenRouter Caching (THE MISSING PIECE)
#    Adding "openrouter-prompt-caching": "true" explicitly forces OpenRouter
#    to cache your 454k context. This drops the cost from ~$0.20/M to ~$0.003/M
#    for repeated reads (90%+ discount).
$env:OPENROUTER_HEADERS = '{"HTTP-Referer": "http://localhost", "X-Title": "Antigravity-CLI", "OpenRouter-Provider": "deepinfra", "session_id": "my-opencode-session", "openrouter-prompt-caching": "true"}'

# 2. Stricter Cost Cap (Lower = Safer)
#    Set to $0.45 instead of $0.50 to force the agent to pause sooner.
$env:OPENCODE_MAX_COST = "0.45"

# 3. IMPORTANT: Unset any local LM Studio variables to prevent conflicts
#    (If they were set earlier in this session, remove them)
Remove-Item Env:ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:ANTHROPIC_AUTH_TOKEN -ErrorAction SilentlyContinue

Write-Host "✅ OpenRouter Credit-Saver mode ACTIVE" -ForegroundColor Green