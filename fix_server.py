import re

with open('server.ts', 'r') as f:
    code = f.read()

# Remove the block comments I just added
code = code.replace('/*\napp.', 'app.')
code = code.replace('*/\napp.', 'app.')
code = code.replace('/* res.json', 'res.json')
code = code.replace('/*\n', '\n')
code = code.replace('*/\n', '\n')
code = code.replace('/* ', '')
code = code.replace(' */', '')

# Ensure we have valid JS
with open('server.ts', 'w') as f:
    f.write(code)
