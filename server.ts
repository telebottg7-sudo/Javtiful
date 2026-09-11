import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import { tmpdir } from "os";
import youtubedl from "youtube-dl-exec";

let autoDownloadActive = false;
const pool = { 
  query: async () => ({ rows: [] }), 
  connect: async () => ({ query: async () => {}, release: () => {} }) 
};
const telegramSearchCache = new Map();
async function transactionWithRetry(cb) { await cb(await pool.connect()); }
async function saveResultsToDB(query, results, platform) {}

import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { CustomFile } from "telegram/client/uploads.js";
import ffmpeg from "fluent-ffmpeg";

async function harvestVideoDetails(url: string) {
  const details: any = {};
  try {

    // 3. Always fetch HTML to get downloads and fallback metadata
    const headers: any = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    
    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    if (!details.title) details.title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    if (!details.description) {
      details.description = $('meta[property="og:description"]').attr('content') ||
                            $('meta[name="description"]').attr('content') ||
                            $('p').first().text().trim();
    }
    if (!details.author) {
      details.author = $('meta[name="author"]').attr('content') ||
                       $('meta[property="article:author"]').attr('content') ||
                       $('[class*="author"], [class*="user"], [rel="author"]').first().text().trim();
    }
    if (!details.date) {
      details.date = $('meta[property="article:published_time"]').attr('content') ||
                     $('time').attr('datetime') ||
                     $('time').text().trim();
    }
    if (!details.tags || details.tags.length === 0) {
      const tags: string[] = [];
      $('meta[property="article:tag"]').each((_, el) => {
        const tag = $(el).attr('content');
        if (tag) tags.push(tag);
      });
      if (tags.length === 0) {
        $('[class*="tag"] a, [class*="category"] a').each((_, el) => {
          const tag = $(el).text().trim();
          if (tag) tags.push(tag);
        });
      }
      details.tags = [...new Set(tags)].filter(Boolean);
    }
    if (!details.views) {
      const viewsText = $('[class*="view"]').text();
      const viewsMatch = viewsText.match(/([\d,]+)\s*views?/i);
      if (viewsMatch) details.views = viewsMatch[1];
    }
    
    const head = $('head');
    if (!details.thumbnail) details.thumbnail = head.find('meta[property="og:image"]').attr('content') || null;
    if (!details.fallback_thumbnail) details.fallback_thumbnail = head.find('meta[name="twitter:image"]').attr('content') || null;
    
    if (!details.previewImage) {
      let previewImage = details.thumbnail || details.fallback_thumbnail ||
                         head.find('meta[itemprop="image"]').attr('content') ||
                         $('article img').first().attr('src') ||
                         $('main img').first().attr('src');
      
      if (previewImage && !previewImage.startsWith('data:image')) {
        try {
          details.previewImage = new URL(previewImage, url).href;
        } catch (e) {}
      }
    }

    // Downloads Extraction
    const downloads: { quality: string; url: string }[] = [];
    $('#downloaddiv u').each((_, el) => {
      const quality = $(el).text().replace(':', '').trim();
      const link = $(el).next('span').find('a').attr('href') || $(el).next().find('a').attr('href');
      if (quality && link) {
        try {
          downloads.push({ quality, url: new URL(link, url).href });
        } catch (e) {
          downloads.push({ quality, url: link });
        }
      }
    });

    if (downloads.length > 0) details.downloads = downloads;

    // Pornstars Extraction
    const extractedPornstars: any[] = [];
    $(".models a, .model a, .pornstar a, [href*='/pornstar/'], [href*='/model/']").each((_, el) => {
      const name = $(el).text().trim() || $(el).attr('title');
      const linkAttr = $(el).attr('href');
      if (name && linkAttr) {
         let linkUrl = linkAttr;
         if (!linkUrl.startsWith('http')) {
            try { linkUrl = new URL(linkUrl, url).href; } catch(e) { return; }
         }
         let platform = url.includes('javtiful.com') ? 'javtiful' : 'unknown';
         extractedPornstars.push({ name, url: linkUrl, thumbnail: '', platform });
      }
    });
    details.pornstars = Array.from(new Map(extractedPornstars.map(item => [item.url, item])).values());

    return details;
  } catch (error) {
    console.error("Error in harvestVideoDetails:", error);
    return details;
  }
}

let globalBot: TelegramBot | null = null;

function getVideoMetadata(filePath: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata) return resolve({ duration: 0, width: 0, height: 0 });
      const stream = metadata.streams && metadata.streams.find((s: any) => s.codec_type === 'video');
      const durationVal = stream?.duration || metadata?.format?.duration || 0;
      resolve({
        duration: Math.round(Number(durationVal)),
        width: stream?.width || 0,
        height: stream?.height || 0,
      });
    });
  });
}

