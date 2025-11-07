#!/bin/bash
# Build WebAssembly modules for Edge-Native Architecture

set -e

echo "🚀 Building WebAssembly modules..."
echo "=================================="

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust first:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "📦 Installing wasm-pack..."
    cargo install wasm-pack
fi

# Build WebAssembly processor
echo "🔨 Building WebAssembly processor..."
cd wasm-processor

# Build for web target
wasm-pack build --target web --out-dir ../public/wasm --dev

echo "✅ WebAssembly modules built successfully!"
echo "📁 Output directory: public/wasm/"

# List generated files
echo "📋 Generated files:"
ls -la ../public/wasm/

echo ""
echo "🎯 Next steps:"
echo "1. The WebAssembly modules are now available in public/wasm/"
echo "2. Import them in your TypeScript code"
echo "3. Initialize with: await init()"
echo "4. Use compression and processing functions"
