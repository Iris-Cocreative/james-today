/**
 * WorldClock — Reusable world clock gradient module
 * Extracted from world-clock/index.html
 *
 * Usage:
 *   WorldClock.render('my-container-id');
 *   WorldClock.startUpdates();
 */
(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // DATA
  // ──────────────────────────────────────────────

  const CITIES = [
    { name: 'Philadelphia', region: 'Pennsylvania', tz: 'America/New_York',    lat: 39.95,  lng: -75.17,  home: true },
    { name: 'California',   region: 'California',   tz: 'America/Los_Angeles', lat: 37.77,  lng: -122.42 },
    { name: 'Berlin',       region: 'Germany',       tz: 'Europe/Berlin',       lat: 52.52,  lng: 13.41 },
    { name: 'Thailand',     region: 'Thailand',      tz: 'Asia/Bangkok',        lat: 13.75,  lng: 100.52 },
    { name: 'Bali',         region: 'Indonesia',     tz: 'Asia/Makassar',       lat: -1.27,  lng: 116.83 },
  ];

  const HOME_TZ = 'America/New_York';

  const SUN_DATA = {
    'America/Los_Angeles': {
      rise: [7.18, 6.93, 7.28, 6.60, 6.10, 5.83, 6.00, 6.33, 6.72, 7.12, 6.55, 7.17],
      set:  [17.18, 17.77, 19.27, 19.80, 20.22, 20.52, 20.48, 20.05, 19.33, 18.55, 17.03, 16.85]
    },
    'America/New_York': {
      rise: [7.32, 6.97, 7.25, 6.42, 5.88, 5.53, 5.68, 6.10, 6.55, 7.02, 6.53, 7.13],
      set:  [16.95, 17.48, 19.10, 19.65, 20.08, 20.40, 20.35, 19.90, 19.17, 18.38, 16.82, 16.63]
    },
    'Europe/Berlin': {
      rise: [8.17, 7.47, 6.40, 6.20, 5.28, 4.83, 5.10, 5.80, 6.63, 7.47, 7.35, 8.15],
      set:  [16.17, 17.10, 18.08, 20.17, 21.02, 21.43, 21.33, 20.58, 19.45, 18.27, 16.17, 15.95]
    },
    'Asia/Bangkok': {
      rise: [6.70, 6.63, 6.37, 6.07, 5.87, 5.83, 5.93, 6.03, 6.05, 6.08, 6.22, 6.47],
      set:  [18.00, 18.20, 18.28, 18.35, 18.47, 18.58, 18.60, 18.45, 18.18, 17.90, 17.72, 17.73]
    },
    'Asia/Makassar': {
      rise: [5.73, 5.78, 5.72, 5.63, 5.63, 5.70, 5.73, 5.63, 5.40, 5.15, 5.02, 5.13],
      set:  [17.95, 17.98, 17.87, 17.68, 17.52, 17.47, 17.55, 17.62, 17.60, 17.57, 17.63, 17.80]
    }
  };

  // ──────────────────────────────────────────────
  // CORE FUNCTIONS
  // ──────────────────────────────────────────────

  function getNowInTz(tz) {
    return new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  }

  function getUtcOffsetHours(tz) {
    var str = new Date().toLocaleString('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
    var match = str.match(/GMT([+-]?\d+(?::\d+)?)?/);
    if (!match || !match[1]) return 0;
    var parts = match[1].split(':');
    var hours = parseInt(parts[0], 10);
    var minutes = parts[1] ? parseInt(parts[1], 10) : 0;
    return hours + (hours < 0 ? -minutes : minutes) / 60;
  }

  function getTzAbbr(tz) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    var p = parts.find(function (p) { return p.type === 'timeZoneName'; });
    return p ? p.value : '';
  }

  function getSunTimes(tz) {
    var now = getNowInTz(tz);
    var month = now.getMonth(), day = now.getDate();
    var daysInMonth = new Date(now.getFullYear(), month + 1, 0).getDate();
    var t = (day - 15) / daysInMonth;
    var next = (month + 1) % 12, prev = (month - 1 + 12) % 12;
    var data = SUN_DATA[tz];
    if (!data) return { sunrise: 6, sunset: 18 };
    var rise, set;
    if (t >= 0) {
      rise = data.rise[month] + (data.rise[next] - data.rise[month]) * t;
      set  = data.set[month]  + (data.set[next]  - data.set[month])  * t;
    } else {
      rise = data.rise[prev] + (data.rise[month] - data.rise[prev]) * (1 + t);
      set  = data.set[prev]  + (data.set[month]  - data.set[prev])  * (1 + t);
    }
    return { sunrise: rise, sunset: set };
  }

  function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  /**
   * Full gradient color mapping — verbatim from the original.
   * Returns [r, g, b] for a given decimal hour (0-24), sunrise, and sunset.
   */
  function getGradientColor(hour, sunrise, sunset) {
    // Twilight / transition zones
    var dawnStart    = sunrise - 1.8;   // twilight begins
    var dawnMid      = sunrise - 0.5;   // deep orange
    var morningGold  = sunrise + 0.8;   // golden hour ends
    var morningWarm  = sunrise + 2.0;   // warm light
    var dayStart     = sunrise + 3.0;   // full daylight blue begins
    var dayEnd       = sunset  - 3.0;   // full daylight blue ends
    var afternoonWarm = sunset - 2.0;   // warm light returns
    var duskGold     = sunset  - 0.8;   // golden hour starts
    var duskMid      = sunset  + 0.5;   // deep orange
    var duskEnd      = sunset  + 1.8;   // twilight ends

    // Color palette
    var night       = [6, 8, 28];
    var twilight    = [18, 22, 58];
    var earlyDawn   = [80, 40, 90];
    var dawnOrange  = [220, 100, 50];
    var sunriseGold = [248, 180, 80];
    var morningLight = [255, 230, 170];
    var dayWarm     = [200, 225, 245];
    var midday      = [130, 195, 235];
    var pmLight     = [255, 225, 160];
    var duskGoldC   = [250, 165, 60];
    var duskDeep    = [200, 80, 70];
    var eveningTwi  = [60, 30, 80];

    if (hour < dawnStart || hour > duskEnd) {
      // Deep night
      return night;
    } else if (hour < dawnMid) {
      // Night -> twilight -> early dawn
      var span = dawnMid - dawnStart;
      var t = (hour - dawnStart) / span;
      if (t < 0.5) {
        var t2 = t * 2;
        return [lerp(night[0], twilight[0], t2), lerp(night[1], twilight[1], t2), lerp(night[2], twilight[2], t2)];
      } else {
        var t2 = (t - 0.5) * 2;
        return [lerp(twilight[0], earlyDawn[0], t2), lerp(twilight[1], earlyDawn[1], t2), lerp(twilight[2], earlyDawn[2], t2)];
      }
    } else if (hour < sunrise) {
      // Early dawn -> dawn orange
      var t = (hour - dawnMid) / (sunrise - dawnMid);
      return [lerp(earlyDawn[0], dawnOrange[0], t), lerp(earlyDawn[1], dawnOrange[1], t), lerp(earlyDawn[2], dawnOrange[2], t)];
    } else if (hour < morningGold) {
      // Dawn orange -> sunrise gold
      var t = (hour - sunrise) / (morningGold - sunrise);
      return [lerp(dawnOrange[0], sunriseGold[0], t), lerp(dawnOrange[1], sunriseGold[1], t), lerp(dawnOrange[2], sunriseGold[2], t)];
    } else if (hour < morningWarm) {
      // Gold -> warm light
      var t = (hour - morningGold) / (morningWarm - morningGold);
      return [lerp(sunriseGold[0], morningLight[0], t), lerp(sunriseGold[1], morningLight[1], t), lerp(sunriseGold[2], morningLight[2], t)];
    } else if (hour < dayStart) {
      // Warm -> blue transition
      var t = (hour - morningWarm) / (dayStart - morningWarm);
      return [lerp(morningLight[0], dayWarm[0], t), lerp(morningLight[1], dayWarm[1], t), lerp(morningLight[2], dayWarm[2], t)];
    } else if (hour <= dayEnd) {
      // Expanded midday blue - gentle parabola
      var mid = (dayStart + dayEnd) / 2;
      var halfSpan = (dayEnd - dayStart) / 2;
      if (halfSpan > 0) {
        var t = Math.abs(hour - mid) / halfSpan;
        return [lerp(midday[0], dayWarm[0], t), lerp(midday[1], dayWarm[1], t), lerp(midday[2], dayWarm[2], t)];
      }
      return midday;
    } else if (hour < afternoonWarm) {
      // Blue -> warm transition
      var t = (hour - dayEnd) / (afternoonWarm - dayEnd);
      return [lerp(dayWarm[0], pmLight[0], t), lerp(dayWarm[1], pmLight[1], t), lerp(dayWarm[2], pmLight[2], t)];
    } else if (hour < duskGold) {
      // Warm -> dusk gold
      var t = (hour - afternoonWarm) / (duskGold - afternoonWarm);
      return [lerp(pmLight[0], duskGoldC[0], t), lerp(pmLight[1], duskGoldC[1], t), lerp(pmLight[2], duskGoldC[2], t)];
    } else if (hour < sunset) {
      // Dusk gold -> dusk deep
      var t = (hour - duskGold) / (sunset - duskGold);
      return [lerp(duskGoldC[0], duskDeep[0], t), lerp(duskGoldC[1], duskDeep[1], t), lerp(duskGoldC[2], duskDeep[2], t)];
    } else if (hour < duskMid) {
      // Dusk deep -> evening twilight
      var t = (hour - sunset) / (duskMid - sunset);
      return [lerp(duskDeep[0], eveningTwi[0], t), lerp(duskDeep[1], eveningTwi[1], t), lerp(duskDeep[2], eveningTwi[2], t)];
    } else {
      // Evening twilight -> twilight -> night
      var span = duskEnd - duskMid;
      var t = (hour - duskMid) / span;
      if (t < 0.5) {
        var t2 = t * 2;
        return [lerp(eveningTwi[0], twilight[0], t2), lerp(eveningTwi[1], twilight[1], t2), lerp(eveningTwi[2], twilight[2], t2)];
      } else {
        var t2 = (t - 0.5) * 2;
        return [lerp(twilight[0], night[0], t2), lerp(twilight[1], night[1], t2), lerp(twilight[2], night[2], t2)];
      }
    }
  }

  /**
   * Draws the gradient timeline on a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {string} tz - IANA timezone
   * @param {number} startHour - hour offset for the left edge of the bar
   */
  function drawTimeline(canvas, tz, startHour) {
    var dpr = window.devicePixelRatio || 1;
    var W = canvas.clientWidth, H = canvas.clientHeight;
    if (W === 0 || H === 0) return;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    var sunTimes = getSunTimes(tz);
    var sunrise = sunTimes.sunrise, sunset = sunTimes.sunset;

    for (var px = 0; px < W; px++) {
      var localHour = startHour + (px / W) * 24;
      var hour = ((localHour % 24) + 24) % 24;
      var rgb = getGradientColor(hour, sunrise, sunset);
      ctx.fillStyle = 'rgb(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]) + ')';
      ctx.fillRect(px, 0, 1, H);
    }

    // Subtle hour markers
    for (var i = 0; i <= 24; i++) {
      var x = (i / 24) * W;
      var localH = startHour + i;
      var normH = ((Math.round(localH) % 24) + 24) % 24;
      var isMajor = normH % 3 === 0;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────

  // Track state for updates
  var _containerId = null;
  var _updateTimerId = null;
  var _redrawTimerId = null;
  var _resizeTimeout = null;

  /**
   * Order cities: Philadelphia (home) first, then Berlin, Thailand, Bali, California (bottom).
   */
  function getOrderedCities() {
    var home = null;
    var rest = [];
    for (var i = 0; i < CITIES.length; i++) {
      if (CITIES[i].home) { home = CITIES[i]; }
      else { rest.push(CITIES[i]); }
    }
    // Order: Berlin, Thailand, Bali, California (PST at bottom)
    var order = ['Europe/Berlin', 'Asia/Bangkok', 'Asia/Makassar', 'America/Los_Angeles'];
    rest.sort(function (a, b) {
      return order.indexOf(a.tz) - order.indexOf(b.tz);
    });
    return [home].concat(rest);
  }

  function formatTime12(date) {
    var h = date.getHours();
    var m = date.getMinutes().toString().padStart(2, '0');
    var s = date.getSeconds().toString().padStart(2, '0');
    var ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return h + ':' + m + ':' + s + ' ' + ampm;
  }

  function formatHourLabel(decimalHour) {
    var h = ((Math.round(decimalHour) % 24) + 24) % 24;
    if (h === 0) return '12a';
    if (h === 12) return '12p';
    if (h < 12) return h + 'a';
    return (h - 12) + 'p';
  }

  /**
   * Renders the complete world clock widget into a container.
   * @param {string} containerId - DOM element ID to render into
   */
  function render(containerId) {
    _containerId = containerId;
    var container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    container.classList.add('world-clock');

    var homeOffset = getUtcOffsetHours(HOME_TZ);
    var ordered = getOrderedCities();

    // Wrapper for all bars (needed for now-line positioning)
    var barsWrap = document.createElement('div');
    barsWrap.className = 'wc-bars-wrap';
    barsWrap.style.position = 'relative';

    // Track home bar element for hour labels placement
    var homeBarEl = null;
    var homeLabelContainer = null;

    for (var ci = 0; ci < ordered.length; ci++) {
      var city = ordered[ci];
      var isHome = !!city.home;
      var offset = getUtcOffsetHours(city.tz);
      var rel = offset - homeOffset;
      var tzAbbr = getTzAbbr(city.tz);
      var startHour = offset - homeOffset;

      // Bar container
      var bar = document.createElement('div');
      bar.className = 'wc-bar' + (isHome ? ' home' : '');
      bar.setAttribute('data-tz', city.tz);

      // For non-home: label row
      if (!isHome) {
        var labelRow = document.createElement('div');
        labelRow.className = 'wc-bar-label';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'wc-bar-label-name';
        nameSpan.textContent = city.name;
        labelRow.appendChild(nameSpan);

        var abbrSpan = document.createElement('span');
        abbrSpan.className = 'wc-bar-label-abbr';
        abbrSpan.textContent = tzAbbr;
        labelRow.appendChild(abbrSpan);

        if (rel !== 0) {
          var offSpan = document.createElement('span');
          offSpan.className = 'wc-bar-label-offset' + (rel > 0 ? ' positive' : ' negative');
          offSpan.textContent = (rel > 0 ? '+' : '') + rel + 'h';
          labelRow.appendChild(offSpan);
        }
        bar.appendChild(labelRow);
      }

      // For home: label + clock row
      if (isHome) {
        var homeRow = document.createElement('div');
        homeRow.className = 'wc-bar-label home';
        var hName = document.createElement('span');
        hName.className = 'wc-bar-label-name';
        hName.textContent = city.name;
        homeRow.appendChild(hName);
        var hAbbr = document.createElement('span');
        hAbbr.className = 'wc-bar-label-abbr';
        hAbbr.textContent = tzAbbr;
        homeRow.appendChild(hAbbr);
        var hTag = document.createElement('span');
        hTag.className = 'wc-bar-label-home-tag';
        hTag.textContent = 'HOME';
        homeRow.appendChild(hTag);

        var hClock = document.createElement('span');
        hClock.className = 'wc-clock';
        hClock.setAttribute('data-tz', city.tz);
        homeRow.appendChild(hClock);

        bar.appendChild(homeRow);
      }

      // Gradient canvas wrapper
      var gradWrap = document.createElement('div');
      gradWrap.className = 'wc-gradient-wrap';
      gradWrap.setAttribute('data-tz', city.tz);
      gradWrap.setAttribute('data-start-hour', startHour);

      var canvas = document.createElement('canvas');
      canvas.className = 'wc-canvas';
      gradWrap.appendChild(canvas);

      bar.appendChild(gradWrap);
      barsWrap.appendChild(bar);

      if (isHome) {
        homeBarEl = bar;
        // Hour labels container — placed after home bar
        homeLabelContainer = document.createElement('div');
        homeLabelContainer.className = 'wc-hour-labels';
        homeLabelContainer.setAttribute('data-tz', city.tz);
        barsWrap.appendChild(homeLabelContainer);
      }
    }

    // Now-line (spans all bars)
    var nowLine = document.createElement('div');
    nowLine.className = 'wc-now-line';
    var capTop = document.createElement('div');
    capTop.className = 'wc-now-cap top';
    var capBot = document.createElement('div');
    capBot.className = 'wc-now-cap bottom';
    nowLine.appendChild(capTop);
    nowLine.appendChild(capBot);
    barsWrap.appendChild(nowLine);

    container.appendChild(barsWrap);

    // Initial draw
    _drawAll();
    _updateNow();

    // Setup drag on now-line
    _setupNowLineDrag(nowLine, barsWrap, container);
  }

  var _isDraggingNowLine = false;

  function _setupNowLineDrag(nowLine, barsWrap, container) {
    nowLine.addEventListener('mousedown', function (e) {
      e.preventDefault();
      _isDraggingNowLine = true;
      nowLine.classList.add('dragging');

      // Create tooltip
      var tooltip = document.createElement('div');
      tooltip.className = 'wc-drag-tooltip';
      nowLine.appendChild(tooltip);

      var homeWrap = container.querySelector('.wc-gradient-wrap[data-tz="' + HOME_TZ + '"]');
      if (!homeWrap) return;

      function updateDragPos(clientX) {
        var wrapRect = homeWrap.getBoundingClientRect();
        var barsRect = barsWrap.getBoundingClientRect();
        var relX = clientX - wrapRect.left;
        var pct = Math.max(0, Math.min(1, relX / wrapRect.width));
        var hour = pct * 24;

        var xPos = (wrapRect.left - barsRect.left) + relX;
        nowLine.style.left = xPos + 'px';

        // Format time for tooltip
        var h = Math.floor(hour);
        var m = Math.round((hour - h) * 60);
        if (m === 60) { h++; m = 0; }
        var ampm = h >= 12 ? 'pm' : 'am';
        var h12 = h % 12 || 12;
        tooltip.textContent = h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
      }

      updateDragPos(e.clientX);

      function onMove(e) {
        updateDragPos(e.clientX);
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        _isDraggingNowLine = false;
        nowLine.classList.remove('dragging');
        if (tooltip.parentNode) tooltip.remove();
        // Snap back to real time
        _updateNow();
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  /**
   * Draw all gradient canvases, sun/moon icons, date markers, and hour labels.
   */
  function _drawAll() {
    if (!_containerId) return;
    var container = document.getElementById(_containerId);
    if (!container) return;

    var homeOffset = getUtcOffsetHours(HOME_TZ);

    // Draw each gradient bar
    var wraps = container.querySelectorAll('.wc-gradient-wrap');
    for (var i = 0; i < wraps.length; i++) {
      var wrap = wraps[i];
      var tz = wrap.getAttribute('data-tz');
      var startHour = parseFloat(wrap.getAttribute('data-start-hour'));
      var canvas = wrap.querySelector('.wc-canvas');
      if (!canvas) continue;

      drawTimeline(canvas, tz, startHour);

      // Remove old overlays
      var oldIcons = wrap.querySelectorAll('.wc-date-marker');
      for (var j = 0; j < oldIcons.length; j++) oldIcons[j].remove();

      // Date change marker (midnight crossing)
      var midnightPos = startHour <= 0 ? -startHour / 24 : (24 - startHour) / 24;
      if (midnightPos > 0.01 && midnightPos < 0.99) {
        var homeNow = getNowInTz(HOME_TZ);
        var homeToday = new Date(homeNow.getFullYear(), homeNow.getMonth(), homeNow.getDate());
        var timelineStartDate = new Date(homeToday);
        if (startHour < 0) timelineStartDate.setDate(timelineStartDate.getDate() - 1);
        var crossingDate = new Date(timelineStartDate);
        crossingDate.setDate(crossingDate.getDate() + 1);

        var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        var dc = document.createElement('div');
        dc.className = 'wc-date-marker';
        dc.style.left = (midnightPos * 100) + '%';
        var lbl = document.createElement('div');
        lbl.className = 'wc-date-marker-label';
        lbl.textContent = dayNames[crossingDate.getDay()] + ' ' + monthNames[crossingDate.getMonth()] + ' ' + crossingDate.getDate();
        dc.appendChild(lbl);
        wrap.appendChild(dc);
      }
    }

    // Hour labels (every hour) below home bar
    var labelsContainer = container.querySelector('.wc-hour-labels');
    if (labelsContainer) {
      labelsContainer.innerHTML = '';
      var homeTz = labelsContainer.getAttribute('data-tz');
      // Home bar startHour is always 0 (home offset - home offset)
      for (var h = 0; h <= 24; h++) {
        var lbl = document.createElement('span');
        lbl.className = 'wc-hour-label';
        lbl.textContent = formatHourLabel(h);
        lbl.style.left = ((h / 24) * 100) + '%';
        labelsContainer.appendChild(lbl);
      }
    }
  }

  /**
   * Update the now-line position and clock display.
   */
  function _updateNow() {
    if (!_containerId) return;
    if (_isDraggingNowLine) return; // Don't fight the drag
    var container = document.getElementById(_containerId);
    if (!container) return;

    var homeNow = getNowInTz(HOME_TZ);
    var currentHour = homeNow.getHours() + homeNow.getMinutes() / 60 + homeNow.getSeconds() / 3600;
    var nowPct = currentHour / 24;

    // Position now-line relative to the home bar canvas
    var homeWrap = container.querySelector('.wc-gradient-wrap[data-tz="' + HOME_TZ + '"]');
    var nowLine = container.querySelector('.wc-now-line');
    if (homeWrap && nowLine) {
      var barsWrap = container.querySelector('.wc-bars-wrap');
      var wrapRect = homeWrap.getBoundingClientRect();
      var barsRect = barsWrap.getBoundingClientRect();
      var xPos = (wrapRect.left - barsRect.left) + wrapRect.width * nowPct;
      nowLine.style.left = xPos + 'px';
    }

    // Update home clock
    var clockEl = container.querySelector('.wc-clock[data-tz="' + HOME_TZ + '"]');
    if (clockEl) {
      clockEl.textContent = formatTime12(homeNow);
    }
  }

  // ──────────────────────────────────────────────
  // UPDATE LOOP
  // ──────────────────────────────────────────────

  function startUpdates() {
    stopUpdates();
    // 1-second interval for now-line + clock
    _updateTimerId = setInterval(function () { _updateNow(); }, 1000);
    // 60-second interval for gradient redraws
    _redrawTimerId = setInterval(function () { _drawAll(); }, 60000);

    // Resize handler
    window.addEventListener('resize', _onResize);
  }

  function stopUpdates() {
    if (_updateTimerId) { clearInterval(_updateTimerId); _updateTimerId = null; }
    if (_redrawTimerId) { clearInterval(_redrawTimerId); _redrawTimerId = null; }
    window.removeEventListener('resize', _onResize);
  }

  function _onResize() {
    clearTimeout(_resizeTimeout);
    _resizeTimeout = setTimeout(function () {
      _drawAll();
      _updateNow();
    }, 100);
  }

  // ──────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────

  window.WorldClock = {
    // Data
    CITIES: CITIES,
    SUN_DATA: SUN_DATA,
    HOME_TZ: HOME_TZ,

    // Core functions
    getNowInTz: getNowInTz,
    getSunTimes: getSunTimes,
    getGradientColor: getGradientColor,
    drawTimeline: drawTimeline,

    // Render
    render: render,

    // Updates
    startUpdates: startUpdates,
    stopUpdates: stopUpdates
  };
})();
