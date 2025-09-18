#!/bin/bash
echo "🚀 Syncing AirBoard to development environment..."

# Source directory
SOURCE_DIR="/Users/jonas_naimark/Documents/airboard-plugin"

# Development extension directory  
DEV_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/airboard-dev"

# Create the symlink if it doesn't exist
if [ ! -L "$DEV_DIR" ]; then
    echo "Creating development symlink..."
    ln -sf "$SOURCE_DIR" "$DEV_DIR"
fi

echo "✅ Development environment ready!"
echo "📁 Extension linked to: $DEV_DIR"
echo ""
echo "🔄 To test changes:"
echo "1. Make your code changes"
echo "2. Restart After Effects"
echo "3. Look for 'AirBoard' in Window > Extensions menu"
echo ""
echo "💡 No ZXP building needed during development!"