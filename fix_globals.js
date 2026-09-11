const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const globals = `
let autoDownloadActive = false;
const pool = { 
  query: async () => ({ rows: [] }), 
  connect: async () => ({ query: async () => {}, release: () => {} }) 
};
const telegramSearchCache = new Map();
async function transactionWithRetry(cb) { await cb(await pool.connect()); }
async function saveResultsToDB(query, results, platform) {}
`;

code = code.replace(/import \{ TelegramClient, Api \} from "telegram";/g, globals + '\nimport { TelegramClient, Api } from "telegram";');
fs.writeFileSync('server.ts', code);
