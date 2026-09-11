const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const wipeRoute = (routeSignature) => {
  const startIdx = code.indexOf(routeSignature);
  if (startIdx === -1) return;
  let braceCount = 0;
  let endIdx = -1;
  let foundFirst = false;
  
  for (let i = startIdx; i < code.length; i++) {
    if (code[i] === '{') {
      braceCount++;
      foundFirst = true;
    }
    if (code[i] === '}') {
      braceCount--;
      if (foundFirst && braceCount === 0) {
        endIdx = i + 2; // include closing parenthesis and semicolon
        break;
      }
    }
  }
  
  if (endIdx !== -1) {
    code = code.substring(0, startIdx) + routeSignature.replace(/, async.*/, ', (req, res) => { res.json({ success: true, results: [], pornstars: [], platforms: [], queries: [] }); });\n') + code.substring(endIdx);
  }
}

// First, I will fix my mess. Let's just remove the bad lines
code = code.replace(/app\.get\("\/api\/pornstars"[\s\S]*?\}\);\n/g, '');
code = code.replace(/app\.post\("\/api\/scrape-pornstars"[\s\S]*?\}\);\n/g, '');
code = code.replace(/app\.post\("\/api\/db-videos"[\s\S]*?\}\);\n/g, '');
code = code.replace(/app\.post\("\/api\/clear-db"[\s\S]*?\}\);\n/g, '');
code = code.replace(/app\.get\("\/api\/db-platforms"[\s\S]*?\}\);\n/g, '');
code = code.replace(/app\.get\("\/api\/db-queries"[\s\S]*?\}\);\n/g, '');

fs.writeFileSync('server.ts', code);
