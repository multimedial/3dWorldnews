let currentLimit = window.CURRENT_LIMIT || 30;
const REFRESH_INTERVAL_MS = 60000;
const DEFAULT_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='337' viewBox='0 0 600 337'><defs><linearGradient id='tsGrad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23001e34'/><stop offset='50%' stop-color='%23003358'/><stop offset='100%' stop-color='%23004577'/></linearGradient><linearGradient id='glow' x1='0%' y1='0%' x2='100%' y2='0%'><stop offset='0%' stop-color='%2300a5e3' stop-opacity='0'/><stop offset='50%' stop-color='%2300a5e3' stop-opacity='0.6'/><stop offset='100%' stop-color='%2300a5e3' stop-opacity='0'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23tsGrad)'/><circle cx='300' cy='168' r='90' fill='none' stroke='%2300a5e3' stroke-width='1.5' opacity='0.25'/><circle cx='300' cy='168' r='130' fill='none' stroke='%2300a5e3' stroke-width='1' opacity='0.15'/><path d='M300 78a138 138 0 0 1 0 180a138 138 0 0 1 0-180z' fill='none' stroke='%2300a5e3' stroke-width='1.5' opacity='0.25'/><line x1='150' y1='168' x2='450' y2='168' stroke='url(%23glow)' stroke-width='2'/><text x='50%' y='48%' font-family='System-UI, -apple-system, sans-serif' font-size='28' font-weight='700' fill='%23ffffff' text-anchor='middle' dominant-baseline='middle' letter-spacing='-0.5'>NEWS</text></svg>";

const globeContainer = document.getElementById('globe-container');
const infoWindow = document.getElementById('info-window');

let minTimestamp = 0;
let maxTimestamp = 0;

function formatGermanDate(timeStr) {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;

    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffMinutes >= 0 && diffMinutes < 60) {
        return diffMinutes === 0 ? 'Gerade eben' : `Vor ${diffMinutes} Min.`;
    }

    return new Intl.DateTimeFormat('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date) + ' Uhr';
}

function updateTimeRange(newsData) {
    const timestamps = newsData
        .map(d => Date.parse(d.time))
        .filter(ts => !isNaN(ts));

    if (timestamps.length > 0) {
        minTimestamp = Math.min(...timestamps);
        maxTimestamp = Math.max(...timestamps);
    } else {
        minTimestamp = 0;
        maxTimestamp = 0;
    }
}

const initialNews = window.INITIAL_NEWS || [];
updateTimeRange(initialNews);

const globe = Globe()(globeContainer)
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
    .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
    .htmlElementsData(initialNews)
    .htmlLat(d => d.lat)
    .htmlLng(d => d.lng)
    .htmlAltitude(0.01)
    .htmlTransitionDuration(0)
    .htmlElement(d => createMarkerElement(d));

const controls = globe.controls();
controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;

controls.addEventListener('change', () => {
    if (globe.htmlElementsData) {
        globe.htmlElementsData(globe.htmlElementsData());
    }
});

globeContainer.addEventListener('mouseenter', () => controls.autoRotate = false);
globeContainer.addEventListener('mouseleave', () => controls.autoRotate = true);

window.closeInfoWindow = function() {
    infoWindow.style.display = 'none';
};

function calculateOpacity(timeStr) {
    const ts = Date.parse(timeStr);
    if (isNaN(ts) || maxTimestamp === minTimestamp) {
        return 1.0;
    }
    const minOpacity = 0.10;
    const maxOpacity = 1.0;

    const linearFactor = (ts - minTimestamp) / (maxTimestamp - minTimestamp);
    const expFactor = Math.pow(linearFactor, 2);

    return minOpacity + (expFactor * (maxOpacity - minOpacity));
}

