(function() {
  'use strict';

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function isoDate(d) {
    var dt = d instanceof Date ? d : new Date(d);
    return dt.toISOString().slice(0, 10);
  }

  function dayOfYear(d) {
    var dt = d instanceof Date ? d : new Date(d);
    var start = new Date(dt.getFullYear(), 0, 0);
    var diff = dt - start;
    return Math.floor(diff / 86400000);
  }

  function weekNumber(d) {
    var dt = d instanceof Date ? d : new Date(d);
    var oneJan = new Date(dt.getFullYear(), 0, 1);
    return Math.ceil(((dt - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
  }

  function getDayName(d) {
    return (d || new Date()).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  }

  function formatDateFull(d) {
    return (d || new Date()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function formatTime(isoStr) {
    return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function formatDuration(mins) {
    var h = Math.floor(mins / 60), m = Math.round(mins % 60);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  }

  function getMonday(d) {
    var dt = new Date(d);
    var day = dt.getDay();
    dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
    dt.setHours(0,0,0,0);
    return dt;
  }

  function isoWeek(d) {
    return isoDate(getMonday(d));
  }

  function addWeeks(d, n) {
    var dt = new Date(d);
    dt.setDate(dt.getDate() + (n * 7));
    return dt;
  }

  function daysSince(d) {
    if (!d) return 0;
    var dt = d instanceof Date ? d : new Date(d);
    return Math.floor((Date.now() - dt.getTime()) / 86400000);
  }

  function formatDate(d) {
    if (!d) return '';
    var dt = d instanceof Date ? d : new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatWeekShort(d) {
    var dt = d instanceof Date ? d : new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatWeekLabel(d) {
    var dt = d instanceof Date ? d : new Date(d);
    var end = addWeeks(dt, 1);
    end.setDate(end.getDate() - 1);
    return formatWeekShort(dt) + ' \u2013 ' + formatWeekShort(end);
  }

  function debounce(fn, ms) {
    var timer;
    return function() {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
    };
  }

  // Status system
  var STATUSES = [
    { key: 'integrated', label: 'Integrated', color: '#9370db', solid: true },
    { key: 'done',       label: 'Done',       color: '#1e90ff', solid: true },
    { key: 'building',   label: 'Building',   color: '#32cd32', solid: true },
    { key: 'scheduled',  label: 'Scheduled',  color: '#ffa500', solid: false },
    { key: 'planning',   label: 'Planning',   color: '#ffd700', solid: false },
    { key: 'idea',       label: 'Idea',       color: '#add8e6', solid: false },
  ];

  var STATUS_MAP = {};
  STATUSES.forEach(function(s) { STATUS_MAP[s.key] = s; });

  function statusColor(key) { return STATUS_MAP[key] ? STATUS_MAP[key].color : '#706b62'; }
  function statusLabel(key) { return STATUS_MAP[key] ? STATUS_MAP[key].label : key; }
  function statusSolid(key) { return STATUS_MAP[key] ? STATUS_MAP[key].solid : false; }

  // Squircle SVG for status icons (from the mockup)
  var SQUIRCLE_PATH = 'M10 0C13.5 0 16 0 17.5 1 19 2 20 4.5 20 10 20 15.5 19 18 17.5 19 16 20 13.5 20 10 20 6.5 20 4 20 2.5 19 1 18 0 15.5 0 10 0 4.5 1 2 2.5 1 4 0 6.5 0 10 0Z';

  function squircleSVG(color, solid, size) {
    size = size || 16;
    if (solid) {
      return '<svg viewBox="0 0 20 20" width="' + size + '" height="' + size + '" fill="none"><path d="' + SQUIRCLE_PATH + '" fill="' + color + '"/></svg>';
    }
    return '<svg viewBox="0 0 20 20" width="' + size + '" height="' + size + '" fill="none"><path d="' + SQUIRCLE_PATH + '" fill="none" stroke="' + color + '" stroke-width="2"/></svg>';
  }

  // Qualitative time / domain system
  var DOMAINS = {
    saturday:  { name: 'MULA',    sanskrit: 'मूल',    planet: 'Saturn',  planetSkt: 'Shani',   symbol: '♄', color: '#7c7c8a', question: 'What does my body need right now?', theme: 'Root · Foundation' },
    sunday:    { name: 'DHARMA',  sanskrit: 'धर्म',   planet: 'Sun',     planetSkt: 'Surya',   symbol: '☉', color: '#d4a017', question: 'What is this in service of?', theme: 'Purpose · Light' },
    monday:    { name: 'SEVA',    sanskrit: 'सेवा',   planet: 'Moon',    planetSkt: 'Chandra', symbol: '☽', color: '#b8c4d0', question: 'Who am I responsible to today?', theme: 'Service · Care' },
    tuesday:   { name: 'KARMA',   sanskrit: 'कर्म',   planet: 'Mars',    planetSkt: 'Mangal',  symbol: '♂', color: '#c0392b', question: "What's the ONE thing?", theme: 'Action · Craft' },
    wednesday: { name: 'VIDYA',   sanskrit: 'विद्या',  planet: 'Mercury', planetSkt: 'Budh',    symbol: '☿', color: '#27ae60', question: 'What am I learning right now?', theme: 'Knowledge · Learning' },
    thursday:  { name: 'SANGHA',  sanskrit: 'संघ',    planet: 'Jupiter', planetSkt: 'Guru',    symbol: '♃', color: '#8e44ad', question: "Who's with me?", theme: 'Community · Tribe' },
    friday:    { name: 'PREMA',   sanskrit: 'प्रेम',   planet: 'Venus',   planetSkt: 'Shukra',  symbol: '♀', color: '#e8a0bf', question: 'Am I present, or just proximate?', theme: 'Love · Partnership' },
  };

  function todayDomain() {
    var day = getDayName();
    return DOMAINS[day] || DOMAINS.monday;
  }

  window.Utils = {
    esc: esc,
    isoDate: isoDate,
    isoWeek: isoWeek,
    dayOfYear: dayOfYear,
    weekNumber: weekNumber,
    getDayName: getDayName,
    formatDateFull: formatDateFull,
    formatDate: formatDate,
    formatTime: formatTime,
    formatDuration: formatDuration,
    formatWeekShort: formatWeekShort,
    formatWeekLabel: formatWeekLabel,
    getMonday: getMonday,
    addWeeks: addWeeks,
    daysSince: daysSince,
    debounce: debounce,
    STATUSES: STATUSES,
    STATUS_MAP: STATUS_MAP,
    statusColor: statusColor,
    statusLabel: statusLabel,
    statusSolid: statusSolid,
    SQUIRCLE_PATH: SQUIRCLE_PATH,
    squircleSVG: squircleSVG,
    DOMAINS: DOMAINS,
    todayDomain: todayDomain,
  };
})();
