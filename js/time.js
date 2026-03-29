/* ============================================================
   time.js — Time view: timer, session log, print sheet
   Exposed on window.TimeView
   ============================================================ */
(function () {
  'use strict';

  /* ---- Timer state ---- */
  var timerStartedAt     = null;
  var timerInterval      = null;
  var timerPausedDuration = 0;

  /* ---- Preserved form state (survives re-render while timer runs) ---- */
  var _selectedProjectId = '';
  var _selectedFeatureId = '';
  var _description       = '';
  var _billable          = false;

  /* ---- Helpers ---- */

  function getContainer() {
    return document.querySelector('[data-panel="time"]');
  }

  function padTwo(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatElapsed(ms) {
    var totalSecs = Math.floor(ms / 1000);
    var h = Math.floor(totalSecs / 3600);
    var m = Math.floor((totalSecs % 3600) / 60);
    var s = totalSecs % 60;
    return padTwo(h) + ':' + padTwo(m) + ':' + padTwo(s);
  }

  function elapsedMs() {
    if (!timerStartedAt) return 0;
    return Date.now() - timerStartedAt.getTime();
  }

  function isRunning() {
    return timerStartedAt !== null && timerInterval !== null;
  }

  function captureFormState() {
    var projSel = document.getElementById('timer-project-select');
    var featSel = document.getElementById('timer-feature-select');
    var descEl  = document.getElementById('timer-description');
    var billEl  = document.getElementById('timer-billable');
    if (projSel) _selectedProjectId = projSel.value;
    if (featSel) _selectedFeatureId = featSel.value;
    if (descEl)  _description = descEl.value;
    if (billEl)  _billable = billEl.checked;
  }

  function durationMinutes(startIso, endIso) {
    var start = new Date(startIso).getTime();
    var end   = new Date(endIso).getTime();
    return Math.round((end - start) / 60000);
  }

  /* ---- Timer display ---- */

  function renderTimerDisplay() {
    var running = isRunning();
    var elapsed = formatElapsed(elapsedMs());

    return '' +
      '<div class="timer-clock' + (running ? ' running' : '') + '" id="timer-display" ' +
        'style="font-family:var(--font-serif);font-size:clamp(2.5rem,6vw,4rem);color:' +
        (running ? 'var(--success)' : 'var(--text-primary)') +
        ';text-align:center;padding:var(--space-10) 0;letter-spacing:0.05em;transition:color var(--transition);">' +
        elapsed +
      '</div>';
  }

  /* ---- Timer controls ---- */

  function renderTimerControls() {
    var running  = isRunning();
    var projects = Data.activeProjects();

    /* Project dropdown */
    var projOptions = '<option value="">Select project...</option>';
    projects.forEach(function (p) {
      var sel = (p.id === _selectedProjectId) ? ' selected' : '';
      projOptions += '<option value="' + Utils.esc(p.id) + '"' + sel + '>' + Utils.esc(p.name) + '</option>';
    });

    /* Feature dropdown */
    var featOptions = '<option value="">Select feature...</option>';
    if (_selectedProjectId) {
      var features = Data.projectFeatures(_selectedProjectId);
      features.forEach(function (f) {
        var sel = (f.id === _selectedFeatureId) ? ' selected' : '';
        featOptions += '<option value="' + Utils.esc(f.id) + '"' + sel + '>' + Utils.esc(f.title) + '</option>';
      });
    }

    var html = '' +
      '<div class="timer-controls" style="display:flex;flex-direction:column;gap:var(--space-6);padding:0 var(--space-10);max-width:480px;margin:0 auto;">';

    /* Meta inputs */
    html += '' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);">' +
        '<select id="timer-project-select" data-action="timer-project-change">' + projOptions + '</select>' +
        '<select id="timer-feature-select">' + featOptions + '</select>' +
      '</div>' +
      '<input type="text" id="timer-description" placeholder="What are you working on?" value="' + Utils.esc(_description) + '">' +
      '<label style="display:flex;align-items:center;gap:var(--space-3);font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer;">' +
        '<input type="checkbox" id="timer-billable"' + (_billable ? ' checked' : '') + ' style="width:auto;accent-color:var(--accent);">' +
        'Billable' +
      '</label>';

    /* Buttons */
    html += '<div style="display:flex;gap:var(--space-4);justify-content:center;">';
    if (!running) {
      html += '<button class="btn-primary" data-action="timer-start">Start</button>';
    } else {
      html += '<button class="btn-primary" data-action="timer-stop" style="background:var(--success);border-color:var(--success);">Stop</button>';
      html += '<button class="btn-danger" data-action="timer-discard">Discard</button>';
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  /* ---- Session log ---- */

  function renderSessionLog() {
    var sessions = Data.state.timeSessions || [];
    var todayStr = Utils.isoDate(new Date());

    var todaySessions = sessions.filter(function (s) {
      return s.started_at && s.started_at.slice(0, 10) === todayStr;
    });

    var totalMinutes      = 0;
    var billableMinutes   = 0;
    var nonBillableMinutes = 0;

    todaySessions.forEach(function (s) {
      var mins = s.duration_min || durationMinutes(s.started_at, s.ended_at);
      totalMinutes += mins;
      if (s.is_billable) billableMinutes += mins;
      else nonBillableMinutes += mins;
    });

    var totalToday = Data.totalMinutesToday();

    var html = '' +
      '<div class="session-log" style="padding:var(--space-10);max-width:720px;margin:0 auto;">' +
        '<div style="display:flex;align-items:center;gap:var(--space-6);margin-bottom:var(--space-6);">' +
          '<span style="font-size:var(--text-md);font-weight:500;color:var(--text-primary);">Recent Sessions</span>' +
          '<span style="font-size:var(--text-sm);color:var(--accent);">' + Utils.esc(Utils.formatDuration(totalToday || totalMinutes)) + ' today</span>' +
        '</div>' +
        '<div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:var(--space-6);">' +
          Utils.esc(Utils.formatDuration(billableMinutes)) + ' billable &middot; ' +
          Utils.esc(Utils.formatDuration(nonBillableMinutes)) + ' non-billable' +
        '</div>';

    if (sessions.length === 0) {
      html += '<div class="empty-state"><div class="empty-text">No sessions yet</div></div>';
    } else {
      var sorted = sessions.slice().sort(function (a, b) {
        return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
      });

      html += '<div style="display:flex;flex-direction:column;gap:var(--space-2);">';
      sorted.forEach(function (s) {
        var project  = Data.state.projects.get(s.project_id);
        var projName = project ? project.name : '';
        var desc     = s.description || 'Untitled session';
        var startTime = Utils.formatTime(s.started_at);
        var endTime   = Utils.formatTime(s.ended_at);
        var mins      = s.duration_min || durationMinutes(s.started_at, s.ended_at);
        var dur       = Utils.formatDuration(mins);

        var billBadge = s.is_billable
          ? '<span style="font-size:var(--text-2xs);color:var(--success);border:1px solid var(--success);padding:var(--space-1) var(--space-3);border-radius:var(--radius-pill);">Billable</span>'
          : '<span style="font-size:var(--text-2xs);color:var(--text-faint);">&mdash;</span>';

        html += '' +
          '<div style="display:grid;grid-template-columns:1fr auto auto auto auto auto;gap:var(--space-4);align-items:center;padding:var(--space-3) var(--space-4);border-radius:var(--radius);">' +
            '<span style="font-size:var(--text-sm);color:var(--text-default);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + Utils.esc(desc) + '</span>' +
            '<span style="font-size:var(--text-2xs);color:var(--text-faint);">' + Utils.esc(projName) + '</span>' +
            '<span style="font-size:var(--text-2xs);color:var(--text-tertiary);white-space:nowrap;">' + Utils.esc(startTime) + ' &rarr; ' + Utils.esc(endTime) + '</span>' +
            '<span style="font-size:var(--text-sm);color:var(--text-secondary);font-weight:500;white-space:nowrap;">' + Utils.esc(dur) + '</span>' +
            billBadge +
            '<button style="font-size:var(--text-xs);color:var(--text-faint);padding:var(--space-1) var(--space-2);border-radius:var(--radius-sm);transition:color var(--transition);" data-action="delete-time-entry" data-id="' + Utils.esc(s.id) + '">&times;</button>' +
          '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ---- Print sheet ---- */

  function renderPrintSheet() {
    var domain   = QTime.today();
    var todayStr = Utils.isoDate(new Date());
    var weekMon  = Utils.isoWeek(new Date());
    var projects = Data.activeProjects();

    /* 3 Priorities: top 3 high importance items this week */
    var priorities = [];
    Data.state.features.forEach(function (f) {
      if (f.importance === 'high' && f.target_week === weekMon &&
          f.status !== 'done' && f.status !== 'integrated') {
        priorities.push(f);
      }
    });
    priorities = priorities.slice(0, 3);
    while (priorities.length < 3) priorities.push(null);

    /* Scheduled tasks for today */
    var todayTasks = [];
    Data.state.tasks.forEach(function (t) {
      if (t.due_date === todayStr) todayTasks.push(t);
    });

    /* Client projects */
    var clientProjects = projects.filter(function (p) { return p.type === 'client'; });

    /* Remaining tasks for the week */
    var weekTasks = [];
    Data.state.tasks.forEach(function (t) {
      if (t.target_week === weekMon && t.status !== 'done' && t.status !== 'integrated') {
        weekTasks.push(t);
      }
    });

    var html = '' +
      '<div class="print-sheet" id="print-sheet" style="display:none;">' +
        QTime.renderPrintHeader() +

        /* Priorities */
        '<div class="print-section">' +
          '<h3 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:var(--tracking-wider);color:var(--text-tertiary);margin-bottom:var(--space-4);">3 Priorities</h3>';

    priorities.forEach(function (p, i) {
      var text = p ? p.title : '';
      html += '<div style="padding:var(--space-3) 0;border-bottom:1px solid var(--border-subtle);font-size:var(--text-sm);color:var(--text-default);min-height:24px;">' +
        (i + 1) + '. ' + Utils.esc(text) +
      '</div>';
    });

    html += '</div>';

    /* Scheduled */
    html += '' +
      '<div class="print-section">' +
        '<h3 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:var(--tracking-wider);color:var(--text-tertiary);margin-bottom:var(--space-4);">Scheduled</h3>';

    if (todayTasks.length === 0) {
      html += '<div style="font-size:var(--text-xs);color:var(--text-faint);padding:var(--space-3) 0;">No tasks scheduled for today</div>';
    } else {
      todayTasks.forEach(function (t) {
        html += '<div style="padding:var(--space-2) 0;font-size:var(--text-sm);color:var(--text-default);">&bull; ' + Utils.esc(t.title) + '</div>';
      });
    }
    html += '</div>';

    /* Billable hours table */
    html += '' +
      '<div class="print-section">' +
        '<h3 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:var(--tracking-wider);color:var(--text-tertiary);margin-bottom:var(--space-4);">Billable Hours</h3>' +
        '<table style="width:100%;font-size:var(--text-xs);">' +
          '<thead><tr>' +
            '<th style="text-align:left;padding:var(--space-2) 0;border-bottom:1px solid var(--border-subtle);color:var(--text-tertiary);">Project</th>' +
            '<th style="text-align:right;padding:var(--space-2) 0;border-bottom:1px solid var(--border-subtle);color:var(--text-tertiary);">Hours</th>' +
          '</tr></thead><tbody>';

    clientProjects.forEach(function (p) {
      html += '<tr>' +
        '<td style="padding:var(--space-2) 0;border-bottom:1px solid var(--border-subtle);color:var(--text-default);">' + Utils.esc(p.name) + '</td>' +
        '<td style="text-align:right;padding:var(--space-2) 0;border-bottom:1px solid var(--border-subtle);color:var(--text-default);"></td>' +
      '</tr>';
    });

    if (clientProjects.length === 0) {
      html += '<tr><td colspan="2" style="padding:var(--space-2) 0;color:var(--text-faint);">No client projects</td></tr>';
    }

    html += '</tbody></table></div>';

    /* Quick todos */
    html += '' +
      '<div class="print-section">' +
        '<h3 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:var(--tracking-wider);color:var(--text-tertiary);margin-bottom:var(--space-4);">Quick Todos</h3>';

    weekTasks.slice(0, 10).forEach(function (t) {
      html += '<div style="padding:var(--space-2) 0;font-size:var(--text-xs);color:var(--text-default);">&square; ' + Utils.esc(t.title) + '</div>';
    });
    if (weekTasks.length === 0) {
      html += '<div style="font-size:var(--text-xs);color:var(--text-faint);">All clear for this week</div>';
    }

    html += '</div>';

    /* Waiting on */
    html += '' +
      '<div class="print-section">' +
        '<h3 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:var(--tracking-wider);color:var(--text-tertiary);margin-bottom:var(--space-4);">Waiting On</h3>' +
        '<div style="min-height:48px;border-bottom:1px solid var(--border-subtle);"></div>' +
        '<div style="min-height:48px;border-bottom:1px solid var(--border-subtle);"></div>' +
      '</div>';

    /* Notes/Sketch space */
    html += '' +
      '<div class="print-section">' +
        '<h3 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:var(--tracking-wider);color:var(--text-tertiary);margin-bottom:var(--space-4);">Notes / Sketch</h3>' +
        '<div style="min-height:120px;border:1px solid var(--border-subtle);border-radius:var(--radius);"></div>' +
      '</div>';

    /* End of day */
    html += '' +
      '<div class="print-section">' +
        '<h3 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:var(--tracking-wider);color:var(--text-tertiary);margin-bottom:var(--space-4);">End of Day</h3>' +
        '<div style="min-height:36px;border-bottom:1px solid var(--border-subtle);font-size:var(--text-xs);color:var(--text-faint);padding-top:var(--space-2);">What got done?</div>' +
        '<div style="min-height:36px;border-bottom:1px solid var(--border-subtle);font-size:var(--text-xs);color:var(--text-faint);padding-top:var(--space-2);">What carries forward?</div>' +
      '</div>';

    /* Domain quote */
    html += '' +
      '<div class="print-section" style="text-align:center;padding:var(--space-10) 0;">' +
        '<p style="font-size:var(--text-xs);color:var(--text-faint);font-style:italic;font-family:var(--font-serif);max-width:400px;margin:0 auto;">' +
          Utils.esc(domain.energy) +
        '</p>' +
      '</div>';

    html += '</div>';
    return html;
  }

  /* ---- Main render ---- */

  function render() {
    var container = getContainer();
    if (!container) return;

    /* Preserve form state before re-render */
    captureFormState();

    var html = '';

    html += renderTimerDisplay();
    html += renderTimerControls();
    html += renderSessionLog();

    /* Print button */
    html += '' +
      '<div style="text-align:center;padding:var(--space-6);">' +
        '<button class="btn-secondary" data-action="print-today">Print Today</button>' +
      '</div>';

    /* Print sheet (hidden) */
    html += renderPrintSheet();

    container.innerHTML = html;
    bindEvents(container);
  }

  /* ---- Timer methods ---- */

  function startTimer() {
    if (isRunning()) return;
    captureFormState();
    timerStartedAt = new Date();
    timerInterval = setInterval(updateDisplay, 1000);
    render();
  }

  function stopTimer() {
    if (!isRunning()) return;

    captureFormState();
    clearInterval(timerInterval);

    var session = {
      started_at:  timerStartedAt.toISOString(),
      ended_at:    new Date().toISOString(),
      project_id:  _selectedProjectId || null,
      description: _description || null,
      is_billable: _billable,
    };

    resetTimer();

    Data.saveTimeSession(session).then(function () {
      render();
      App.toast('Session saved', 'success');
    });
  }

  function discardTimer() {
    if (!isRunning()) return;
    if (!confirm('Discard this timer?')) return;
    clearInterval(timerInterval);
    resetTimer();
    render();
  }

  function updateDisplay() {
    var el = document.getElementById('timer-display');
    if (!el) return;
    el.textContent = formatElapsed(elapsedMs());
  }

  function resetTimer() {
    timerStartedAt = null;
    timerInterval = null;
    timerPausedDuration = 0;
    _selectedProjectId = '';
    _selectedFeatureId = '';
    _description = '';
    _billable = false;
  }

  /* ---- Feature dropdown filtering ---- */

  function updateFeatureDropdown() {
    captureFormState();
    var sel = document.getElementById('timer-feature-select');
    if (!sel) return;

    var html = '<option value="">Select feature...</option>';
    if (_selectedProjectId) {
      var features = Data.projectFeatures(_selectedProjectId);
      features.forEach(function (f) {
        html += '<option value="' + Utils.esc(f.id) + '">' + Utils.esc(f.title) + '</option>';
      });
    }
    sel.innerHTML = html;
    _selectedFeatureId = '';
  }

  /* ---- Print ---- */

  function printToday() {
    var sheet = document.getElementById('print-sheet');
    if (!sheet) return;
    sheet.style.display = 'block';
    window.print();
    sheet.style.display = 'none';
  }

  /* ---- Events ---- */

  function bindEvents(container) {
    container.addEventListener('click', handleClick);
    container.addEventListener('change', handleChange);
  }

  function handleClick(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;

    var action = target.getAttribute('data-action');

    switch (action) {
      case 'timer-start':
        startTimer();
        break;
      case 'timer-stop':
        stopTimer();
        break;
      case 'timer-discard':
        discardTimer();
        break;
      case 'print-today':
        printToday();
        break;
      case 'delete-time-entry':
        deleteTimeEntry(target.getAttribute('data-id'));
        break;
    }
  }

  function handleChange(e) {
    if (e.target.id === 'timer-project-select') {
      updateFeatureDropdown();
    }
  }

  function deleteTimeEntry(id) {
    if (!confirm('Delete this session?')) return;
    Data.deleteTimeSession(id).then(function () {
      render();
    });
  }

  /* ---- Expose ---- */
  window.TimeView = {
    render:              render,
    startTimer:          startTimer,
    stopTimer:           stopTimer,
    discardTimer:        discardTimer,
    updateDisplay:       updateDisplay,
    resetTimer:          resetTimer,
    printToday:          printToday,
    renderSessionLog:    renderSessionLog,
    renderPrintSheet:    renderPrintSheet,
    get timerStartedAt()      { return timerStartedAt; },
    get timerInterval()       { return timerInterval; },
    get timerPausedDuration() { return timerPausedDuration; },
  };
})();
