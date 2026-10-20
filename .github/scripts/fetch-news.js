const RSS_SOURCES = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', file: 'bbc-world' },
  { name: 'BBC China', url: 'https://feeds.bbci.co.uk/news/world/asia/china/rss.xml', file: 'bbc-china' },
  { name: 'Reuters World', url: 'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en', file: 'reuters-world' },
  { name: 'AP World', url: 'https://news.google.com/rss/search?q=site:apnews.com+world&hl=en-US&gl=US&ceid=US:en', file: 'ap-world' },
  { name: 'CNN World', url: 'https://news.google.com/rss/search?q=site:cnn.com+world&hl=en-US&gl=US&ceid=US:en', file: 'cnn-world' },
  { name: 'Washington Post World', url: 'https://news.google.com/rss/search?q=site:washingtonpost.com+world&hl=en-US&gl=US&ceid=US:en', file: 'wapo-world' },
  { name: 'NBC News World', url: 'https://news.google.com/rss/search?q=site:nbcnews.com+world&hl=en-US&gl=US&ceid=US:en', file: 'nbc-world' },
  { name: 'Newsweek', url: 'https://news.google.com/rss/search?q=site:newsweek.com&hl=en-US&gl=US&ceid=US:en', file: 'newsweek' },
  { name: 'NHK World', url: 'https://news.google.com/rss/search?q=site:nhk.or.jp+world&hl=en-US&gl=US&ceid=US:en', file: 'nhk-world' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', file: 'aljazeera' },
  { name: 'Guardian World', url: 'https://www.theguardian.com/world/rss', file: 'guardian-world' },
  { name: 'Guardian China', url: 'https://www.theguardian.com/world/china/rss', file: 'guardian-china' },
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', file: 'npr-news' },
  { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', file: 'nyt-world' },
  { name: 'WSJ World', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', file: 'wsj-world' },
  { name: 'Financial Times World', url: 'https://www.ft.com/world?format=rss', file: 'ft-world' },
  { name: 'Bloomberg World', url: 'https://feeds.bloomberg.com/markets/news.rss', file: 'bloomberg-world' },
  { name: 'CNBC World', url: 'https://www.cnbc.com/id/100727362/device/rss/rss.html', file: 'cnbc-world' },
  { name: 'ABC News World', url: 'https://abcnews.go.com/abcnews/internationalheadlines', file: 'abc-world' },
  { name: 'CBS News World', url: 'https://www.cbsnews.com/latest/rss/world', file: 'cbs-world' },
  { name: 'SCMP World', url: 'https://www.scmp.com/rss/91/feed', file: 'scmp-world' },
  { name: 'France 24 English', url: 'https://www.france24.com/en/rss', file: 'france24' },
  { name: 'Kyiv Independent', url: 'https://kyivindependent.com/feed/', file: 'kyiv-independent' },
  { name: 'Times of Israel', url: 'https://www.timesofisrael.com/feed/', file: 'times-of-israel' },
];

async function fetchRSS(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
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

function generateRSS(title, link, description, items) {
  const itemsXml = items
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 50)
    .map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${item.pubDate}</pubDate>
    </item>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${title}</title>
    <link>${link}</link>
    <description>${description}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`;
}

async function main() {
  console.log('Starting news fetch...');
  const fs = require('fs');
  const path = require('path');

  if (!fs.existsSync('docs')) {
    fs.mkdirSync('docs', { recursive: true });
  }

  const allItems = [];

  for (const source of RSS_SOURCES) {
    console.log(`Fetching: ${source.name}`);
    const xml = await fetchRSS(source.url);
    if (xml) {
      const items = parseItems(xml, source.name);
      console.log(`  Found ${items.length} items`);

      const sourceRSS = generateRSS(
        source.name,
        source.url,
        `${source.name} - latest news`,
        items
      );
      fs.writeFileSync(`docs/${source.file}.xml`, sourceRSS);

      allItems.push(...items);
    }
  }

  console.log(`Total items: ${allItems.length}`);

  const combinedRSS = generateRSS(
    'International News Aggregated',
    'https://zhuishi171.github.io/rss-news/',
    'Aggregated international news from multiple sources',
    allItems
  );
  fs.writeFileSync('docs/feed.xml', combinedRSS);

  console.log(`Generated ${RSS_SOURCES.length + 1} feed files in docs/`);
}

main().catch(console.error);
