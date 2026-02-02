#!/bin/bash
# PRD Generator - Clavix-inspired CLEAR-based PRD creation
# Usage: ./scripts/prd-gen.sh [fast|deep] "feature description"

set -e

MODE=${1:-fast}
DESCRIPTION="${2:-}"
PRD_DIR="docs/prd"
DATE=$(date +%Y-%m-%d)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$DESCRIPTION" ]; then
    echo "Usage: $0 [fast|deep] \"feature description\""
    echo ""
    echo "Examples:"
    echo "  $0 fast \"add email verification\""
    echo "  $0 deep \"build real-time notification system\""
    exit 1
fi

# Create PRD directory
mkdir -p "$PRD_DIR"

# Generate filename from description
FILENAME=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
PRD_FILE="$PRD_DIR/${DATE}-${FILENAME}.md"

echo "╔════════════════════════════════════════════════════════╗"
echo "║         CLEAR-Based PRD Generator                      ║"
echo "║         Mode: ${MODE^^}                                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Feature: $DESCRIPTION"
echo "Output: $PRD_FILE"
echo ""

# CLEAR optimization
echo "[CLEAR Optimization]"
echo "  Original: $DESCRIPTION"

# Simple CLEAR enhancement (in real implementation, this would use AI)
CLEAR_DESCRIPTION=$(echo "$DESCRIPTION" | sed 's/^/Implement /; s/$/ with proper error handling, validation, and testing./')
echo "  CLEAR: $CLEAR_DESCRIPTION"
echo ""

# Generate PRD content
cat > "$PRD_FILE" << EOF
# PRD: $(echo "$DESCRIPTION" | sed 's/.*/\u&/')

**Generated:** $(date)  
**Mode:** ${MODE^^}  
**Status:** Draft

## Executive Summary
$(echo "$CLEAR_DESCRIPTION"). This feature enhances the eLink EV charging platform by [add specific benefit].

## Scope

### In Scope
- [Core functionality]
- [Error handling]
- [Basic validation]
- [User feedback]

### Out of Scope (Future)
- [Advanced feature 1]
- [Advanced feature 2]
- [Edge case handling]

## Technical Requirements

### Database Changes
\`\`\`sql
-- Add to schema if needed
-- Example:
-- ALTER TABLE users ADD COLUMN new_field TEXT;
\`\`\`

### API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/feature | JWT | [Description] |
| GET | /api/feature/:id | JWT | [Description] |

### Frontend Changes
- [Page/component changes]
- [UI updates]

## Implementation Tasks

| ID | Task | Priority | Est. Time | Agent | Status |
|----|------|----------|-----------|-------|--------|
EOF

# Generate tasks based on mode
if [ "$MODE" = "deep" ]; then
    cat >> "$PRD_FILE" << EOF
| T1 | Design database schema | High | 1h | Architect | ⏳ |
| T2 | Design API specification | High | 1h | Architect | ⏳ |
| T3 | Implement backend routes | High | 3h | Coder | ⏳ |
| T4 | Implement database layer | High | 2h | Coder | ⏳ |
| T5 | Add validation & error handling | High | 2h | Coder | ⏳ |
| T6 | Implement frontend UI | Med | 4h | Coder | ⏳ |
| T7 | Code review | High | 1h | Reviewer | ⏳ |
| T8 | Integration testing | High | 2h | Tester | ⏳ |
| T9 | Update documentation | Med | 1h | Coder | ⏳ |
EOF
else
    cat >> "$PRD_FILE" << EOF
| T1 | Implement backend | High | 3h | Coder | ⏳ |
| T2 | Implement frontend | Med | 3h | Coder | ⏳ |
| T3 | Test and review | High | 1h | Reviewer | ⏳ |
EOF
fi

cat >> "$PRD_FILE" << EOF

## Acceptance Criteria

- [ ] Feature works as described
- [ ] Error handling is robust
- [ ] Tests pass
- [ ] Documentation updated

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Implementation complexity | Medium | Break into smaller tasks |
| Integration issues | Low | Test early and often |

## References

- memory-bank/projectbrief.md
- memory-bank/systemPatterns.md
- memory-bank/techContext.md

## Notes

<!-- Add implementation notes here -->
EOF

echo -e "${GREEN}✅ PRD Generated!${NC}"
echo ""
echo "File: $PRD_FILE"
echo ""
echo "Next steps:"
echo "  1. Review and edit the PRD"
echo "  2. Update task details"
echo "  3. Spawn agents: ./scripts/spawn-from-prd.sh $PRD_FILE T1"
echo ""
echo "Or edit now:"
echo "  nano $PRD_FILE"
