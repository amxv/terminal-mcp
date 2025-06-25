#!/bin/bash
set -e

# Clean and create dist directory
rm -rf dist
mkdir -p dist

echo "Building executables..."

# Build for different platforms
bun build ./src/cli.ts --compile --minify --target=bun-darwin-arm64 --outfile dist/mcp-cli-macos-arm64
bun build ./src/cli.ts --compile --minify --target=bun-darwin-x64 --outfile dist/mcp-cli-macos-x64
bun build ./src/cli.ts --compile --minify --target=bun-linux-x64 --outfile dist/mcp-cli-linux-x64
bun build ./src/cli.ts --compile --minify --target=bun-linux-arm64 --outfile dist/mcp-cli-linux-arm64

echo "Creating archives..."

# Create tar.gz archives for distribution
cd dist
tar -czf mcp-cli-macos-arm64.tar.gz mcp-cli-macos-arm64
tar -czf mcp-cli-macos-x64.tar.gz mcp-cli-macos-x64
tar -czf mcp-cli-linux-x64.tar.gz mcp-cli-linux-x64
tar -czf mcp-cli-linux-arm64.tar.gz mcp-cli-linux-arm64

echo "Build complete! Files ready for distribution:"
ls -lh *.tar.gz