function getProgressBar(percent: number, totalCols: number = 15) {
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round((p / 100) * totalCols);
  const empty = totalCols - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

let gramClient: TelegramClient | null = null;

async function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const apiId = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
  const apiHash = process.env.TELEGRAM_API_HASH;
  
  if (apiId && apiHash) {
    try {
      let sessionStr = "";
      const sessionPath = path.join(process.cwd(), ".gram_session");
      if (fs.existsSync(sessionPath)) {
        sessionStr = fs.readFileSync(sessionPath, "utf-8");
      }
      
      gramClient = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, { connectionRetries: 5 });
      await gramClient.start({
        botAuthToken: token,
      });
      fs.writeFileSync(sessionPath, gramClient.session.save() as unknown as string);
      {};
    } catch (e) {
      console.error("Failed to connect GramJS client", e);
      gramClient = null;
    }
  }

  {};
  const bot = new TelegramBot(token, { polling: true });
  globalBot = bot;

  // Handle polling errors to prevent EFATAL crashes
  bot.on('polling_error', (error: any) => {
    // ECONNRESET is common and usually transient, we log it but let the library handle reconnects
    if (error.code === 'ECONNRESET' || error.message?.includes('ECONNRESET')) {
      console.warn('Telegram Bot Polling: Connection reset by peer. Reconnecting...');
    } else {
      console.error('Telegram Bot Polling Error:', error.message || error);
    }
  });

  bot.on('error', (error: any) => {
    console.error('Telegram Bot Error:', error.message || error);
  });

  bot.onText(/\/autodl/, async (msg) => {
    const chatId = msg.chat.id;
    autoDownloadActive = !autoDownloadActive;
    if (autoDownloadActive) {
      autoDownloadLoop();
      bot.sendMessage(chatId, "✅ <b>Auto Download started!</b>\n\nI will now look for new videos in the database and upload them to the channel 5 at a time.\nQuality: 720p", { parse_mode: 'HTML' });
    } else {
      bot.sendMessage(chatId, "🛑 <b>Auto Download stopped.</b>", { parse_mode: 'HTML' });
    }
  });

  bot.onText(/\/queue/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const { rows } = { rows: [{count: 0}] };
      const count = rows[0].count;
      bot.sendMessage(chatId, `📊 <b>Queue Status:</b>\n\nRemaining videos to upload: <b>${count}</b>\nAuto Download: <b>${autoDownloadActive ? 'ON' : 'OFF'}</b>`, { parse_mode: 'HTML' });
    } catch (e) {
      bot.sendMessage(chatId, "Error checking queue.");
    }
  });

  bot.onText(/\/text/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      // 1. Get 10 unsent videos
      let { rows } = {};
      
      // 2. If none found, reset and try again
      if (rows.length === 0) {
        {};
        const retry = {};
        rows = retry.rows;
      }

      if (rows.length === 0) {
        return bot.sendMessage(chatId, "Database is empty.");
      }

      // 3. Mark as sent
      const urls = rows.map(r => r.url);
      {};

      // 4. Format and send
      let response = "<b>10 Video Links:</b>\n\n";
      rows.forEach((r, i) => {
        response += `${i + 1}. <a href="${r.url}">${r.title}</a>\n`;
      });
      
      bot.sendMessage(chatId, response, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch (e) {
      console.error("Error in /text command:", e);
      bot.sendMessage(chatId, "Failed to fetch links from database.");
    }
  });

  bot.onText(/\/cleardb/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      {};
      {};
      bot.sendMessage(chatId, "✅ <b>Database cleared successfully!</b>", { parse_mode: 'HTML' });
    } catch (e) {
      console.error("Error in /cleardb command:", e);
      bot.sendMessage(chatId, "❌ Failed to clear the database.");
    }
  });

  const sendResults = (chatId: number, searchId: string, page: number, messageId?: number) => {
    const searchData = telegramSearchCache.get(searchId);
    if (!searchData) return;

    const perPage = 10;
    const start = page * perPage;
    const end = start + perPage;
    const pageResults = searchData.results.slice(start, end);

    if (pageResults.length === 0) {
      if (!messageId) bot.sendMessage(chatId, "No results found.");
      return;
    }

    const inline_keyboard = pageResults.map((v, index) => ([
      {
        text: v.title.substring(0, 50) + (v.title.length > 50 ? '...' : ''),
        callback_data: `vid|${searchId}|${start + index}`
      }
    ]));

    const navButtons = [];
    if (page > 0) {
      navButtons.push({ text: '⬅️ Prev', callback_data: `nav|${searchId}|${page - 1}` });
    }
    if (end < searchData.results.length) {
      navButtons.push({ text: 'Next ➡️', callback_data: `nav|${searchId}|${page + 1}` });
    }
    if (navButtons.length > 0) {
      inline_keyboard.push(navButtons);
    }

    const text = `Results for "${searchData.query}" (Page ${page + 1}):`;

    if (messageId) {
      bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard }
      }).catch(e => console.error("Telegram edit error:", e.response?.body || e.message));
    } else {
      bot.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard }
      }).catch(e => console.error("Telegram send error:", e.response?.body || e.message));
    }
  };

  bot.onText(/^\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Welcome to the Video Link Extractor Bot! 🎥\n\nCommands:\n/jt <query> - Search Javtiful\n/url <link> - Extract details from URL\n/stats - Display database statistics");
  });

  bot.onText(/^\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const client = await pool.connect();
      try {
        const videosRes = await client.query('SELECT COUNT(*) FROM search_results');
        const pornstarsRes = await client.query('SELECT COUNT(*) FROM pornstars');
        
        const videoCount = videosRes.rows[0].count;
        const pornstarCount = pornstarsRes.rows[0].count;

        bot.sendMessage(chatId, `📊 *Database Statistics*\n\n🎬 Total Videos: ${videoCount}\n⭐ Total Pornstars: ${pornstarCount}`, { parse_mode: 'Markdown' });
      } finally {
        client.release();
      }
    } catch (e) {
      console.error("Telegram Stats Error:", e);
      bot.sendMessage(chatId, "An error occurred while fetching stats.");
    }
  });

  bot.onText(/^\/jt(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match ? match[1].trim() : '';
    if (!query) return bot.sendMessage(chatId, "Please provide a search query. Example: /jt mother");

    bot.sendMessage(chatId, `Searching Javtiful for "${query}"...`);

    try {
      const url = `https://javtiful.com/search?q=${encodeURIComponent(query)}&page=1`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
      });
      const $ = cheerio.load(response.data);
      const results: any[] = [];
      
      $('.front-video-card').each((_, el) => {
        const title = $(el).find('.front-video-title').text().trim();
        const linkAttr = $(el).find('.front-video-title').attr('href');
        const link = linkAttr ? (linkAttr.startsWith('http') ? linkAttr : `https://javtiful.com${linkAttr.startsWith('/') ? linkAttr : '/' + linkAttr}`) : null;
        let thumbnail = $(el).find('.front-video-thumb img').attr('data-front-lazy-src') || $(el).find('.front-video-thumb img').attr('src');
        if (thumbnail && thumbnail.startsWith('/')) thumbnail = 'https://javtiful.com' + thumbnail;
        
        const views = $(el).find('.front-video-stat').first().text().trim();
        const date = $(el).find('.front-video-stat').last().text().trim();
        
        if (title && link) {
          results.push({
            title,
            url: link,
            views,
            added: date,
            default_thumb: { src: thumbnail }
          });
        }
      });

      if (results.length > 0) {
        const searchId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        telegramSearchCache.set(searchId, { query, results });
        saveResultsToDB(query, results, 'Javtiful');
        sendResults(chatId, searchId, 0);
      } else {
        bot.sendMessage(chatId, "No results found on Javtiful.");
      }
    } catch (e) {
      console.error("Telegram Javtiful Search Error:", e);
      bot.sendMessage(chatId, "An error occurred while searching Javtiful. Please try again.");
    }
  });

  bot.onText(/^\/url(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match ? match[1].trim() : '';
    if (!url || !url.startsWith('http')) return bot.sendMessage(chatId, "Please provide a valid URL. Example: /url https://...");

    bot.sendMessage(chatId, `Extracting details from URL...`);

    try {
      const headers: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };

      const response = await axios.get(url, { headers });
      const html = response.data;
      const $ = cheerio.load(html);

      let title = ($('title').text() || $('h1').text())?.trim();
      let poster = $('video').attr('poster');
      
      const targetChatId = process.env.TELEGRAM_CHANNEL_ID || chatId;

      const caption = `<b>${title}</b>\n\n🔗 <a href="${url}">Watch Video</a>`;
      const replyMarkup = {
        inline_keyboard: [
          [{ text: 'Watch Video', url }]
        ]
      };

      if (poster) {
        if (poster.startsWith('//')) poster = 'https:' + poster;
        
        let photoToSend: any = poster;
        try {
          const imgRes = await axios.get(poster, {
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Referer': url
            }
          });
          photoToSend = Buffer.from(imgRes.data, 'binary');
        } catch (imgErr: any) {
          console.error("Failed to fetch poster image:", imgErr.message);
        }

        bot.sendPhoto(targetChatId, photoToSend, {
          caption: caption,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        }, { filename: 'poster.jpg', contentType: 'image/jpeg' }).then(() => {
          if (targetChatId !== chatId) {
            bot.sendMessage(chatId, "Posted to channel! 🚀");
          }
        }).catch(e => {
          console.error("Telegram sendPhoto error:", e.response?.body || e.message);
          bot.sendMessage(targetChatId, caption, {
            parse_mode: 'HTML',
            reply_markup: replyMarkup
          }).then(() => {
            if (targetChatId !== chatId) bot.sendMessage(chatId, "Posted to channel without photo! 🚀");
          }).catch(err => console.error("Telegram fallback sendMessage error:", err.response?.body || err.message));
        });
      } else {
        bot.sendMessage(targetChatId, caption, {
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        }).then(() => {
          if (targetChatId !== chatId) {
            bot.sendMessage(chatId, "Posted to channel! 🚀");
          }
        }).catch(e => console.error("Telegram sendMessage error:", e.response?.body || e.message));
      }
    } catch (e) {
      console.error("Telegram URL Extract Error:", e);
      bot.sendMessage(chatId, "An error occurred while extracting from URL.");
    }
  });

  bot.on('callback_query', async (cbQuery) => {
    const msg = cbQuery.message;
    if (!msg || !cbQuery.data) return;

    const parts = cbQuery.data.split('|');
    if (parts[0] === 'nav') {
      const searchId = parts[1];
      const page = parseInt(parts[2], 10);
      sendResults(msg.chat.id, searchId, page, msg.message_id);
      bot.answerCallbackQuery(cbQuery.id);
    } else if (parts[0] === 'vid') {
      const searchId = parts[1];
      const videoIndex = parseInt(parts[2], 10);
      const searchData = telegramSearchCache.get(searchId);

      if (searchData && searchData.results[videoIndex]) {
        const video = searchData.results[videoIndex];
        const caption = `<b>${video.title}</b>\n\n` +
                        `🔗 <a href="${video.url}">Watch on Javtiful</a>`;

        const replyMarkup = {
          inline_keyboard: [
            [{ text: 'Watch Video', url: video.url }],
            [
              { text: '📝 Post to Channel', callback_data: `post|${searchId}|${videoIndex}` },
              { text: '📥 Download to Telegram', callback_data: `dltg|${searchId}|${videoIndex}` }
            ]
          ]
        };

        if (video.default_thumb?.src) {
        
          let photoToSend: any = video.default_thumb.src;
          try {
            const imgRes = await axios.get(video.default_thumb.src, {
              responseType: 'arraybuffer',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': video.url
              }
            });
            photoToSend = Buffer.from(imgRes.data, 'binary');
          } catch (imgErr: any) {
             console.error("Failed to fetch default_thumb image:", imgErr.message);
          }

          bot.sendPhoto(msg.chat.id, photoToSend, {
            caption: caption,
            parse_mode: 'HTML',
            reply_markup: replyMarkup
          }, { filename: 'thumb.jpg', contentType: 'image/jpeg' }).then(() => {
            bot.answerCallbackQuery(cbQuery.id);
          }).catch(e => {
            console.error("Telegram sendPhoto error:", e.response?.body || e.message);
            bot.sendMessage(msg.chat.id, caption, {
              parse_mode: 'HTML',
              reply_markup: replyMarkup
            }).then(() => {
              bot.answerCallbackQuery(cbQuery.id);
            }).catch(err => {
              console.error("Telegram fallback sendMessage error:", err.response?.body || err.message);
              bot.answerCallbackQuery(cbQuery.id, { text: "Error fetching details.", show_alert: true });
            });
          });
        } else {
          bot.sendMessage(msg.chat.id, caption, {
            parse_mode: 'HTML',
            reply_markup: replyMarkup
          }).then(() => {
            bot.answerCallbackQuery(cbQuery.id);
          }).catch(e => {
            console.error("Telegram sendMessage error:", e.response?.body || e.message);
            bot.answerCallbackQuery(cbQuery.id, { text: "Error fetching details.", show_alert: true });
          });
        }
      } else {
        bot.answerCallbackQuery(cbQuery.id, { text: "Video details not found or expired.", show_alert: true });
      }
    } else if (parts[0] === 'post') {
      const searchId = parts[1];
      const videoIndex = parseInt(parts[2], 10);
      const searchData = telegramSearchCache.get(searchId);

      if (searchData && searchData.results[videoIndex]) {
        const video = searchData.results[videoIndex];
        const targetChatId = process.env.TELEGRAM_CHANNEL_ID || msg.chat.id;

        bot.answerCallbackQuery(cbQuery.id, { text: "Harvesting details and posting..." });

        (async () => {
          const details = await harvestVideoDetails(video.url);
          const caption = `<b>${details.title || video.title}</b>\n\n🔗 <a href="${video.url}">Watch Online</a>`;

          const replyMarkup = {
            inline_keyboard: [[{ text: 'Watch Video', url: video.url }]]
          };

          const thumbUrl = details.thumbnail || video.default_thumb?.src;
          if (thumbUrl) {
            try {
              const imgRes = await axios.get(thumbUrl, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' }
              });
              await bot.sendPhoto(targetChatId, Buffer.from(imgRes.data, 'binary'), {
                caption: caption,
                parse_mode: 'HTML',
                reply_markup: replyMarkup
              });
            } catch (e) {
              await bot.sendMessage(targetChatId, caption, {
                parse_mode: 'HTML',
                reply_markup: replyMarkup
              });
            }
          } else {
            await bot.sendMessage(targetChatId, caption, {
              parse_mode: 'HTML',
              reply_markup: replyMarkup
            });
          }
        })();
      }
    } else if (parts[0] === 'dltg') {
      const searchId = parts[1];
      const videoIndex = parseInt(parts[2], 10);
      const searchData = telegramSearchCache.get(searchId);

      if (searchData && searchData.results[videoIndex]) {
        const video = searchData.results[videoIndex];

        const qualityKeyboard = {
          inline_keyboard: [
            [
              { text: '1080p', callback_data: `dlq|1080|${searchId}|${videoIndex}` },
              { text: '720p', callback_data: `dlq|720|${searchId}|${videoIndex}` },
              { text: '480p', callback_data: `dlq|480|${searchId}|${videoIndex}` }
            ],
            [
              { text: '360p', callback_data: `dlq|360|${searchId}|${videoIndex}` },
              { text: 'Best (Highest)', callback_data: `dlq|best|${searchId}|${videoIndex}` }
            ]
          ]
        };

        bot.editMessageReplyMarkup(qualityKeyboard, {
          chat_id: msg.chat.id,
          message_id: msg.message_id
        }).catch(() => {});
        bot.answerCallbackQuery(cbQuery.id, { text: "Select video quality" });
      } else {
        bot.answerCallbackQuery(cbQuery.id, { text: "Video details not found or expired.", show_alert: true });
      }
    } else if (parts[0] === 'dlq') {
      const qualityStr = parts[1];
      const searchId = parts[2];
      const videoIndex = parseInt(parts[3], 10);
      const searchData = telegramSearchCache.get(searchId);

      if (searchData && searchData.results[videoIndex]) {
        const video = searchData.results[videoIndex];
        const chatId = msg.chat.id;
        const targetChatId = process.env.TELEGRAM_CHANNEL_ID || chatId;

        bot.answerCallbackQuery(cbQuery.id, { text: "Starting download (could take a few mins)...", show_alert: true });
        
        // Hide the inline keyboard from the message we clicked on
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
           chat_id: chatId,
           message_id: msg.message_id
        }).catch(() => {});

        const progressMsg = await bot.sendMessage(chatId, `⬇️ <b>Downloading:</b> ${video.title}\n\n${getProgressBar(0)} 0%`, { parse_mode: 'HTML' });

        const outputFilename = path.join(tmpdir(), `video_${Date.now()}.mp4`);
        
        let formatStr = 'best';
        if (qualityStr !== 'best') {
           formatStr = `bestvideo[height<=${qualityStr}]+bestaudio/best[height<=${qualityStr}]/best`;
        }

        try {
          const dlOptions: any = {
            output: outputFilename,
            format: formatStr,
            concurrentFragments: 16,
            addHeader: [
              'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            ]
          };

          let lastEditTime = Date.now();
          const subprocess = youtubedl.exec(video.url, dlOptions);

          subprocess.stdout?.on('data', (data: any) => {
             const text = data.toString();
             const match = text.match(/\[download\]\s+([\d\.]+)%(?:.*?of\s+([~\s]*[\d\.]+[KMGkmg]i?B))?(?:.*?at\s+([^\s]+))?(?:.*?ETA\s+([^\s]+))?/);
             if (match) {
                 const percent = parseFloat(match[1]);
                 const size = match[2] ? match[2].trim() : '';
                 const speed = match[3] && match[3] !== 'Unknown' ? match[3] : '';
                 const eta = match[4] && match[4] !== 'Unknown' ? match[4] : '';
                 
                 let statusDetails = '';
                 if (size) statusDetails += `\nSize: ${size}`;
                 if (speed) statusDetails += `\nSpeed: ${speed}`;
                 if (eta) statusDetails += `\nETA: ${eta}`;
                 
                 const now = Date.now();
                 if (now - lastEditTime > 2500 || percent >= 100) {
                     lastEditTime = now;
                     bot.editMessageText(`⬇️ <b>Downloading...</b>\n\n${video.title}\n${getProgressBar(percent)} ${percent.toFixed(1)}%${statusDetails}`, {
                         chat_id: chatId,
                         message_id: progressMsg.message_id,
                         parse_mode: 'HTML'
                     }).catch(() => {});
                 }
             }
          });

          await subprocess;

          bot.editMessageText(`⬆️ <b>Extracting metadata & thumbnail...</b>\n\n${video.title}`, {
            chat_id: chatId,
            message_id: progressMsg.message_id,
            parse_mode: 'HTML'
          }).catch(() => {});

          const [meta, details] = await Promise.all([
            getVideoMetadata(outputFilename),
            harvestVideoDetails(video.url)
          ]);

          const detailPhoto = details.thumbnail || video.default_thumb?.src;

          let thumbBuffer: Buffer | undefined;
          if (detailPhoto) {
            try {
              const imgRes = await axios.get(detailPhoto, { responseType: 'arraybuffer' });
              thumbBuffer = Buffer.from(imgRes.data, 'binary');
            } catch (e) {}
          }

          const fileAttributes = [
              new Api.DocumentAttributeVideo({
                  duration: meta.duration,
                  w: meta.width,
                  h: meta.height,
                  supportsStreaming: true
              })
          ];

          await bot.editMessageText(`⬆️ <b>Uploading...</b>\n\n${video.title}\n${getProgressBar(0)} 0%`, {
            chat_id: chatId,
            message_id: progressMsg.message_id,
            parse_mode: 'HTML'
          }).catch(() => {});

          lastEditTime = Date.now();

          let uploadLastTime = Date.now();
          let uploadLastProgress = 0;

          if (gramClient) {
            try {
              const fileContent = fs.readFileSync(outputFilename);
              const customFile = new CustomFile(path.basename(outputFilename), fileContent.length, outputFilename, fileContent);
              
              await gramClient.sendFile(targetChatId, {
                 file: customFile,
                 caption: `<b>${video.title}</b>`,
                 parseMode: 'html',
                 thumb: thumbBuffer,
                 attributes: fileAttributes,
                 workers: 16,
                 progressCallback: (progress: number) => {
                     // progress is a float between 0 and 1
                     const percent = progress * 100;
                     const now = Date.now();
                     const timeDiff = now - uploadLastTime;
                     
                     if (timeDiff > 2500 || percent >= 100) {
                         let statusDetails = '';
                         let speedBps = 0;
                         if (timeDiff > 0 && progress > uploadLastProgress) {
                             const bytesUploaded = (progress - uploadLastProgress) * fileContent.length;
                             speedBps = bytesUploaded / (timeDiff / 1000);
                         }

                         const mbSize = (fileContent.length / (1024 * 1024)).toFixed(2);
                         statusDetails += `\nSize: ${mbSize} MiB`;

                         if (speedBps > 0 && percent < 100) {
                             if (speedBps > 1024 * 1024) {
                                 statusDetails += `\nSpeed: ${(speedBps / (1024 * 1024)).toFixed(2)} MiB/s`;
                             } else if (speedBps > 1024) {
                                 statusDetails += `\nSpeed: ${(speedBps / 1024).toFixed(2)} KiB/s`;
                             } else {
                                 statusDetails += `\nSpeed: ${Math.round(speedBps)} B/s`;
                             }
                             
                             const remainingBytes = fileContent.length * (1 - progress);
                             const remainingSeconds = remainingBytes / speedBps;
                             if (remainingSeconds > 0 && remainingSeconds < 86400) {
                                 const etaMins = Math.floor(remainingSeconds / 60);
                                 const etaSecs = Math.floor(remainingSeconds % 60);
                                 statusDetails += `\nETA: ${etaMins.toString().padStart(2, '0')}:${etaSecs.toString().padStart(2, '0')}`;
                             }
                         }
                         
                         uploadLastTime = now;
                         uploadLastProgress = progress;
                         
                         bot.editMessageText(`⬆️ <b>Uploading...</b>\n\n${video.title}\n${getProgressBar(percent)} ${percent.toFixed(1)}%${statusDetails}`, {
                             chat_id: chatId,
                             message_id: progressMsg.message_id,
                             parse_mode: 'HTML'
                         }).catch(() => {});
                     }
                 }
              });
            } catch (e: any) {
               console.error("GramJS upload error, falling back to node-telegram-bot-api", e);
               await bot.sendVideo(targetChatId, fs.createReadStream(outputFilename), {
                 caption: `<b>${video.title}</b>\n\n🔗 <a href="${video.url}">Source</a>`,
                 parse_mode: 'HTML'
               });
            }

            // Mark as uploaded in DB so auto-download skips it
            await { rows: [] }.catch(e => console.error("Error marking manual upload as done:", e));
          } else {
             await bot.sendVideo(targetChatId, fs.createReadStream(outputFilename), {
               caption: `<b>${video.title}</b>\n\n🔗 <a href="${video.url}">Source</a>`,
               parse_mode: 'HTML'
             });
             // Mark as uploaded in DB
             await { rows: [] }.catch(e => console.error("Error marking manual upload as done (fallback):", e));
          }

          await bot.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
          if (targetChatId !== chatId) {
            await bot.sendMessage(chatId, "Video uploaded to channel! ✅");
          }

          if (fs.existsSync(outputFilename)) fs.unlinkSync(outputFilename);
        } catch (err: any) {
           console.error("YTDL Error:", err);
           bot.editMessageText("Failed to download or upload the video. " + (err.message || ''), {
             chat_id: chatId,
             message_id: progressMsg.message_id
           }).catch(() => {});
           if (fs.existsSync(outputFilename)) {
             fs.unlinkSync(outputFilename);
           }
        }
      } else {
        bot.answerCallbackQuery(cbQuery.id, { text: "Video details not found or expired.", show_alert: true });
      }
    }
  });
}

