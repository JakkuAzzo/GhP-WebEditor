#!/bin/bash

# Setup script to copy vendor libraries to public directory

echo "Setting up vendor libraries..."

# Create lib directory if it doesn't exist
mkdir -p public/lib

# Copy CodeMirror
echo "Copying CodeMirror..."
cp -r node_modules/codemirror public/lib/

# Copy Marked
echo "Copying Marked..."
cp -r node_modules/marked public/lib/

# Copy Font Awesome
echo "Copying Font Awesome..."
mkdir -p public/lib/fontawesome
cp -r node_modules/@fortawesome/fontawesome-free public/lib/fontawesome/

echo "Setup complete! You can now run 'npm start' or 'npm run electron'"
