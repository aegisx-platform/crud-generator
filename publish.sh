#!/bin/bash

# Publish script for @aegisx/crud-generator
# Usage: ./publish.sh <otp-code>

if [ -z "$1" ]; then
  echo "❌ Error: OTP code required"
  echo "Usage: ./publish.sh <otp-code>"
  echo ""
  echo "Get OTP from your authenticator app and run:"
  echo "  ./publish.sh 123456"
  exit 1
fi

OTP=$1

echo "📦 Publishing @aegisx/crud-generator to npm..."
echo ""

# Publish to npm with OTP
npm publish --access public --otp="$OTP"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Successfully published to npm!"
  echo "🔗 View at: https://www.npmjs.com/package/@aegisx/crud-generator"
  echo ""
  echo "📋 Next steps:"
  echo "  1. Sync to standalone repo: ./sync-to-repo.sh main"
  echo "  2. Create GitHub release"
  echo "  3. Update CHANGELOG.md"
else
  echo ""
  echo "❌ Failed to publish"
  exit 1
fi
