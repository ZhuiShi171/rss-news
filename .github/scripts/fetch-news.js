const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ========== RSS 源列表 ==========
const RSS_SOURCES = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', file: 'bbc-world' },
  { name: 'BBC China', url: 'https://feeds.bbci.co.uk/news/world/asia/china/rss.xml', file: 'bbc-china' },
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
  { name: 'Reuters World', url: 'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en', file: 'reuters-world' },
  { name: 'AP World', url: 'https://news.google.com/rss/search?q=site:apnews.com+world&hl=en-US&gl=US&ceid=US:en', file: 'ap-world' },
  { name: 'CNN World', url: 'https://news.google.com/rss/search?q=site:cnn.com+world&hl=en-US&gl=US&ceid=US:en', file: 'cnn-world' },
  { name: 'Washington Post World', url: 'https://news.google.com/rss/search?q=site:washingtonpost.com+world&hl=en-US&gl=US&ceid=US:en', file: 'wapo-world' },
  { name: 'NBC News World', url: 'https://news.google.com/rss/search?q=site:nbcnews.com+world&hl=en-US&gl=US&ceid=US:en', file: 'nbc-world' },
  { name: 'Newsweek', url: 'https://news.google.com/rss/search?q=site:newsweek.com&hl=en-US&gl=US&ceid=US:en', file: 'newsweek' },
  { name: 'NHK World', url: 'https://news.google.com/rss/search?q=site:nhk.or.jp+world&hl=en-US&gl=US&ceid=US:en', file: 'nhk-world' },
  { name: 'Kyiv Independent', url: 'https://news.google.com/rss/search?q=site:kyivindependent.com&hl=en-US&gl=US&ceid=US:en', file: 'kyiv-independent' },
  { name: 'Times of Israel', url: 'https://news.google.com/rss/search?q=site:timesofisrael.com&hl=en-US&gl=US&ceid=US:en', file: 'times-of-israel' },
];

// ========== XML 转义函数 ==========
function escapeXml(text) {
  if (!text) return '';
  let decoded = String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'");
  return decoded
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ========== HTTP 请求 ==========
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, (res) => {
      // 跟随重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let nextUrl = res.headers.location;
        if (nextUrl.startsWith('/')) {
          const u = new URL(url);
          nextUrl = u.origin + nextUrl;
        }
        resolve(fetchURL(nextUrl));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ========== 简单正文提取（正则方式）==========
function extractArticle(html) {
  // 移除 script/style/nav/footer
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '');

  // 找 article 标签或 main 标签
  let articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (!articleMatch) {
    articleMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  }
  if (!articleMatch) {
    articleMatch = cleaned.match(/<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  }

  let content = articleMatch ? articleMatch[1] : cleaned;

  // 转成纯文本（保留段落）
  content = content
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 截取前 2000 字符
  if (content.length > 2000) {
    content = content.substring(0, 2000) + '...';
  }

  return content;
}

// ========== 解析 RSS XML ==========
function parseItems(xml) {
  const items = [];
  const itemRegex = /<item[\s>][\s\S]*?<\/item>/g;
  const matches = xml.match(itemRegex) || [];

  for (const itemXml of matches) {
    const title = (itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
    const link = (itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || '';
    const pubDate = (itemXml.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/) || [])[1] || '';
    const description = (itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1] || '';
    items.push({ title, link, pubDate, description });
  }
  return items;
}

// ========== 生成单个媒体 RSS ==========
function generateSingleRSS(source, items) {
  const itemsXml = items.slice(0, 15).map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <pubDate>${escapeXml(item.pubDate)}</pubDate>
      <description>${escapeXml(item.fullContent || item.description)}</description>
    </item>
  `).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(source.name)}</title>
    <link>${escapeXml(source.url)}</link>
    <description>RSS feed for ${escapeXml(source.name)}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(__dirname, '../../docs', `${source.file}.xml`), xml, 'utf8');
  console.log(`Generated ${source.file}.xml with ${items.length} items`);
}

// ========== 生成总汇总 RSS ==========
function generateMasterRSS(allItems) {
  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const itemsXml = allItems.slice(0, 80).map(item => `
    <item>
      <title>${escapeXml(`[${item.source}] ${item.title}`)}</title>
      <link>${escapeXml(item.link)}</link>
      <pubDate>${escapeXml(item.pubDate)}</pubDate>
      <description>${escapeXml(item.fullContent || item.description)}</description>
    </item>
  `).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>国际新闻汇总</title>
    <link>https://zhuishi171.github.io/rss-news/</link>
    <description>International News Aggregated Feed</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(__dirname, '../../docs', 'feed.xml'), xml, 'utf8');
  console.log(`Generated master feed.xml with ${allItems.length} total items`);
}

// ========== 主函数 ==========
async function main() {
  const docsDir = path.join(__dirname, '../../docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  const allItems = [];

  for (const source of RSS_SOURCES) {
    console.log(`Fetching ${source.name}...`);
    try {
      const xml = await fetchURL(source.url);
      const items = parseItems(xml);

      if (items.length > 0) {
        // 对每篇文章抓全文（前 10 篇）
        for (let i = 0; i < Math.min(10, items.length); i++) {
          try {
            console.log(`  -> Fetching article: ${items[i].title.substring(0, 50)}...`);
            const html = await fetchURL(items[i].link);
            items[i].fullContent = extractArticle(html);
          } catch (e) {
            items[i].fullContent = items[i].description; // 失败就用摘要
          }
        }

        generateSingleRSS(source, items);
        items.slice(0, 3).forEach(item => {
          allItems.push({ source: source.name, ...item });
        });
      } else {
        console.log(`No items from ${source.name}`);
      }
    } catch (e) {
      console.log(`Failed ${source.name}: ${e.message}`);
    }
  }

  generateMasterRSS(allItems);
  console.log('Done!');
}

main().catch(console.error);
