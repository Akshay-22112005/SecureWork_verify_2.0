/**
 * Automated Foundation Verification Script
 * Validates file structure, security boundaries, and runs a health probe against the backend.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const rootDir = path.resolve(__dirname, '..');

const requiredFiles = [
  'package.json',
  '.gitignore',
  'README.md',
  'PROJECT_RULES.md',
  
  // Backend
  'backend/package.json',
  'backend/.env.example',
  'backend/keys/.gitkeep',
  'backend/storage/documents/.gitkeep',
  'backend/storage/temp/.gitkeep',
  'backend/src/app.js',
  'backend/src/server.js',
  'backend/src/config/env.js',
  'backend/src/config/db.js',
  'backend/src/routes/index.js',
  'backend/src/routes/health.routes.js',
  'backend/src/controllers/health.controller.js',
  'backend/src/services/auth.service.js',
  'backend/src/services/verification.service.js',
  'backend/src/services/credential.service.js',
  
  // Frontend
  'frontend/package.json',
  'frontend/.env.example',
  'frontend/vite.config.js',
  'frontend/index.html',
  'frontend/src/App.jsx',
  'frontend/src/index.css',
  'frontend/src/main.jsx',
  
  // Docs
  'docs/ARCHITECTURE.md',
  'docs/TRUST_MODEL.md',
  'docs/DATABASE.md',
  'docs/API.md',
  'docs/SECURITY.md',
  'docs/CRYPTOGRAPHY.md',
  'docs/VERIFICATION.md',
  'docs/OCR.md',
  'docs/AI_ML.md',
  'docs/OFFICIAL_SOURCE_VERIFICATION.md',
  'docs/AUDIT.md',
  'docs/DEPLOYMENT.md',
  'docs/SCALABILITY.md',
  'docs/TESTING.md',
  'docs/DEMO.md',
  'docs/LIMITATIONS.md'
];

async function verifyFiles() {
  console.log('🔍 [1/3] Verifying Directory & File Presence...');
  let missing = 0;
  for (const relPath of requiredFiles) {
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`  ❌ Missing: ${relPath}`);
      missing++;
    }
  }
  if (missing === 0) {
    console.log(`  ✅ All ${requiredFiles.length} core files and boundaries verified successfully.`);
  } else {
    throw new Error(`Found ${missing} missing files.`);
  }
}

async function verifyBackendHealth() {
  console.log('🔍 [2/3] Verifying Backend In-Memory Lifecycle & Health Check...');
  const app = require('../backend/src/app');
  
  return new Promise((resolve, reject) => {
    const testPort = 5999;
    const server = app.listen(testPort, () => {
      http.get(`http://localhost:${testPort}/api/health`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          server.close(() => {
            try {
              const data = JSON.parse(body);
              if (data.success && data.data.status === 'healthy') {
                console.log(`  ✅ Backend server started and responded 200 OK.`);
                console.log(`  ✅ Health status: "${data.data.status}", uptime: ${data.data.uptime}s, DB: ${data.data.database.status}`);
                resolve();
              } else {
                reject(new Error(`Unexpected response: ${body}`));
              }
            } catch (err) {
              reject(err);
            }
          });
        });
      }).on('error', (err) => {
        server.close();
        reject(err);
      });
    });
  });
}

async function verifyGitIgnore() {
  console.log('🔍 [3/3] Verifying Security .gitignore Configuration...');
  const gitignoreContent = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
  const sensitivePatterns = [
    'backend/keys/*',
    'backend/storage/documents/*',
    '.env',
    'node_modules/'
  ];

  for (const pattern of sensitivePatterns) {
    if (!gitignoreContent.includes(pattern)) {
      throw new Error(`Missing sensitive pattern in .gitignore: ${pattern}`);
    }
  }
  console.log('  ✅ Security exclusion rules verified for keys, documents, env, and node_modules.');
}

async function run() {
  console.log('==================================================');
  console.log(' SecureWork Verify — Foundation Verification Tool ');
  console.log('==================================================\n');

  try {
    await verifyFiles();
    await verifyGitIgnore();
    await verifyBackendHealth();

    console.log('\n==================================================');
    console.log(' 🎉 Phase 0 Verification PASSED! Foundation is Ready.');
    console.log('==================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Verification Failed:', err.message);
    process.exit(1);
  }
}

run();
