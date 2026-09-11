const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://javtiful.com/actresses').then(res => {
  const $ = cheerio.load(res.data);
  const actors = [];
  $('a[href*="/actress/"]').each((i, el) => {
    actors.push($(el).html());
  });
  console.log("Found " + actors.length + " links");
  console.log(actors.slice(0, 5));
});
