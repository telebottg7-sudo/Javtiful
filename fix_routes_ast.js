const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// We'll replace the messed up fragments manually
code = code.replace(/app\.get\("\/api\/pornstars",[\s\S]*?res\.status\(500\)\.json\(\{ error: "Failed to fetch pornstars" \};\n\s*\}\n\s*\}\);\n/g, 'app.get("/api/pornstars", (req, res) => { res.json({pornstars:[]}); });\n');

code = code.replace(/app\.post\("\/api\/scrape-pornstars",[\s\S]*?res\.status\(500\)\.json\(\{ error: "Failed to fetch pornstars" \};\n\s*\}\n\s*\}\);\n/g, 'app.post("/api/scrape-pornstars", (req, res) => { res.json({results:[]}); });\n');

// It's probably easier to just overwrite server.ts with the backup if it existed.
// Let's use regex to find and replace everything.

fs.writeFileSync('server.ts', code);
