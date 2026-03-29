# World Clock

A beautiful, gradient-based world clock widget that visualizes daylight across timezones.

![Dark theme with aligned gradient timelines showing sunrise/sunset across 5 timezones](https://img.shields.io/badge/status-active-brightgreen)

## Features

- **Daylight gradients** — Each timezone displays a 24-hour gradient bar showing night, twilight, sunrise, daylight, sunset with smooth color transitions
- **Aligned timelines** — All timezone bars are synchronized so the "now" indicator lines up vertically across all rows
- **Sunrise/sunset markers** — Visual indicators for sunrise and sunset positions
- **Date change markers** — Teal midnight markers show where the date changes
- **Responsive** — Scales to any window size
- **Toggle controls:**
  - 12h / 24h time format
  - Home timezone on top
  - Collapse non-home zones to thin bars
  - Solo mode (show only home timezone)

## Usage

### Browser
Open `index.html` in any modern browser.

### GitHub Pages
Fork this repo, enable GitHub Pages in Settings → Pages → Source: main branch, and visit your Pages URL.

### Desktop Widget (Windows)
To run as an always-on-top desktop widget:

**Option A — PowerShell + Edge/Chrome (recommended):**
Double-click `start.bat`

**Option B — Python + pywebview:**
```bash
pip install pywebview pywin32
python launch.py
```

## Customization

Edit the `CITIES` array near the top of the `<script>` section in `index.html` to change timezones:

```js
const CITIES = [
  { name: 'California', tz: 'America/Los_Angeles', lat: 37.77, lng: -122.42 },
  { name: 'Philadelphia', tz: 'America/New_York', lat: 39.95, lng: -75.17, home: true },
  { name: 'Berlin', tz: 'Europe/Berlin', lat: 52.52, lng: 13.41 },
  // Add your own...
];
```

- `name` — Display label
- `tz` — IANA timezone identifier
- `lat` / `lng` — Coordinates (used for sunrise/sunset gradient accuracy)
- `home: true` — Set one timezone as home (offsets are relative to this)

You'll also need to add sunrise/sunset data in the `SUN_DATA` object for accurate daylight gradients. Each entry has 12 monthly values (mid-month) for sunrise and sunset in decimal hours (local time).

## Fonts

Uses [Neue Kabel](https://fonts.adobe.com/fonts/neue-kabel) (sans-serif) and [Loretta](https://fonts.adobe.com/fonts/loretta) (serif) via Adobe Fonts/TypeKit.

## License

MIT
