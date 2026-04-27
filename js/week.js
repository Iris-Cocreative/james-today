/* ============================================================
   week.js — Week section: 7-day cards + mini calendar
   Renders into #week-section. Listens to Data.dataChanged.
   Drag-from-task → drop-on-day handler uses the existing
   `text/task-id` payload set by app.js (line 1859).
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     Constants
     ============================================================ */

  var HABIT_ORDER = ['sleep', 'meditation', 'movement', 'home', 'nutrition', 'learning'];
  var DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var WEEKDAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  // Mini-cal layout
  var HOUR_PX = 26;
  var VISIBLE_START = 9;
  var CONTENT_START = 7;
  var CONTENT_END = 24;
  var CONTENT_HEIGHT = (CONTENT_END - CONTENT_START) * HOUR_PX;
  var DEFAULT_SCROLL = (VISIBLE_START - CONTENT_START) * HOUR_PX;

  /* Phosphor habit icons — outlined (todo) and filled (done).
     For done variants, fill="currentColor" lives on the parent SVG so
     paths inherit the CSS color while <rect fill="none"> stays transparent. */
  var HABIT_ICONS = {
    sleep: {
      todo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="208" y1="120" x2="208" y2="72" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="232" y1="96" x2="184" y2="96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="160" y1="32" x2="160" y2="64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="176" y1="48" x2="144" y2="48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><path d="M210.69,158.18A96.78,96.78,0,0,1,192,160,96.08,96.08,0,0,1,97.82,45.31,88,88,0,1,0,210.69,158.18Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/></svg>',
      done: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><rect width="256" height="256" fill="none"/><path d="M240,96a8,8,0,0,1-8,8H216v16a8,8,0,0,1-16,0V104H184a8,8,0,0,1,0-16h16V72a8,8,0,0,1,16,0V88h16A8,8,0,0,1,240,96ZM144,56h8v8a8,8,0,0,0,16,0V56h8a8,8,0,0,0,0-16h-8V32a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16Zm65.14,94.33A88.07,88.07,0,0,1,105.67,46.86a8,8,0,0,0-10.6-9.06A96,96,0,1,0,218.2,160.93a8,8,0,0,0-9.06-10.6Z"/></svg>'
    },
    meditation: {
      todo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><circle cx="128" cy="176" r="10" fill="currentColor"/><path d="M128,224a48,48,0,0,1,0-96,48,48,0,0,0,0-96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><circle cx="128" cy="80" r="10" fill="currentColor"/></svg>',
      done: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><rect width="256" height="256" fill="none"/><path d="M140,80a12,12,0,1,1-12-12A12,12,0,0,1,140,80Zm92,48A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-92,48a12,12,0,1,0-12,12A12,12,0,0,0,140,176Zm32-92a44.05,44.05,0,0,0-44-44A88,88,0,0,0,81.09,202.42,52,52,0,0,1,128,128,44.05,44.05,0,0,0,172,84Z"/></svg>'
    },
    movement: {
      todo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,80a16,16,0,0,0-16-16H152l56,96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><circle cx="208" cy="160" r="40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><circle cx="48" cy="160" r="40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><polyline points="48 64 76 64 132 160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><polyline points="170.67 96 94.67 96 48 160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/></svg>',
      done: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><rect width="256" height="256" fill="none"/><path d="M54.46,164.71,82.33,126.5a48,48,0,1,1-12.92-9.44L41.54,155.29a8,8,0,1,0,12.92,9.42ZM208,112a47.81,47.81,0,0,0-16.93,3.09L214.91,156A8,8,0,1,1,201.09,164l-23.83-40.86A48,48,0,1,0,208,112ZM165.93,72H192a8,8,0,0,1,8,8,8,8,0,0,0,16,0,24,24,0,0,0-24-24H152a8,8,0,0,0-6.91,12l11.65,20H99.26L82.91,60A8,8,0,0,0,76,56H48a8,8,0,0,0,0,16H71.41L85.12,95.51,69.41,117.06a47.87,47.87,0,0,1,12.92,9.44l11.59-15.9L125.09,164A8,8,0,1,0,138.91,156l-30.32-52h57.48l11.19,19.17a48.11,48.11,0,0,1,13.81-8.08Z"/></svg>'
    },
    home: {
      todo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="16" y1="216" x2="240" y2="216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><polyline points="152 216 152 152 104 152 104 216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="40" y1="116.69" x2="40" y2="216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="216" y1="216" x2="216" y2="116.69" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><path d="M24,132.69l98.34-98.35a8,8,0,0,1,11.32,0L232,132.69" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/></svg>',
      done: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><rect width="256" height="256" fill="none"/><path d="M240,208H224V136l2.34,2.34A8,8,0,0,0,237.66,127L139.31,28.68a16,16,0,0,0-22.62,0L18.34,127a8,8,0,0,0,11.32,11.31L32,136v72H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16Zm-88,0H104V160a4,4,0,0,1,4-4h40a4,4,0,0,1,4,4Z"/></svg>'
    },
    nutrition: {
      todo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="224" y1="32" x2="183.6" y2="72.4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><path d="M43.81,223A8,8,0,0,1,33,212.19S64,112,104.4,72.4a56,56,0,0,1,79.2,79.2C144,192,43.81,223,43.81,223Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="232" y1="72" x2="183.19" y2="72" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="184" y1="72.81" x2="184" y2="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="112" y1="152" x2="141.7" y2="181.7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="104.4" y1="72.4" x2="144" y2="112" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/></svg>',
      done: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><rect width="256" height="256" fill="none"/><path d="M232,80H199.44a64,64,0,0,1-10.19,77.26c-8.52,8.69-19.61,16.92-31.85,24.51a4,4,0,0,1-4.91-.59l-34.84-34.84a8,8,0,0,0-11.49.18,8.23,8.23,0,0,0,.41,11.38l29.88,29.88a4,4,0,0,1-1,6.39C95.74,214.79,53,228.54,46.78,230.48a16,16,0,0,1-21.26-21.26c2.73-8.71,29-90.27,64.86-133.35a4,4,0,0,1,5.9-.26l42.05,42.06a8,8,0,0,0,11.71-.43,8.19,8.19,0,0,0-.6-11.1L108.08,64.78a4,4,0,0,1,.63-6.18,64,64,0,0,1,67.28-2V24a8,8,0,0,1,8.54-8A8.18,8.18,0,0,1,192,24.27V52.69l26.34-26.35a8,8,0,0,1,11.32,11.32L203.31,64h28.42A8.18,8.18,0,0,1,240,71.47,8,8,0,0,1,232,80Z"/></svg>'
    },
    learning: {
      todo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><rect x="48" y="40" width="64" height="176" rx="8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><path d="M217.67,205.77l-46.81,10a8,8,0,0,1-9.5-6.21L128.18,51.8a8.07,8.07,0,0,1,6.15-9.57l46.81-10a8,8,0,0,1,9.5,6.21L223.82,196.2A8.07,8.07,0,0,1,217.67,205.77Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="48" y1="72" x2="112" y2="72" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="48" y1="184" x2="112" y2="184" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="133.16" y1="75.48" x2="195.61" y2="62.06" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="139.79" y1="107.04" x2="202.25" y2="93.62" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/><line x1="156.39" y1="185.94" x2="218.84" y2="172.52" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/></svg>',
      done: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><rect width="256" height="256" fill="none"/><path d="M231.65,194.55,198.46,36.75a16,16,0,0,0-19-12.39L132.65,34.42a16.08,16.08,0,0,0-12.3,19l33.19,157.8A16,16,0,0,0,169.16,224a16.25,16.25,0,0,0,3.38-.36l46.81-10.06A16.09,16.09,0,0,0,231.65,194.55ZM136,50.15c0-.06,0-.09,0-.09l46.8-10,3.33,15.87L139.33,66Zm10,47.38-3.35-15.9,46.82-10.06,3.34,15.9Zm70,100.41-46.8,10-3.33-15.87L212.67,182,216,197.85C216,197.91,216,197.94,216,197.94ZM104,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V48A16,16,0,0,0,104,32ZM56,48h48V64H56Zm48,160H56V192h48v16Z"/></svg>'
    }
  };

  /* ============================================================
     Helpers
     ============================================================ */

  function esc(s) { return Utils.esc(s == null ? '' : String(s)); }

  function hexToRgba(hex, a) {
    if (!hex) return 'rgba(255,255,255,' + a + ')';
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    var r = parseInt(c.slice(0, 2), 16);
    var g = parseInt(c.slice(2, 4), 16);
    var b = parseInt(c.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function formatTime(decimalHours) {
    var hr = Math.floor(decimalHours);
    var m = Math.round((decimalHours - hr) * 60);
    var ampm = hr >= 12 ? 'p' : 'a';
    var h12 = hr % 12 === 0 ? 12 : hr % 12;
    return m === 0 ? (h12 + ampm) : (h12 + ':' + String(m).padStart(2, '0') + ampm);
  }

  function projectById(id) {
    if (!id) return null;
    var arr = Data.state.projects || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  }

  function projectColor(id) {
    var p = projectById(id);
    return (p && p.color) || '#7c7c8a';
  }

  function projectLabel(id) {
    var p = projectById(id);
    return (p && p.name) || 'Unassigned';
  }

  function countJournalAnswered(j) {
    if (!j) return 0;
    var n = 0;
    if (j.working_on)   n++;
    if (j.intention)    n++;
    if (j.learned)      n++;
    if (j.grateful_for) n++;
    return n;
  }

  function buildJournalWheel(answered) {
    var slices = [
      'M12 12 L12 2 A10 10 0 0 1 22 12 Z',
      'M12 12 L22 12 A10 10 0 0 1 12 22 Z',
      'M12 12 L12 22 A10 10 0 0 1 2 12 Z',
      'M12 12 L2 12 A10 10 0 0 1 12 2 Z'
    ];
    var paths = '';
    for (var i = 0; i < slices.length; i++) {
      paths += '<path class="q ' + (i < answered ? 'done' : '') + '" d="' + slices[i] + '"/>';
    }
    return '<svg class="journal-wheel" viewBox="0 0 24 24"><circle class="bg" cx="12" cy="12" r="10"/>' + paths + '<circle class="hole" cx="12" cy="12" r="2.5"/></svg>';
  }

  /* ============================================================
     Render — shell (built once)
     ============================================================ */

  function buildShell() {
    var section = document.getElementById('week-section');
    if (!section) return;
    section.innerHTML =
      '<div class="week-header">' +
      '  <div class="week-title">' +
      '    <span class="week-title-label" id="wk-label">Week —</span>' +
      '    <span class="week-title-range" id="wk-range">—</span>' +
      '  </div>' +
      '  <div class="week-actions">' +
      '    <button class="week-btn" id="wk-prev">‹</button>' +
      '    <button class="week-btn" id="wk-this">This Week</button>' +
      '    <button class="week-btn" id="wk-next">›</button>' +
      '  </div>' +
      '</div>' +
      '<div class="week-cards" id="week-cards"></div>' +
      '<div class="week-mini-cal" id="week-mini-cal"></div>' +
      '<div class="habit-legend">' +
      '  <span style="color:var(--text-faint);">HABITS</span>' +
      '  <span class="habit-legend-item"><span class="habit-legend-pip" style="background:#4a5fa8"></span>Sleep</span>' +
      '  <span class="habit-legend-item"><span class="habit-legend-pip" style="background:#9a6ed6"></span>Meditation</span>' +
      '  <span class="habit-legend-item"><span class="habit-legend-pip" style="background:#ea7e4c"></span>Movement</span>' +
      '  <span class="habit-legend-item"><span class="habit-legend-pip" style="background:#82a972"></span>Home</span>' +
      '  <span class="habit-legend-item"><span class="habit-legend-pip" style="background:#e6b830"></span>Nutrition</span>' +
      '  <span class="habit-legend-item"><span class="habit-legend-pip" style="background:#3eb3c8"></span>Learning</span>' +
      '</div>';

    document.getElementById('wk-prev').addEventListener('click', function () {
      Data.setWeekStart(Data.addDays(Data.state.weekStart, -7));
    });
    document.getElementById('wk-next').addEventListener('click', function () {
      Data.setWeekStart(Data.addDays(Data.state.weekStart, 7));
    });
    document.getElementById('wk-this').addEventListener('click', function () {
      Data.setWeekStart(new Date());
    });
  }

  function updateHeader() {
    var monday = Data.state.weekStart;
    if (!monday) return;
    var sunday = Data.addDays(monday, 6);
    var lbl = document.getElementById('wk-label');
    var rng = document.getElementById('wk-range');
    if (lbl) lbl.textContent = 'Week ' + isoWeekNumber(monday);
    if (rng) {
      rng.textContent = MONTHS[monday.getMonth()] + ' ' + monday.getDate() +
        ' — ' + MONTHS[sunday.getMonth()] + ' ' + sunday.getDate() + ', ' + sunday.getFullYear();
    }
  }

  function isoWeekNumber(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /* ============================================================
     Render — cards
     ============================================================ */

  function renderWeekCards() {
    var cards = document.getElementById('week-cards');
    if (!cards) return;
    var monday = Data.state.weekStart;
    if (!monday) return;
    var todayStr = Data.dateStr(new Date());
    var html = '';

    for (var i = 0; i < 7; i++) {
      var d = Data.addDays(monday, i);
      var ds = Data.dateStr(d);
      var dayNum = d.getDate();
      var dayName = DAY_NAMES[i];
      var isToday = ds === todayStr;
      var isWeekend = i >= 5;

      var tasks = Data.tasksForDate(ds);
      var visible = tasks.slice(0, 3);
      var overflow = tasks.slice(3);
      var journal = Data.state.journalsByDate[ds] || {};
      var answered = countJournalAnswered(journal);

      var visHtml = '';
      for (var v = 0; v < visible.length; v++) visHtml += taskRowHtml(visible[v], '');
      for (var o = 0; o < overflow.length; o++) visHtml += taskRowHtml(overflow[o], 'overflow');

      var extrasHtml = '';
      if (overflow.length > 0) {
        extrasHtml = '<div class="dh-extras">';
        for (var x = 0; x < overflow.length; x++) {
          extrasHtml += '<span class="dh-extras-pip" style="background:' + projectColor(overflow[x].project_id) + '"></span>';
        }
        extrasHtml += '<span class="dh-extras-count">+' + overflow.length + '</span></div>';
      }

      var habitsHtml = '';
      for (var h = 0; h < HABIT_ORDER.length; h++) {
        var key = HABIT_ORDER[h];
        var done = !!journal[key + '_done'];
        var svg = done ? HABIT_ICONS[key].done : HABIT_ICONS[key].todo;
        habitsHtml += '<span class="habit-icon ' + (done ? 'done' : 'todo') +
                      '" data-habit="' + key + '" data-day-date="' + ds + '" title="' + key + '">' + svg + '</span>';
      }

      var cls = 'day-card' + (isToday ? ' today' : '') + (isWeekend ? ' weekend' : '');

      html +=
        '<div class="' + cls + '" data-day-date="' + ds + '">' +
          '<div class="dh-top">' +
            '<span class="dh-name">' + dayName + '</span>' +
            '<span class="dh-num">' + dayNum + '</span>' +
          '</div>' +
          '<div class="dh-tasks-wrap">' +
            '<div class="dh-tasks">' + visHtml + '</div>' +
            extrasHtml +
          '</div>' +
          '<div class="dh-bottom">' +
            '<div class="dh-habits-row">' + habitsHtml + '</div>' +
            buildJournalWheel(answered) +
          '</div>' +
        '</div>';
    }
    cards.innerHTML = html;
    attachCardHandlers();
  }

  function taskRowHtml(t, extraCls) {
    var color = projectColor(t.project_id);
    var bg = hexToRgba(color, 0.06);
    var status = t.status || 'idea';
    return '<div class="dh-task ' + status + ' ' + (extraCls || '') +
           '" data-task-id="' + t.id + '" style="border-left-color:' + color + '; background:' + bg + ';">' +
           '<span class="dh-task-status"></span>' +
           '<span class="dh-task-text">' + esc(t.title || t.name || '') + '</span></div>';
  }

  /* ============================================================
     Render — mini calendar
     ============================================================ */

  function renderMiniCal() {
    var cal = document.getElementById('week-mini-cal');
    if (!cal) return;
    var monday = Data.state.weekStart;
    if (!monday) return;
    var todayStr = Data.dateStr(new Date());
    var nowDate = new Date();
    var nowHour = nowDate.getHours() + nowDate.getMinutes() / 60;

    var html = '';

    // Hour labels
    var hoursHtml = '';
    for (var h = CONTENT_START; h <= CONTENT_END; h++) {
      var top = (h - CONTENT_START) * HOUR_PX;
      var lbl = h === 12 ? 'noon' : h === 24 ? '12a' : h < 12 ? (h + 'a') : ((h - 12) + 'p');
      var firstCls = h === CONTENT_START ? 'first' : '';
      hoursHtml += '<div class="mini-cal-hour-label ' + firstCls + '" style="top:' + top + 'px;">' + lbl + '</div>';
    }
    html += '<div class="mini-cal-hours" style="height:' + CONTENT_HEIGHT + 'px;">' + hoursHtml + '</div>';

    for (var i = 0; i < 7; i++) {
      var d = Data.addDays(monday, i);
      var ds = Data.dateStr(d);
      var isToday = ds === todayStr;
      var sessions = Data.weekSessionsForDate(ds);

      var absHtml = '';
      for (var hh = CONTENT_START + 1; hh < CONTENT_END; hh++) {
        absHtml += '<div class="hour-line" style="top:' + ((hh - CONTENT_START) * HOUR_PX) + 'px;"></div>';
      }

      var edgeTop = '';
      var edgeBottom = '';

      for (var si = 0; si < sessions.length; si++) {
        var s = sessions[si];
        var b = sessionBox(s, d);
        if (!b) continue;
        var color = projectColor(s.project_id);
        var label = s.description ? s.description : projectLabel(s.project_id);
        var bg = hexToRgba(color, 0.18);
        var borderC = hexToRgba(color, 0.3);
        var showTime = b.height >= 24;

        absHtml +=
          '<div class="mini-block" data-session-id="' + s.id +
          '" data-session-top="' + b.top + '" data-session-height="' + b.height +
          '" style="top:' + b.top + 'px; height:' + b.height +
          'px; background:' + bg + '; border:1px solid ' + borderC +
          '; box-shadow: inset 2px 0 0 ' + color + ';">' +
          '<span class="mini-block-label">' + esc(label) + '</span>' +
          (showTime ? ('<span class="mini-block-time">' + formatTime(b.startHour) + '–' + formatTime(b.endHour) + '</span>') : '') +
          '</div>';

        edgeTop += '<div class="edge-bar top" data-session-id="' + s.id +
          '" data-session-top="' + b.top + '" data-session-height="' + b.height +
          '" style="background:' + color + '; display:none;" title="' + esc(label) + ' — scroll up to view"></div>';
        edgeBottom += '<div class="edge-bar bottom" data-session-id="' + s.id +
          '" data-session-top="' + b.top + '" data-session-height="' + b.height +
          '" style="background:' + color + '; display:none;" title="' + esc(label) + ' — scroll down to view"></div>';
      }

      if (isToday && nowHour >= CONTENT_START && nowHour <= CONTENT_END) {
        absHtml += '<div class="mini-now-line" style="top:' + ((nowHour - CONTENT_START) * HOUR_PX) + 'px;"></div>';
      }

      var dayHtml =
        '<div class="edge-indicator edge-top">' + edgeTop + '</div>' +
        absHtml +
        '<div class="edge-indicator edge-bottom">' + edgeBottom + '</div>';

      html += '<div class="mini-cal-day' + (isToday ? ' today' : '') +
              '" data-day-date="' + ds + '" style="height:' + CONTENT_HEIGHT + 'px;">' + dayHtml + '</div>';
    }

    cal.innerHTML = html;

    // Default scroll only on first build (preserve scroll position on re-renders)
    if (!cal._scrollInit) {
      cal.scrollTop = DEFAULT_SCROLL;
      cal._scrollInit = true;
    }

    cal.removeEventListener('scroll', updateEdgeIndicators);
    cal.addEventListener('scroll', updateEdgeIndicators);
    updateEdgeIndicators();

    attachSessionHandlers();
  }

  /** Compute decimal hours + pixel box for a session on day `dayDate`.
      Returns null if session lies entirely outside the rendered window. */
  function sessionBox(s, dayDate) {
    if (!s.started_at) return null;
    var start = new Date(s.started_at);
    var end = s.ended_at ? new Date(s.ended_at) : new Date(start.getTime() + 30 * 60000);

    var startHour, endHour;
    if (start.getDate() === dayDate.getDate() && start.getMonth() === dayDate.getMonth() && start.getFullYear() === dayDate.getFullYear()) {
      startHour = start.getHours() + start.getMinutes() / 60;
    } else {
      startHour = CONTENT_START;          // started before this day; clip to window top
    }
    if (end.getDate() === dayDate.getDate() && end.getMonth() === dayDate.getMonth() && end.getFullYear() === dayDate.getFullYear()) {
      endHour = end.getHours() + end.getMinutes() / 60;
    } else {
      endHour = CONTENT_END;              // ends after this day; clip to window bottom
    }

    if (endHour <= CONTENT_START || startHour >= CONTENT_END) return null;
    if (startHour < CONTENT_START) startHour = CONTENT_START;
    if (endHour > CONTENT_END) endHour = CONTENT_END;

    var top = (startHour - CONTENT_START) * HOUR_PX;
    var height = (endHour - startHour) * HOUR_PX - 2;
    if (height < 8) height = 8;
    return { top: top, height: height, startHour: startHour, endHour: endHour };
  }

  function updateEdgeIndicators() {
    var cal = document.getElementById('week-mini-cal');
    if (!cal) return;
    var scrollTop = cal.scrollTop;
    var viewBottom = scrollTop + cal.clientHeight;
    var bars = cal.querySelectorAll('.edge-bar');
    for (var i = 0; i < bars.length; i++) {
      var bar = bars[i];
      var top = +bar.dataset.sessionTop;
      var hh = +bar.dataset.sessionHeight;
      var bottom = top + hh;
      var isAbove = bottom <= scrollTop;
      var isBelow = top >= viewBottom;
      if (bar.classList.contains('top')) {
        bar.style.display = isAbove ? '' : 'none';
      } else {
        bar.style.display = isBelow ? '' : 'none';
      }
    }
  }

  /* ============================================================
     Card / session handlers
     ============================================================ */

  function attachCardHandlers() {
    var cards = document.querySelectorAll('#week-cards .day-card');
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        card.addEventListener('dragover', function (e) {
          // Only highlight if a task is being dragged
          if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('text/task-id')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          card.classList.add('drop-target');
        });
        card.addEventListener('dragleave', function () {
          card.classList.remove('drop-target');
        });
        card.addEventListener('drop', function (e) {
          card.classList.remove('drop-target');
          var taskId = e.dataTransfer.getData('text/task-id');
          if (!taskId) return;
          e.preventDefault();
          var ds = card.dataset.dayDate;
          Data.setTaskScheduledDate(taskId, ds).then(function () {
            Data.toast('Scheduled for ' + dayLabel(ds), 'success');
          });
        });
      })(cards[i]);
    }

    var icons = document.querySelectorAll('#week-cards .habit-icon');
    for (var j = 0; j < icons.length; j++) {
      (function (icon) {
        icon.addEventListener('click', function (e) {
          e.stopPropagation();
          Data.toggleHabit(icon.dataset.dayDate, icon.dataset.habit);
        });
      })(icons[j]);
    }

    var wheels = document.querySelectorAll('#week-cards .journal-wheel');
    for (var k = 0; k < wheels.length; k++) {
      (function (wheel) {
        wheel.addEventListener('click', function (e) {
          e.stopPropagation();
          var card = wheel.closest('.day-card');
          if (card) openJournalModal(card.dataset.dayDate);
        });
      })(wheels[k]);
    }
  }

  function attachSessionHandlers() {
    var els = document.querySelectorAll('#week-mini-cal .mini-block, #week-mini-cal .edge-bar');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          if (el.classList.contains('edge-bar')) {
            var cal = document.getElementById('week-mini-cal');
            var top = +el.dataset.sessionTop;
            cal.scrollTo({ top: top - 21, behavior: 'smooth' });
          }
          // Session edit isn't wired into app.js yet — for now, surface info.
          // Future: dispatch a custom event app.js can listen to.
          var sid = el.dataset.sessionId;
          var s = (Data.state.weekSessions || []).find(function (x) { return x.id === sid; });
          if (s) {
            Data.toast(projectLabel(s.project_id) + ' · click in main timeline to edit', 'info');
          }
        });
      })(els[i]);
    }
  }

  function dayLabel(ds) {
    var d = new Date(ds + 'T00:00:00');
    return DAY_NAMES[(d.getDay() + 6) % 7] + ' ' + d.getDate();
  }

  /* ============================================================
     Journal modal
     ============================================================ */

  function ensureJournalModal() {
    var modal = document.getElementById('wk-journal-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wk-journal-modal';
    modal.className = 'wk-modal-backdrop';
    modal.innerHTML =
      '<div class="wk-modal">' +
      '  <h2 id="wk-modal-title"></h2>' +
      '  <div class="wk-modal-sub" id="wk-modal-sub">Daily Journal</div>' +
      '  <div class="wk-journal-q"><label>Working on</label><textarea data-field="working_on" placeholder="What am I working on?"></textarea></div>' +
      '  <div class="wk-journal-q"><label>Intention</label><textarea data-field="intention" placeholder="What is my intention?"></textarea></div>' +
      '  <div class="wk-journal-q"><label>Learned</label><textarea data-field="learned" placeholder="What did I learn?"></textarea></div>' +
      '  <div class="wk-journal-q"><label>Grateful for</label><textarea data-field="grateful_for" placeholder="What am I grateful for?"></textarea></div>' +
      '  <div class="wk-modal-actions">' +
      '    <button class="wk-btn-cancel">Close</button>' +
      '    <button class="wk-btn-save primary">Save</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target.id === 'wk-journal-modal') closeJournalModal();
    });
    modal.querySelector('.wk-btn-cancel').addEventListener('click', closeJournalModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('show')) closeJournalModal();
    });
    return modal;
  }

  function openJournalModal(ds) {
    var modal = ensureJournalModal();
    var d = new Date(ds + 'T00:00:00');
    document.getElementById('wk-modal-title').textContent =
      WEEKDAYS_LONG[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();

    var journal = Data.state.journalsByDate[ds] || {};
    var fields = ['working_on', 'intention', 'learned', 'grateful_for'];
    fields.forEach(function (f) {
      var ta = modal.querySelector('textarea[data-field="' + f + '"]');
      if (ta) ta.value = journal[f] || '';
    });

    var saveBtn = modal.querySelector('.wk-btn-save');
    saveBtn.onclick = function () {
      var payload = {};
      fields.forEach(function (f) {
        var ta = modal.querySelector('textarea[data-field="' + f + '"]');
        var val = ta ? (ta.value || '').trim() : '';
        payload[f] = val || null;
      });
      Data.saveJournal(payload, ds).then(function () {
        Data.toast('Journal saved', 'success');
        closeJournalModal();
      });
    };

    modal.classList.add('show');
    setTimeout(function () {
      var first = Array.prototype.find.call(modal.querySelectorAll('textarea'), function (t) { return !t.value; });
      if (first) first.focus();
    }, 100);
  }

  function closeJournalModal() {
    var modal = document.getElementById('wk-journal-modal');
    if (modal) modal.classList.remove('show');
  }

  /* ============================================================
     Init / boot
     ============================================================ */

  function rerender() {
    if (!Data.state.weekStart) return;
    updateHeader();
    renderWeekCards();
    renderMiniCal();
  }

  function init() {
    if (!document.getElementById('week-section')) return;
    if (typeof Data === 'undefined') {
      console.warn('[Week] Data layer not loaded');
      return;
    }
    buildShell();
    Data.on('dataChanged', rerender);
    // If Data already initialized (e.g. after late script load), render now.
    if (Data.state && Data.state.weekStart) rerender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Week = { init: init, rerender: rerender };
})();
