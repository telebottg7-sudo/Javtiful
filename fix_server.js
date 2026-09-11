const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Remove pg import
code = code.replace(/import\s*{\s*Pool\s*}\s*from\s*['"]pg['"];\n/g, '');

// Comment out pool initialization
code = code.replace(/const pool = new Pool\([\s\S]*?\}\);/g, 'const pool = { query: async () => ({ rows: [] }), connect: async () => ({ query: async () => {}, release: () => {} }) };');

fs.writeFileSync('server.ts', code);
console.log("Replaced pool with a dummy object.");