async function processVideoDownloadAndUpload(video: { title: string, url: string, default_thumb?: { src: string } }, qualityStr: string = '720', updateDb: boolean = true) {
  if (!globalBot) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const targetChatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!targetChatId) return;

  const outputFilename = path.join(tmpdir(), `video_${Date.now()}.mp4`);
  
  let formatStr = 'best';
  if (qualityStr !== 'best') {
     formatStr = `bestvideo[height<=${qualityStr}]+bestaudio/best[height<=${qualityStr}]/best`;
  }

  try {
    const dlOptions: any = {
      output: outputFilename,
      format: formatStr,
      concurrentFragments: 16,
      addHeader: [
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      ]
    };

    await youtubedl.exec(video.url, dlOptions);

    const [meta, details] = await Promise.all([
      getVideoMetadata(outputFilename),
      harvestVideoDetails(video.url)
    ]);

    const detailPhoto = details.thumbnail || video.default_thumb?.src;
    let thumbBuffer: Buffer | undefined;
    if (detailPhoto) {
      try {
        const imgRes = await axios.get(detailPhoto, { responseType: 'arraybuffer' });
        thumbBuffer = Buffer.from(imgRes.data, 'binary');
      } catch (e) {}
    }

    const fileAttributes = [
        new Api.DocumentAttributeVideo({
            duration: meta.duration,
            w: meta.width,
            h: meta.height,
            supportsStreaming: true
        })
    ];

    if (gramClient) {
      try {
        const fileContent = fs.readFileSync(outputFilename);
        const customFile = new CustomFile(path.basename(outputFilename), fileContent.length, outputFilename, fileContent);
        
        await gramClient.sendFile(targetChatId, {
           file: customFile,
           caption: `<b>${video.title}</b>`,
           parseMode: 'html',
           thumb: thumbBuffer,
           attributes: fileAttributes,
           workers: 16
        });
      } catch (e: any) {
         console.error("GramJS upload error, falling back to node-telegram-bot-api", e);
         await globalBot.sendVideo(targetChatId, fs.createReadStream(outputFilename), {
           caption: `<b>${video.title}</b>`,
           parse_mode: 'HTML'
         });
      }
    } else {
       await globalBot.sendVideo(targetChatId, fs.createReadStream(outputFilename), {
         caption: `<b>${video.title}</b>`,
         parse_mode: 'HTML'
       });
    }

    if (updateDb) {
      {};
    }

    if (fs.existsSync(outputFilename)) fs.unlinkSync(outputFilename);
    return true;
  } catch (err: any) {
     console.error("Download/Upload Error:", err);
     if (fs.existsSync(outputFilename)) fs.unlinkSync(outputFilename);
     return false;
  }
}

