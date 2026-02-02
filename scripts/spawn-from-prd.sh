#!/bin/bash
# Spawn agent from PRD task
# Usage: ./scripts/spawn-from-prd.sh <prd-file> <task-id>

PRD_FILE=$1
TASK_ID=$2

if [ -z "$PRD_FILE" ] || [ -z "$TASK_ID" ]; then
    echo "Usage: $0 <prd-file> <task-id>"
    echo ""
    echo "Example:"
    echo "  $0 docs/prd/2026-02-02-email-verification.md T2"
    exit 1
fi

if [ ! -f "$PRD_FILE" ]; then
    echo "Error: PRD file not found: $PRD_FILE"
    exit 1
fi

# Extract task details from PRD
TASK_LINE=$(grep "^| $TASK_ID |" "$PRD_FILE" || echo "")

if [ -z "$TASK_LINE" ]; then
    echo "Error: Task $TASK_ID not found in PRD"
    echo ""
    echo "Available tasks:"
    grep "^| T" "$PRD_FILE" | cut -d'|' -f2,3
    exit 1
fi

# Parse task details
# Format: | ID | Task | Priority | Est. Time | Agent | Status |
TASK_NAME=$(echo "$TASK_LINE" | cut -d'|' -f3 | xargs)
PRIORITY=$(echo "$TASK_LINE" | cut -d'|' -f4 | xargs)
EST_TIME=$(echo "$TASK_LINE" | cut -d'|' -f5 | xargs)
AGENT_TYPE=$(echo "$TASK_LINE" | cut -d'|' -f6 | xargs)

echo "╔════════════════════════════════════════════════════════╗"
echo "║         Spawn Agent from PRD Task                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "PRD: $PRD_FILE"
echo "Task: $TASK_ID - $TASK_NAME"
echo "Priority: $PRIORITY | Est: $EST_TIME | Type: $AGENT_TYPE"
echo ""

# Generate agent label
FEATURE=$(basename "$PRD_FILE" .md | sed 's/^[0-9-]*//' | tr '-' '_')
LABEL="elink-${AGENT_TYPE}-${FEATURE}-${TASK_ID}"

echo "Agent Label: $LABEL"
echo ""

# Generate prompt based on agent type
case "$AGENT_TYPE" in
    Architect)
        PROMPT="You are the Architect for eLink.

Task: $TASK_NAME
From PRD: $PRD_FILE

Design this feature following eLink patterns:
1. Read memory-bank/projectbrief.md for context
2. Read memory-bank/systemPatterns.md for architecture
3. Design the solution (NO CODE)
4. Document in PRD format

Output:
- Database schema changes (if any)
- API design
- Component structure
- Implementation approach"
        ;;
    
    Coder)
        PROMPT="You are the Coder for eLink.

Task: $TASK_NAME
From PRD: $PRD_FILE

Implement this feature:
1. Read the PRD file completely
2. Read relevant code files (database.js, auth.js, routes/)
3. Follow existing code patterns
4. Add error handling
5. Update tests if needed

Commit when complete with descriptive message."
        ;;
    
    Reviewer)
        PROMPT="You are the Code Reviewer for eLink.

Task: $TASK_NAME
From PRD: $PRD_FILE

Review the implementation:
1. Check security (auth, input validation)
2. Check error handling
3. Check code quality
4. Verify against PRD requirements

Output a review report with findings."
        ;;
    
    Tester)
        PROMPT="You are the Tester for eLink.

Task: $TASK_NAME
From PRD: $PRD_FILE

Test the implementation:
1. Happy path testing
2. Edge case testing
3. Error scenario testing
4. Integration testing

Provide test report with pass/fail for each case."
        ;;
    
    *)
        PROMPT="You are working on eLink.

Task: $TASK_NAME
From PRD: $PRD_FILE

Complete this task following eLink best practices.
Refer to memory-bank/ for context."
        ;;
esac

echo "Generated Prompt:"
echo "---"
echo "$PROMPT"
echo "---"
echo ""

# In actual implementation, this would call the OpenClaw spawn API
# For now, output the command
echo "To spawn this agent, run:"
echo ""
echo "/new $LABEL"
echo ""
echo "With prompt:"
echo "$PROMPT"
