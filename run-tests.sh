#!/bin/bash

# Script to run tests for NestJS Microservices

echo "========================================="
echo "Running NestJS Microservices Tests"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests for a service
run_service_tests() {
    SERVICE=$1
    echo -e "${YELLOW}Testing $SERVICE...${NC}"
    echo "----------------------------------------"
    
    cd $SERVICE
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm ci
    fi
    
    # Run unit tests
    echo -e "${GREEN}Running unit tests...${NC}"
    npm run test
    UNIT_RESULT=$?
    
    # Run test coverage
    echo -e "${GREEN}Running test coverage...${NC}"
    npm run test:cov
    COV_RESULT=$?
    
    # Run E2E tests (requires services to be running)
    echo -e "${GREEN}Running E2E tests...${NC}"
    npm run test:e2e
    E2E_RESULT=$?
    
    cd ..
    
    # Report results
    echo ""
    echo -e "${YELLOW}Results for $SERVICE:${NC}"
    if [ $UNIT_RESULT -eq 0 ]; then
        echo -e "  Unit Tests: ${GREEN}PASSED${NC}"
    else
        echo -e "  Unit Tests: ${RED}FAILED${NC}"
    fi
    
    if [ $COV_RESULT -eq 0 ]; then
        echo -e "  Coverage: ${GREEN}COMPLETED${NC}"
    else
        echo -e "  Coverage: ${RED}FAILED${NC}"
    fi
    
    if [ $E2E_RESULT -eq 0 ]; then
        echo -e "  E2E Tests: ${GREEN}PASSED${NC}"
    else
        echo -e "  E2E Tests: ${RED}FAILED${NC}"
    fi
    
    echo ""
    return $((UNIT_RESULT + COV_RESULT + E2E_RESULT))
}

# Main execution
TOTAL_RESULT=0

# Test Order Service
run_service_tests "order-service"
TOTAL_RESULT=$((TOTAL_RESULT + $?))

# Test Payment Service
run_service_tests "payment-service"
TOTAL_RESULT=$((TOTAL_RESULT + $?))

# Final report
echo "========================================="
if [ $TOTAL_RESULT -eq 0 ]; then
    echo -e "${GREEN}All tests passed successfully!${NC}"
else
    echo -e "${RED}Some tests failed. Please check the output above.${NC}"
fi
echo "========================================="

exit $TOTAL_RESULT