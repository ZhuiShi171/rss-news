const RSS_SOURCES = [
  // 原有源
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'BBC China', url: 'https://feeds.bbci.co.uk/news/world/asia/china/rss.xml' },
  { name: 'Reuters World', url: 'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en' },
  { name: 'AP World', url: 'https://feeds.apnews.com/apf-intlnews' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'Guardian World', url: 'https://www.theguardian.com/world/rss' },
  { name: 'Guardian China', url: 'https://www.theguardian.com/world/china/rss' },
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { name: 'CNN World', url: 'https://rss.cnn.com/rss/edition_world.rss' },

  // 新增：英文主流大报
  { name: 'Washington Post World', url: 'https://feeds.washingtonpost.com/rss/world' },
  { name: 'WSJ World', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml' },
  { name: 'Financial Times World', url: 'https://www.ft.com/world?format=rss' },
  { name: 'Bloomberg World', url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { name: 'CNBC World', url: 'https://www.cnbc.com/id/100727362/device/rss/rss.html' },
  { name: 'ABC News World', url: 'https://abcnews.go.com/abcnews/internationalheadlines' },
  { name: 'CBS News World', url: 'https://www.cbsnews.com/latest/rss/world' },
  { name: 'NBC News World', url: 'https://feeds.nbcnews.com/nbcnews/public/worldnews' },

  // 新增：新闻周刊
  { name: 'Newsweek', url: 'https://www.newsweek.com/feed' },

  // 新增：南华早报
  { name: 'SCMP World', url: 'https://www.scmp.com/rss/91/feed' },

  // 新增：NHK World
  { name: 'NHK World', url: 'https://www3.nhk.or.jp/nhkworld/en/news/feeds/all.xml' },
];

async function fetchRSS(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS-Fetcher/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch ${url}: ${error.message}`);
    return null;
  }
}

function parseItems(xml, sourceName) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/);
    const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

    if (titleMatch && linkMatch) {
      items.push({
        title: (titleMatch[1] || titleMatch[2] || '').trim(),
        link: linkMatch[1].trim(),
        description: (descMatch ? (descMatch[1] || descMatch[2] || '') : '').trim(),
        pubDate: dateMatch ? dateMatch[1].trim() : new Date().toUTCString(),
        source: sourceName,
      });
    }
  }
  return items;
}

function generateRSS(allItems) {
  const itemsXml = allItems
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 100)
    .map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <description><![CDATA[[${item.source}] ${item.description}]]></description>
      <pubDate>${item.pubDate}</pubDate>
      <source>${item.source}</source>
    </item>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>International News Aggregated</title>
    <link>https://zhuishi171.github.io/rss-news/</link>
    <description>Aggregated international news from multiple sources</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`;
}

async function main() {
  console.log('Starting news fetch...');
  const allItems = [];

  for (const source of RSS_SOURCES) {
    console.log(`Fetching: ${source.name}`);
    const xml = await fetchRSS(source.url);
    if (xml) {
      const items = parseItems(xml, source.name);
      console.log(`  Found ${items.length} items`);
      allItems.push(...items);
    }
  }

  console.log(`Total items: ${allItems.length}`);
  const rss = generateRSS(allItems);

  const fs = require('fs');
  fs.writeFileSync('docs/feed.xml', rss);
  console.log('Generated docs/feed.xml');
}

main().catch(console.error);
