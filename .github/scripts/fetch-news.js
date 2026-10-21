const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

// ========== RSS 源列表 ==========
const RSS_SOURCES = [
  // 直连源（媒体官方 RSS）
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

  // Google News 聚合版（国内直连失败的源用这个）
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

// ========== XML 转义函数（先解码再编码，避免双重转义）==========
function escapeXml(text) {
  if (!text) return '';
  // 第一步：先把已有的 XML 实体解码回原始字符
  let decoded = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  // 第二步：统一转义成标准 XML
  return decoded
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ========== 抓取单个 RSS ==========
async function fetchRSS(url) {
  try {
    const response = await axios.get(url, { timeout: 30000 });
    const result = await xml2js.parseStringPromise(response.data);
    return result.rss.channel[0].item || [];
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error.message);
    return [];
  }
}

// ========== 生成单个媒体的 RSS 文件 ==========
function generateSingleRSS(source, items) {
  const channel = {
    title: source.name,
    link: source.url,
    description: `RSS feed for ${source.name}`,
    lastBuildDate: new Date().toUTCString(),
  };

  const itemsXml = items.slice(0, 20).map(item => `
    <item>
      <title>${escapeXml(item.title[0])}</title>
      <link>${escapeXml(item.link[0])}</link>
      <pubDate>${escapeXml(item.pubDate[0] || '')}</pubDate>
      <description>${escapeXml((item.description && item.description[0]) || '')}</description>
    </item>
  `).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <lastBuildDate>${channel.lastBuildDate}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`;

  const outputPath = path.join(__dirname, '../../docs', `${source.file}.xml`);
  fs.writeFileSync(outputPath, xml, 'utf8');
  console.log(`Generated ${source.file}.xml with ${items.length} items`);
}

// ========== 生成总汇总 RSS ==========
function generateMasterRSS(allItems) {
  // 按时间排序
  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const itemsXml = allItems.slice(0, 100).map(item => `
    <item>
      <title>${escapeXml(`[${item.source}] ${item.title}`)}</title>
      <link>${escapeXml(item.link)}</link>
      <pubDate>${escapeXml(item.pubDate)}</pubDate>
      <description>${escapeXml(item.description)}</description>
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

  const outputPath = path.join(__dirname, '../../docs', 'feed.xml');
  fs.writeFileSync(outputPath, xml, 'utf8');
  console.log(`Generated master feed.xml with ${allItems.length} total items`);
}

// ========== 主函数 ==========
async function main() {
  // 创建 docs 目录（如果不存在）
  const docsDir = path.join(__dirname, '../../docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const allItems = [];

  for (const source of RSS_SOURCES) {
    console.log(`Fetching ${source.name}...`);
    const items = await fetchRSS(source.url);

    if (items.length > 0) {
      generateSingleRSS(source, items);

      // 提取条目加入总汇总
      items.slice(0, 5).forEach(item => {
        allItems.push({
          source: source.name,
          title: item.title[0],
          link: item.link[0],
          pubDate: item.pubDate[0] || '',
          description: (item.description && item.description[0]) || '',
        });
      });
    } else {
      console.log(`No items from ${source.name}`);
    }
  }

  generateMasterRSS(allItems);
  console.log('Done!');
}

main().catch(console.error);