async function autoDownloadLoop() {
  if (!autoDownloadActive) return;

  try {
    // Get 5 videos that haven't been uploaded yet
    const { rows } = {};
    
    if (rows.length === 0) {
      {};
      autoDownloadActive = false;
      return;
    }

    {};
    
    for (const row of rows) {
      if (!autoDownloadActive) break;
      
      const video = {
        title: row.title,
        url: row.url,
        default_thumb: { src: row.thumbnail }
      };

      {};
      await processVideoDownloadAndUpload(video, '720');
      
      // Small delay between videos in a batch
      await new Promise(r => setTimeout(r, 5000));
    }

    // Delay between batches
    if (autoDownloadActive) {
      {};
      setTimeout(autoDownloadLoop, 15000);
    }
  } catch (e) {
    console.error("Auto-download loop error:", e);
    setTimeout(autoDownloadLoop, 30000); // Wait longer on error
  }
}

async function startServer() {
  createBot();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send("No URL provided");
    try {
      const axiosRes = await axios.get(url, {
        responseType: "stream",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      // Copy content-type header if available
      if (axiosRes.headers['content-type']) {
        res.setHeader('Content-Type', axiosRes.headers['content-type']);
      }
      axiosRes.data.pipe(res);
    } catch (error) {
      res.status(404).send("File not found");
    }
  });

  // API routes
  app.post("/api/search-javtiful", async (req, res) => {
    const { query, page = 1 } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required" });

    try {
      const url = `https://javtiful.com/search?q=${encodeURIComponent(query)}&page=${page}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
      });
      const $ = cheerio.load(response.data);
      const results: any[] = [];
      
      $('.front-video-card').each((_, el) => {
        const title = $(el).find('.front-video-title').text().trim();
        const linkAttr = $(el).find('.front-video-title').attr('href');
        const link = linkAttr ? (linkAttr.startsWith('http') ? linkAttr : `https://javtiful.com${linkAttr.startsWith('/') ? linkAttr : '/' + linkAttr}`) : null;
        let thumbnail = $(el).find('.front-video-thumb img').attr('data-front-lazy-src') || $(el).find('.front-video-thumb img').attr('src');
        if (thumbnail && thumbnail.startsWith('/')) thumbnail = 'https://javtiful.com' + thumbnail;
        
        const views = $(el).find('.front-video-stat').first().text().trim();
        const duration = $(el).find('.front-duration-tag').text().trim();
        const date = $(el).find('.front-video-stat').last().text().trim();
        
        const thumbs: any[] = [];
        if (thumbnail) thumbs.push({ src: thumbnail });

        if (title && link) {
          results.push({
            title,
            link,
            thumbnail,
            isRelated: false,
            details: {
              description: title,
              views,
              date,
              tags: [], // Add parsing if visible on card
              previewImage: thumbnail,
              thumbnail,
              thumbs
            }
          });
        }
      });

      saveResultsToDB(query, results, 'Javtiful');
      res.json({ results });
    } catch (error) {
      console.error("Javtiful search error:", error);
      res.status(500).json({ error: "Failed to search Javtiful" });
    }
  });


  res.json({ pornstars: [] }); });
    } catch (error) {
      console.error("Failed to fetch pornstars:", error);
      res.status(500).json({ error: "Failed to fetch pornstars" });
    }
  });

  
    const { page = 1 } = req.body;
    try {
      const results: any[] = [];
      const response = await axios.get(`https://javtiful.com/actresses?page=${page}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const $ = cheerio.load(response.data);
      
      const uniqueNames = new Set();
      $('a[href*="/actress/"]').each((_, el) => {
         const href = $(el).attr('href');
         let img = $(el).find('img').attr('data-front-lazy-src') || $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
         if (img && img.startsWith('/')) img = 'https://javtiful.com' + img;
         const name = $(el).find('img').attr('alt') || $(el).text().trim();
         
         if (href && img && name && !uniqueNames.has(name) && name.length > 2) {
           uniqueNames.add(name);
           const url = href.startsWith('http') ? href : `https://javtiful.com${href.startsWith('/') ? '' : '/'}${href}`;
           results.push({ name, url, thumbnail: img, platform: 'javtiful' });
         }
      });

      if (results.length > 0) {
        // Sort by name to prevent deadlocks
        results.sort((a: any, b: any) => a.name.localeCompare(b.name));
        
        try {
          await transactionWithRetry(async (client) => {
            for (const item of results) {
               await client.query(`
                 INSERT INTO pornstars (name, url, thumbnail, platform) 
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (name) DO UPDATE SET url = $2, thumbnail = $3, platform = $4
               `, [item.name, item.url, item.thumbnail, item.platform]);
            }
          });
        } catch (e) {
          console.error("Failed to save pornstars:", e);
          // Don't throw here if we want to still return results to user
        }
      }
      res.json({ results });
    } catch (e) {
       console.error("Failed to scrape pornstars:", e);
       res.status(500).json({ error: "Failed to scrape pornstars" });
    }
  });

  app.post("/api/extract-details", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const details = await harvestVideoDetails(url);

      // Background updates
      if (url) {
        (async () => {
          try {
            await transactionWithRetry(async (client) => {
              if (details.pornstars && details.pornstars.length > 0) {
                const sortedStars = [...details.pornstars].sort((a, b) => a.name.localeCompare(b.name));
                for (const item of sortedStars) {
                  await client.query(`
                    INSERT INTO pornstars (name, url, thumbnail, platform) 
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (name) DO UPDATE SET url = $2, platform = $4
                  `, [item.name, item.url, item.thumbnail, item.platform]);
                }
              }
              
              const tagsStr = details.tags ? (Array.isArray(details.tags) ? details.tags.join(', ') : details.tags) : '';
              await client.query(`
                UPDATE search_results SET
                  description = $1,
                  views = $2,
                  tags = $3,
                  thumbnail = COALESCE(thumbnail, $4)
                WHERE url = $5
              `, [details.description || '', details.views || '', tagsStr, details.thumbnail || details.previewImage || '', url]);
            });
          } catch (e) {
            console.error("Background metadata save error:", e);
          }
        })();
      }
      res.json({ details });
    } catch (error) {
      console.error("Extract details error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/extract", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      let baseUrl: URL;
      try {
        baseUrl = new URL(url);
      } catch (e) {
        return res.status(400).json({ error: "Invalid URL provided" });
      }

      const headers: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };

      const response = await axios.get(url, {
        headers
      });
      const html = response.data;
      const $ = cheerio.load(html);
      
      const results: { title: string; link: string; thumbnail?: string; isRelated?: boolean }[] = [];
      const seenLinks = new Set<string>();
      
      const extractTitle = (el: any) => {
        let title = $(el).text().trim();
        if (!title) {
          title = $(el).attr("title") || 
                  $(el).find("img").attr("alt") || 
                  $(el).find("img").attr("title") || 
                  $(el).find("h1, h2, h3, h4, span, p").first().text().trim();
        }
        return title;
      };

      const getThumbnail = (el: any) => {
        // 1. Look for img tags inside the link
        let img = $(el).find("img").first();
        
        // 2. If not found, traverse up the DOM tree (up to 5 levels) to find a container with an image
        if (!img.length) {
          let current = $(el).parent();
          for (let i = 0; i < 5; i++) {
            if (!current.length) break;
            const imgs = current.find("img");
            if (imgs.length) {
              // Try to avoid avatars or tiny icons
              img = imgs.filter((_, e) => {
                const className = $(e).attr('class') || '';
                return !className.match(/avatar|icon|logo|badge/i);
              }).first();
              if (!img.length) img = imgs.first();
              break;
            }
            current = current.parent();
          }
        }
        
        // 3. Extract source, prioritizing lazy-loaded attributes
        if (img.length) {
          const src = img.attr("data-front-lazy-src") ||
                      img.attr("data-src") || 
                      img.attr("data-lazy-src") || 
                      img.attr("data-original") || 
                      img.attr("data-thumb") ||
                      img.attr("data-poster") ||
                      img.attr("srcset")?.split(",").pop()?.trim().split(" ")[0] || 
                      img.attr("src");
                      
          if (src && !src.startsWith("data:image") && !src.includes("avatar") && !src.includes("icon")) {
            try {
              return new URL(src, baseUrl.origin).href;
            } catch (e) {
              // ignore invalid URLs
            }
          }
        }

        // 4. Fallback: check for background-image styles or data-bg
        let bgElement = $(el).find('[style*="background-image"], [data-bg]').first();
        if (!bgElement.length) {
           let current = $(el).parent();
           for (let i = 0; i < 5; i++) {
             if (!current.length) break;
             bgElement = current.find('[style*="background-image"], [data-bg]').first();
             if (bgElement.length) break;
             current = current.parent();
           }
        }
        
        if (bgElement.length) {
          const dataBg = bgElement.attr("data-bg");
          if (dataBg && !dataBg.startsWith("data:image")) {
             try { return new URL(dataBg, baseUrl.origin).href; } catch(e) {}
          }
          const style = bgElement.attr("style") || "";
          const match = style.match(/background-image:\s*url\s*\(['"]?(.*?)['"]?\)/i);
          if (match && match[1] && !match[1].startsWith("data:image")) {
            try {
              return new URL(match[1], baseUrl.origin).href;
            } catch (e) {}
          }
        }

        // 5. Check siblings for generic thumbnail containers
        const siblingImg = $(el).siblings().find('img').first();
        if (siblingImg.length) {
           const src = siblingImg.attr("data-src") || siblingImg.attr("src");
           if (src && !src.startsWith("data:image")) {
              try { return new URL(src, baseUrl.origin).href; } catch(e) {}
           }
        }

        return null;
      };

      // 1. Try to find main video lists or "Related" sections specifically
      const videoListSelectors = [
        '#videoSearchResult', '.pcVideoListItem', '.video-wrapper', '.videoBox', '.items-container', 'ul.videos', '.thumb-list',
        '[class*="related"]', '[id*="related"]', 
        '[class*="recommend"]', '[id*="recommend"]',
        '[class*="suggest"]', '[id*="suggest"]',
        'aside', '.sidebar', '.post-related'
      ];

      videoListSelectors.forEach(selector => {
        $(selector).find("a").each((_, element) => {
          const title = extractTitle(element);
          const link = $(element).attr("href");
          
          const isInvalidLink = link?.toLowerCase().includes('/profile/') ||
                                link?.toLowerCase().includes('/user/') ||
                                link?.toLowerCase().includes('login') ||
                                link?.toLowerCase().includes('signup');
                                
          if (link && title && title.length > 5 && !isInvalidLink) {
            try {
              const absoluteUrl = new URL(link, baseUrl.origin).href;
              // Skip urls that don't look like video pages if we are strict, but let's just use seenLinks
              if (!seenLinks.has(absoluteUrl) && absoluteUrl !== baseUrl.href) {
                const thumbnail = getThumbnail(element);
                results.push({ title, link: absoluteUrl, thumbnail: thumbnail || undefined, isRelated: true });
                seenLinks.add(absoluteUrl);
              }
            } catch (e) {}
          }
        });
      });

      // 2. Fallback to general links if not enough related ones found
      if (results.length < 5) {
        $("a").each((_, element) => {
          const title = extractTitle(element);
          const link = $(element).attr("href");

          const isInvalidLink = link?.toLowerCase().includes('/profile/') ||
                                link?.toLowerCase().includes('/user/') ||
                                link?.toLowerCase().includes('login') ||
                                link?.toLowerCase().includes('signup');

          if (link && title && title.length > 5 && !isInvalidLink) {
            try {
              const absoluteUrl = new URL(link, baseUrl.origin).href;
              if (!seenLinks.has(absoluteUrl) && absoluteUrl !== baseUrl.href) {
                const thumbnail = getThumbnail(element);
                results.push({ title, link: absoluteUrl, thumbnail: thumbnail || undefined });
                seenLinks.add(absoluteUrl);
              }
            } catch (e) {}
          }
        });
      }

      const platformLabel = url.includes('javtiful.com') ? 'Javtiful' : baseUrl.hostname.replace('www.', '');

      saveResultsToDB('Scrape: ' + url, results, platformLabel);
      res.json({ results: results.slice(0, 50) });
    } catch (error) {
      console.error("Scraping error:", error);
      res.status(500).json({ error: "Failed to scrape the URL" });
    }
  });

  res.json({ platforms: [] }); });
    } catch (error) {
      console.error("Failed to fetch platforms:", error);
      res.status(500).json({ error: "Failed to fetch platforms" });
    }
  });

  res.json({ queries: [] }); });
    } catch (error) {
      console.error("Failed to fetch queries:", error);
      res.status(500).json({ error: "Failed to fetch queries" });
    }
  });

  res.json({ results: [], total: 0 }); });
    } catch (error) {
      console.error("Database search error:", error);
      res.status(500).json({ error: "Failed to fetch results from database" });
    }
  });

  res.json({ success: true }); });
    } catch (error) {
      console.error("Failed to clear database:", error);
      res.status(500).json({ error: "Failed to clear database" });
    }
  });

  app.get("/api/auto-download-status", (req, res) => {
    res.json({ active: autoDownloadActive });
  });

  app.post("/api/auto-download", (req, res) => {
    const { active } = req.body;
    autoDownloadActive = active;
    if (autoDownloadActive) {
      autoDownloadLoop();
    }
    res.json({ active: autoDownloadActive });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    {};
  });
}

startServer();
