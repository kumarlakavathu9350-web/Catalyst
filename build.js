const fs = require('fs');
const path = require('path');

console.log('Starting build for Catalyst Slate...');

const distDir = path.join(__dirname, 'dist');
const clientDir = path.join(__dirname, 'client');
const distAppDir = path.join(distDir, 'app');

// Clean dist folder
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(distAppDir, { recursive: true });

// Copy all files from client to dist root
fs.cpSync(clientDir, distDir, { recursive: true });

// Also copy to dist/app so both /login.html and /app/login.html work
fs.cpSync(clientDir, distAppDir, { recursive: true });

console.log('✓ Successfully prepared dist/ and dist/app/ directories for Catalyst Slate deployment.');
