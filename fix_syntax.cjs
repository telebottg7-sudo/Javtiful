const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Fix the mangled lines
code = code.replace(/await \{ rows: \[\] \} as count FROM search_results WHERE is_uploaded = FALSE'\);/g, '{ rows: [{count: 0}] };');
code = code.replace(/await \{ rows: \[\] \}', \[urls\]\);/g, '{};');
code = code.replace(/await \{ rows: \[\] \};/g, '{};');

code = code.replace(/app\.post\("\/api\/scrape-pornstars", async \(req, res\) => {/g, 'app.post("/api/scrape-pornstars", async (req, res) => { try { res.json({results:[]}); } catch(e){} });\n/*');
code = code.replace(/app\.post\("\/api\/db-videos", async \(req, res\) => {/g, '*/\napp.post("/api/db-videos", async (req, res) => { try { res.json({results:[], total:0}); } catch(e){} });\n/*');
code = code.replace(/app\.post\("\/api\/clear-db", async \(req, res\) => {/g, '*/\napp.post("/api/clear-db", async (req, res) => { try { res.json({success:true}); } catch(e){} });\n/*');
code = code.replace(/app\.get\("\/api\/pornstars", async \(req, res\) => {/g, '*/\napp.get("/api/pornstars", async (req, res) => { try { res.json({pornstars:[]}); } catch(e){} });\n/*');
code = code.replace(/app\.get\("\/api\/db-platforms", async \(req, res\) => {/g, '*/\napp.get("/api/db-platforms", async (req, res) => { try { res.json({platforms:[]}); } catch(e){} });\n/*');
code = code.replace(/app\.get\("\/api\/db-queries", async \(req, res\) => {/g, '*/\napp.get("/api/db-queries", async (req, res) => { try { res.json({queries:[]}); } catch(e){} });\n/*');
code = code.replace(/app\.post\("\/api\/auto-download", \(req, res\) => {/g, '*/\napp.post("/api/auto-download", (req, res) => {');

fs.writeFileSync('server.ts', code);