function createMarkerElement(d) {
    const img = document.createElement('img');
    img.className = 'ts-marker-icon';
    img.src = d.favicon;
    img.alt = d.source || 'News';

    img.style.opacity = calculateOpacity(d.time);
    const markerColor = d.color || '#00a5e3';

    img.onclick = (e) => {
        e.stopPropagation();
        const imgSrc = (d.image && d.image.trim() !== "") ? d.image : DEFAULT_SVG;
        const formattedTime = formatGermanDate(d.time);

        infoWindow.style.borderTopColor = markerColor;

        infoWindow.innerHTML = `
            <div class="ts-card-img-container">
                <button class="ts-card-close" onclick="window.closeInfoWindow()">✕</button>
                <img src="${imgSrc}" onerror="this.onerror=null; this.src='${DEFAULT_SVG}';">
                <div class="ts-logo-badge" style="border-color: ${markerColor}">
                    <img src="${d.favicon}" style="width: 14px; height: 14px; object-fit: contain;">
                    ${d.source || 'NEWS'}
                </div>
            </div>
            <div class="ts-card-body">
                <div class="ts-meta" style="color: ${markerColor}">${d.location} ${formattedTime ? '• ' + formattedTime : ''}</div>
                <h4>${d.title}</h4>
                <p>${d.summary_text}</p>
                <a class="ts-btn" style="background: ${markerColor}" href="${d.link}" target="_blank">Artikel lesen</a>
            </div>
        `;

        infoWindow.style.left = Math.min(e.clientX + 15, window.innerWidth - 360) + 'px';
        infoWindow.style.top = Math.min(e.clientY - 20, window.innerHeight - 500) + 'px';
        infoWindow.style.display = 'block';
    };
    return img;
}

window.toggleDropdown = function(e) {
    e.stopPropagation();
    document.getElementById('dropdown-menu').classList.toggle('show');
};

function getSelectedFeedString() {
    const checked = Array.from(document.querySelectorAll('.feed-cb:checked')).map(cb => cb.value);
    return checked.length > 0 ? checked.join(',') : 'none';
}

function updateDropdownLabel() {
    const checkedCount = document.querySelectorAll('.feed-cb:checked').length;
    const totalCount = document.querySelectorAll('.feed-cb').length;
    const label = document.getElementById('dropdown-label');

    if (!label) return;

    if (checkedCount === totalCount) {
        label.innerText = 'Alle Feeds';
    } else if (checkedCount === 0) {
        label.innerText = 'Kein Feed gewählt';
    } else {
        label.innerText = `${checkedCount} Feed${checkedCount > 1 ? 's' : ''} aktiv`;
    }
}

window.toggleCountry = function(countryCode) {
    const checkboxes = document.querySelectorAll(`.country-${countryCode}`);
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateDropdownLabel();
    refreshFeed();
};

window.selectAllFeeds = function(status) {
    document.querySelectorAll('.feed-cb').forEach(cb => cb.checked = status);
    updateDropdownLabel();
    refreshFeed();
};

function resetProgressBar() {
    const bar = document.getElementById('progress-bar');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.width = '100%';
    void bar.offsetWidth;
    bar.style.transition = `width ${REFRESH_INTERVAL_MS}ms linear`;
    bar.style.width = '0%';
}

async function refreshFeed() {
    resetProgressBar();
    const selectedFeed = getSelectedFeedString();

    if (selectedFeed === 'none') {
        globe.htmlElementsData([]);
        const countBadge = document.getElementById('marker-count');
        if (countBadge) countBadge.innerText = `0 Meldungen geladen`;
        return;
    }

    try {
        const response = await fetch(`/api/news?limit=${currentLimit}&feed=${encodeURIComponent(selectedFeed)}`);
        if (!response.ok) return;

        const updatedNews = await response.json();
        updateTimeRange(updatedNews);
        globe.htmlElementsData(updatedNews);

        const countBadge = document.getElementById('marker-count');
        if (countBadge) countBadge.innerText = `${updatedNews.length} Meldungen geladen`;
    } catch (err) {
        console.error("Fehler beim Abrufen der Feed-Daten:", err);
    }
}

window.changeFeedLimit = function(newLimit) {
    currentLimit = newLimit;
    refreshFeed();
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.feed-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            updateDropdownLabel();
            refreshFeed();
        });
    });

    updateDropdownLabel();
    refreshFeed();
});

setInterval(refreshFeed, REFRESH_INTERVAL_MS);

document.addEventListener('click', () => {
    const menu = document.getElementById('dropdown-menu');
    if (menu) menu.classList.remove('show');
    window.closeInfoWindow();
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const menu = document.getElementById('dropdown-menu');
        if (menu) menu.classList.remove('show');
        window.closeInfoWindow();
    }
});