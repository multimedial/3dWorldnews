from flask import Flask, render_template, jsonify, request
import feedparser
import re
import spacy
from waitress import serve
from datetime import datetime

app = Flask(__name__)

# Load spaCy model for Named Entity Recognition (German)
try:
    nlp = spacy.load("de_core_news_sm")
except Exception:
    import spacy.cli

    spacy.cli.download("de_core_news_sm")
    nlp = spacy.load("de_core_news_sm")

# Coordinates mapping for common geopolitical locations
LOCATION_COORDS = {
    'Deutschland': {'lat': 51.1657, 'lng': 10.4515},
    'Berlin': {'lat': 52.5200, 'lng': 13.4050},
    'München': {'lat': 48.1351, 'lng': 11.5820},
    'Hamburg': {'lat': 53.5511, 'lng': 9.9937},
    'Frankfurt': {'lat': 50.1109, 'lng': 8.6821},
    'Köln': {'lat': 50.9375, 'lng': 6.9603},
    'Ukraine': {'lat': 48.3794, 'lng': 31.1656},
    'Kiew': {'lat': 50.4501, 'lng': 30.5234},
    'Russland': {'lat': 61.5240, 'lng': 105.3188},
    'Moskau': {'lat': 55.7558, 'lng': 37.6173},
    'USA': {'lat': 37.0902, 'lng': -95.7129},
    'Washington': {'lat': 38.9072, 'lng': -77.0369},
    'New York': {'lat': 40.7128, 'lng': -74.0060},
    'China': {'lat': 35.8617, 'lng': 104.1954},
    'Peking': {'lat': 39.9042, 'lng': 116.4074},
    'Israel': {'lat': 31.0461, 'lng': 34.8516},
    'Gaza': {'lat': 31.3547, 'lng': 34.3088},
    'Jerusalem': {'lat': 31.7683, 'lng': 35.2137},
    'Tel Aviv': {'lat': 32.0853, 'lng': 34.7818},
    'Frankreich': {'lat': 46.2276, 'lng': 2.2137},
    'Paris': {'lat': 48.8566, 'lng': 2.3522},
    'Großbritannien': {'lat': 55.3781, 'lng': -3.4360},
    'London': {'lat': 51.5074, 'lng': -0.1278},
    'Italien': {'lat': 41.8719, 'lng': 12.5674},
    'Rom': {'lat': 41.9028, 'lng': 12.4964},
    'Türkei': {'lat': 38.9637, 'lng': 35.2433},
    'Ankara': {'lat': 39.9334, 'lng': 32.8597},
    'Istanbul': {'lat': 41.0082, 'lng': 28.9784},
    'Syrien': {'lat': 34.8021, 'lng': 38.9968},
    'Damaskus': {'lat': 33.5138, 'lng': 36.2765},
    'Iran': {'lat': 32.4279, 'lng': 53.6880},
    'Teheran': {'lat': 35.6892, 'lng': 51.3890},
    'Polen': {'lat': 51.9194, 'lng': 19.1451},
    'Warschau': {'lat': 52.2297, 'lng': 21.0122},
    'Brüssel': {'lat': 50.8503, 'lng': 4.3517},
    'Belgien': {'lat': 50.5039, 'lng': 4.4699},
    'EU': {'lat': 50.8503, 'lng': 4.3517},
    'Ungarn': {'lat': 47.1625, 'lng': 19.5033},
    'Budapest': {'lat': 47.4979, 'lng': 19.0402},
    'Österreich': {'lat': 47.5162, 'lng': 14.5501},
    'Wien': {'lat': 48.2082, 'lng': 16.3738},
    'Schweiz': {'lat': 46.8182, 'lng': 8.2275},
    'Bern': {'lat': 46.9480, 'lng': 7.4474},
    'Japan': {'lat': 36.2048, 'lng': 138.2529},
    'Tokio': {'lat': 35.6762, 'lng': 139.6503},
    'Indien': {'lat': 20.5937, 'lng': 78.9629},
    'Neuwied': {'lat': 28.6139, 'lng': 77.2090},
    'Neu-Delhi': {'lat': 28.6139, 'lng': 77.2090}
}

