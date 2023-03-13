#!/usr/bin/env bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
echo "--- Starting ultraviolet-app-ios build ---"
echo "Installing required build tools..."
npm i -g typescript babel-minify rollup
echo "Installing required build npm modules..."
cd "$SCRIPT_DIR/ultraviolet"
npm i