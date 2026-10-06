#!/usr/bin/env bash
# Bisection script to find which test creates unwanted files/state
# Usage: ./find-polluter.sh <file_or_dir_to_check> <test_pattern>
# Example: ./find-polluter.sh '.git' 'src/**/*.test.ts'

# Exit 0: every selected test succeeded without pollution; 1: polluter found;
# 2: no result (invalid input, selection failure, or incomplete test runs).
set -eo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <file_to_check> <test_pattern>"
  echo "Example: $0 '.git' 'src/**/*.test.ts'"
  exit 2
fi

POLLUTION_CHECK="$1"
TEST_PATTERN="$2"

echo "🔍 Searching for test that creates: $POLLUTION_CHECK"
echo "Test pattern: $TEST_PATTERN"
echo ""

# Get list of test files
if ! TEST_FILES=$(find . -type f -path "./${TEST_PATTERN#./}" | sort); then
  echo "Test selection failed; no tests ran."
  exit 2
fi
if [ -z "$TEST_FILES" ]; then
  echo "No test files matched; no tests ran."
  exit 2
fi
TOTAL=$(printf '%s\n' "$TEST_FILES" | wc -l | tr -d ' ')

echo "Found $TOTAL test files"
echo ""

COUNT=0
FAILED=0
if [ -e "$POLLUTION_CHECK" ]; then
  echo "Pollution already exists before testing; no tests ran."
  exit 2
fi
while IFS= read -r TEST_FILE; do
  COUNT=$((COUNT + 1))

  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # Run the test
  if ! npm test "$TEST_FILE" > /dev/null 2>&1; then
    FAILED=$((FAILED + 1))
    echo "Test run failed: $TEST_FILE"
  fi

  # Check if pollution appeared
  if [ -e "$POLLUTION_CHECK" ]; then
    echo ""
    echo "🎯 FOUND POLLUTER!"
    echo "   Test: $TEST_FILE"
    echo "   Created: $POLLUTION_CHECK"
    echo ""
    echo "Pollution details:"
    ls -la "$POLLUTION_CHECK"
    echo ""
    echo "To investigate:"
    echo "  npm test $TEST_FILE    # Run just this test"
    echo "  cat $TEST_FILE         # Review test code"
    exit 1
  fi
done <<< "$TEST_FILES"

echo ""
if [ "$FAILED" -gt 0 ]; then
  echo "Incomplete: $FAILED test runs failed; no polluter observed."
  exit 2
fi
echo "✅ No polluter found - $COUNT test runs succeeded without pollution."
exit 0
