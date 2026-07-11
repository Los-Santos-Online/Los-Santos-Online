import {prisma} from '../../main.js'

/**
 * Handler for getting news items list
 * Returns news.json format with gm.evt structure
 */
export async function getNewsItemsHandler(req, res) {
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Get active news items that haven't expired
    const newsItems = await prisma.news.findMany({
      where: {
        active: true,
        date: {
          lte: currentTime // News item is already active
        },
        OR: [
          { expire: 0 }, // Never expires
          { expire: { gt: currentTime } } // Not yet expired
        ]
      },
      orderBy: [
        { priority: 'desc' },
        { secondaryPriority: 'desc' },
        { date: 'desc' }
      ]
    });

    // Transform to news.json format
    const newsResponse = newsItems.map(item => ({
      "gm.evt": {
        "e": "news",
        "d": {
          "ts": item.date,
          "exp": item.expire,
          "t": item.types,
          "k": item.storyKey,
          "p": item.priority,
          "sp": item.secondaryPriority,
          "sk": item.trackingId
        }
      }
    }));

    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(newsResponse));
  } catch (error) {
    console.error("Error fetching news items:", error);
    res.status(500).send(JSON.stringify({ error: "Internal server error" }));
  }
}


/**
 * Handler for getting individual news story content
 * Returns story content in the format expected by sc/news/{story_key}/{language}.json
 */
export async function getNewsStoryHandler(req, res) {
  try {
    const { storyKey, langFile } = req.params;
    
    const newsItem = await prisma.news.findFirst({
      where: {
        storyKey: storyKey,
        active: true
      }
    });

    if (!newsItem) {
      return res.status(404).send(JSON.stringify({ error: "News story not found" }));
    }

    const currentTime = Math.floor(Date.now() / 1000);
    
    // Check if news item is active and not expired
    if (newsItem.date > currentTime || (newsItem.expire > 0 && newsItem.expire < currentTime)) {
      return res.status(404).send(JSON.stringify({ error: "News story not available" }));
    }

    // Build response object
    const response = {
      types: newsItem.types,
      date: newsItem.date,
      expire: newsItem.expire,
      title: newsItem.title,
      content: newsItem.content,
      style: newsItem.style,
      priority: newsItem.priority,
      secondaryPriority: newsItem.secondaryPriority,
      trackingId: newsItem.trackingId
    };

    // Add optional fields if they exist
    if (newsItem.headline) response.headline = newsItem.headline;
    if (newsItem.subtitle) response.subtitle = newsItem.subtitle;
    if (newsItem.url) response.url = newsItem.url;
    
    // Add image data if available
    if (newsItem.imagePath) {
      response.image = {
        path: newsItem.imagePath,
        filesize: newsItem.imageFilesize || 0,
        type: newsItem.imageType || "portrait"
      };
    }

    // Add extra data if available
    if (newsItem.extraData) {
      response.extraData = newsItem.extraData;
    }

    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(response));
  } catch (error) {
    console.error("Error fetching news story:", error);
    res.status(500).send(JSON.stringify({ error: "Internal server error" }));
  }
}