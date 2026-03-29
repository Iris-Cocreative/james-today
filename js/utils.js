/* ============================================================
   utils.js — Shared utility helpers
   Exposed on window.Utils
   ============================================================ */
(function () {
  'use strict';

  const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const STATUS_COLORS = {
    idea:       'var(--status-idea)',
    planning:   'var(--status-planning)',
    scheduled:  'var(--status-scheduled)',
    building:   'var(--status-building)',
    done:       'var(--status-done)',
    integrated: 'var(--status-integrated)',
    paused:     'var(--status-paused)',
    archived:   'var(--status-archived)',
  };

  const STATUS_LABELS = {
    idea:       'Idea',
    planning:   'Planning',
    scheduled:  'Scheduled',
    building:   'Building',
    done:       'Done',
    integrated: 'Integrated',
    paused:     'Paused',
    archived:   'Archived',
  };

  /* ---- XSS-safe HTML escaping ---- */
  const _escDiv = document.createElement('div');
  function esc(str) {
    if (str == null) return '';
    _escDiv.textContent = String(str);
    return _escDiv.innerHTML;
  }

  /* ---- Date helpers ---- */

  /** Return the Monday of the week containing `date`. */
  function getMonday(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    var day = d.getDay();          // 0=Sun … 6=Sat
    var diff = (day === 0) ? -6 : 1 - day;   // Sunday → previous Monday
    d.setDate(d.getDate() + diff);
    return d;
  }

  function addWeeks(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n * 7);
    return d;
  }

  /** YYYY-MM-DD */
  function isoDate(date) {
    var d = new Date(date);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /** YYYY-MM-DD of the Monday of that week */
  function isoWeek(date) {
    return isoDate(getMonday(date));
  }

  /** "Mar 15" */
  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate();
  }

  /** "Saturday, March 15, 2026" */
  function formatDateFull(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  /** "Mar 23 — Mar 29" */
  function formatWeekLabel(monday) {
    var mon = new Date(monday);
    var sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return formatDate(isoDate(mon)) + ' \u2014 ' + formatDate(isoDate(sun));
  }

  /** "Mar 23" for a Monday */
  function formatWeekShort(monday) {
    return formatDate(isoDate(new Date(monday)));
  }

  /** "2:30 PM" */
  function formatTime(isoStr) {
    var d = new Date(isoStr);
    var h = d.getHours();
    var m = String(d.getMinutes()).padStart(2, '0');
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ampm;
  }

  /** "2h 15m" or "45m" */
  function formatDuration(mins) {
    if (mins == null || mins <= 0) return '0m';
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h === 0) return m + 'm';
    if (m === 0) return h + 'h';
    return h + 'h ' + m + 'm';
  }

  /** Relative time: "now", "5m", "3h", "2d" */
  function timeAgo(dateStr) {
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    var diff = Math.max(0, now - then);
    var secs = Math.floor(diff / 1000);
    if (secs < 60)   return 'now';
    var mins = Math.floor(secs / 60);
    if (mins < 60)   return mins + 'm';
    var hours = Math.floor(mins / 60);
    if (hours < 24)  return hours + 'h';
    var days = Math.floor(hours / 24);
    return days + 'd';
  }

  /** Integer days since a date */
  function daysSince(dateStr) {
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var then = new Date(dateStr);
    then.setHours(0, 0, 0, 0);
    return Math.floor((now - then) / (1000 * 60 * 60 * 24));
  }

  /** Lowercase day name: "monday", "tuesday", etc. */
  function getDayOfWeek() {
    return DAY_NAMES[new Date().getDay()];
  }

  function statusColor(status) {
    return STATUS_COLORS[status] || 'var(--text-secondary)';
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : '');
  }

  function debounce(fn, ms) {
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  /* ---- Expose ---- */
  window.Utils = {
    esc: esc,
    getMonday: getMonday,
    addWeeks: addWeeks,
    isoDate: isoDate,
    isoWeek: isoWeek,
    formatDate: formatDate,
    formatDateFull: formatDateFull,
    formatWeekLabel: formatWeekLabel,
    formatWeekShort: formatWeekShort,
    formatTime: formatTime,
    formatDuration: formatDuration,
    timeAgo: timeAgo,
    daysSince: daysSince,
    getDayOfWeek: getDayOfWeek,
    statusColor: statusColor,
    statusLabel: statusLabel,
    debounce: debounce,
  };
})();