FEEDS = {
    'tagesschau': {
        'url': 'https://www.tagesschau.de/xml/rss2/',
        'name': 'Tagesschau',
        'color': '#00a5e3',
        'favicon': 'https://www.tagesschau.de/favicon.ico'
    },
    'zdf': {
        'url': 'https://www.zdf.de/rss/zdf/nachrichten',
        'name': 'ZDF heute',
        'color': '#fa7d00',
        'favicon': 'https://www.zdf.de/favicon.ico'
    },
    'dw': {
        'url': 'https://rss.dw.com/xml/rss-de-all',
        'name': 'Deutsche Welle',
        'color': '#006699',
        'favicon': 'https://www.dw.com/favicon.ico'
    },
    'spiegel': {
        'url': 'https://www.spiegel.de/schlagzeilen/index.rss',
        'name': 'Spiegel',
        'color': '#e60000',
        'favicon': 'https://www.spiegel.de/favicon.ico'
    },
    'zeit': {
        'url': 'https://newsfeed.zeit.de/index',
        'name': 'ZEIT Online',
        'color': '#111111',
        'favicon': 'https://www.zeit.de/favicon.ico'
    },
    'faz': {
        'url': 'https://www.faz.net/rss/aktuell/',
        'name': 'FAZ',
        'color': '#183454',
        'favicon': 'https://www.faz.net/favicon.ico'
    }
}


def clean_html(text):
    if not text:
        return ""
    clean = re.compile('<.*?>')
    return re.sub(clean, '', text).strip()


def extract_image_url(entry):
    if 'media_content' in entry and len(entry.media_content) > 0:
        return entry.media_content[0].get('url', '')
    if 'media_thumbnail' in entry and len(entry.media_thumbnail) > 0:
        return entry.media_thumbnail[0].get('url', '')
    if 'enclosures' in entry and len(entry.enclosures) > 0:
        for enc in entry.enclosures:
            if enc.get('type', '').startswith('image'):
                return enc.get('href', '')
    if 'summary' in entry:
        img_match = re.search(r'<img [^>]*src=["\']([^"\']+)["\']', entry.summary)
        if img_match:
            return img_match.group(1)
    return ""


def extract_location(text):
    doc = nlp(text)
    for ent in doc.ents:
        if ent.label_ in ['LOC', 'GPE']:
            loc_name = ent.text.strip()
            if loc_name in LOCATION_COORDS:
                return loc_name, LOCATION_COORDS[loc_name]

    # Fallback keyword matching
    for loc_name, coords in LOCATION_COORDS.items():
        if loc_name in text:
            return loc_name, coords

    return "Deutschland", LOCATION_COORDS["Deutschland"]


def parse_feed_items(feed_key, limit):
    feed_info = FEEDS.get(feed_key)
    if not feed_info:
        return []

    parsed = feedparser.parse(feed_info['url'])
    items = []

    for entry in parsed.entries[:limit]:
        title = clean_html(entry.get('title', ''))
        summary = clean_html(entry.get('summary', entry.get('description', '')))

        full_text = f"{title} {summary}"
        loc_name, coords = extract_location(full_text)

        image_url = extract_image_url(entry)
        published = entry.get('published', entry.get('updated', ''))

        items.append({
            'title': title,
            'summary_text': summary[:200] + '...' if len(summary) > 200 else summary,
            'link': entry.get('link', '#'),
            'location': loc_name,
            'lat': coords['lat'],
            'lng': coords['lng'],
            'image': image_url,
            'time': published,
            'source': feed_info['name'],
            'color': feed_info['color'],
            'favicon': feed_info['favicon']
        })

    return items


def get_news_data(feed_filter='all', limit=30):
    all_news = []

    if feed_filter == 'all':
        items_per_feed = max(5, limit // len(FEEDS))
        for key in FEEDS.keys():
            all_news.extend(parse_feed_items(key, items_per_feed))
    else:
        all_news = parse_feed_items(feed_filter, limit)

    return all_news[:limit]


@app.route('/')
def index():
    feed = request.args.get('feed', 'all')
    try:
        limit = int(request.args.get('limit', 30))
    except ValueError:
        limit = 30

    news_data = get_news_data(feed_filter=feed, limit=limit)
    return render_template('index.html', news=news_data, current_feed=feed, current_limit=limit)


@app.route('/api/news')
def api_news():
    feed = request.args.get('feed', 'all')
    try:
        limit = int(request.args.get('limit', 30))
    except ValueError:
        limit = 30

    news_data = get_news_data(feed_filter=feed, limit=limit)
    return jsonify(news_data)


if __name__ == '__main__':
    serve(app, host='0.0.0.0', port=80, threads=8)