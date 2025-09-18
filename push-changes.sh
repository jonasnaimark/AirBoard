#!/bin/bash
echo "🚀 Pushing AirBoard changes to GitHub..."

# Check if there are changes to commit
if [ -z "$(git status --porcelain)" ]; then
    echo "❌ No changes to commit"
    exit 1
fi

# Show current changes
echo "📝 Changes to commit:"
git status --short

# Add all changes
git add .

# Check if commit message was provided
if [ -z "$1" ]; then
    echo "❌ Please provide a commit message"
    echo "Usage: ./push-changes.sh \"Your commit message\""
    exit 1
fi

# Commit with provided message
git commit -m "$1"

# Push to main branch
git push origin main

echo "✅ Successfully pushed changes to GitHub!"