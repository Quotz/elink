#!/bin/bash
# eLink v2.0 Integration Test

BASE_URL="http://localhost:3000"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "╔════════════════════════════════════════════╗"
echo "║        eLink v2.0 Integration Test         ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Track results
PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected=$5
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if echo "$body" | grep -q "$expected"; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "  Expected: $expected"
        echo "  Got: $body"
        ((FAILED++))
        return 1
    fi
}

# Test 1: Server health
echo "1. Server Health Check"
test_endpoint "Stations API" "GET" "/api/stations" "" "id"

# Test 2: Auth - Register
echo ""
echo "2. Authentication Tests"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test_v2_$(date +%s)@elink.mk","password":"TestPass123","firstName":"Test","lastName":"User","role":"owner"}')
echo "  Register: $(echo $REGISTER_RESPONSE | grep -o '"message":"[^"]*"')"

if echo "$REGISTER_RESPONSE" | grep -q "accessToken"; then
    echo -e "  ${GREEN}✓ Registration works${NC}"
    ((PASSED++))
    
    # Extract token
    ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    
    # Test 3: Get current user
    echo ""
    echo "3. Protected Route Tests"
    test_endpoint "Get current user" "GET" "/api/auth/me" "" "user" "Authorization: Bearer $ACCESS_TOKEN"
else
    echo -e "  ${RED}✗ Registration failed${NC}"
    ((FAILED++))
fi

# Test 4: Login
echo ""
echo "4. Login Test"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@elink.mk","password":"TestPass123"}')

if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
    echo -e "  ${GREEN}✓ Login works${NC}"
    ((PASSED++))
else
    echo -e "  ${YELLOW}⚠ Login (user may not exist)${NC}"
fi

# Test 5: Verification endpoints (without auth)
echo ""
echo "5. Verification API Tests"
test_endpoint "Become owner (no auth)" "POST" "/api/verification/become-owner" "" "Authentication required"

# Summary
echo ""
echo "═══════════════════════════════════════════════"
echo "Test Results: $PASSED passed, $FAILED failed"
echo "═══════════════════════════════════════════════"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
