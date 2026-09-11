import re

with open('server.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
brace_count = 0

for line in lines:
    if not skip:
        if 'app.get("/api/pornstars"' in line or \
           'app.post("/api/scrape-pornstars"' in line or \
           'app.post("/api/db-videos"' in line or \
           'app.post("/api/clear-db"' in line or \
           'app.get("/api/db-platforms"' in line or \
           'app.get("/api/db-queries"' in line:
            skip = True
            brace_count = 0
    
    if skip:
        brace_count += line.count('{') - line.count('}')
        if brace_count <= 0 and '}' in line:
            skip = False
    else:
        new_lines.append(line)

with open('server.ts', 'w') as f:
    f.writelines(new_lines)

