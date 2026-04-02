/* ============================================================
   app.js — Main application logic for james.today dashboard
   Single IIFE. Exposed on window.App.
   ============================================================ */
(function () {
  'use strict';

  /* ================================================================
     Constants & helpers not in Utils
     ================================================================ */

  var STATUSES = [
    { key: 'idea',       label: 'Idea',       color: '#add8e6', solid: false },
    { key: 'planning',   label: 'Planning',   color: '#ffd700', solid: false },
    { key: 'scheduled',  label: 'Scheduled',  color: '#ffa500', solid: false },
    { key: 'building',   label: 'Building',   color: '#32cd32', solid: true },
    { key: 'done',       label: 'Done',       color: '#1e90ff', solid: true },
    { key: 'integrated', label: 'Integrated', color: '#9370db', solid: true }
  ];

  var STATUS_MAP = {};
  for (var si = 0; si < STATUSES.length; si++) STATUS_MAP[STATUSES[si].key] = STATUSES[si];

  var PROJECT_TYPES = ['client', 'personal', 'house', 'art', 'internal', 'other'];

  var DEFAULT_COLORS = [
    '#c4956a', '#e8a0bf', '#8e44ad', '#27ae60', '#c0392b',
    '#d4a017', '#1e90ff', '#32cd32', '#ffa500', '#9370db',
    '#b8c4d0', '#7c7c8a', '#e06c75', '#61afef', '#98c379'
  ];

  var DOMAINS = {
    sunday:    { name: 'Moksha',  sanskrit: 'Moksha',  planet: 'Sun',     planetSkt: 'Surya',    symbol: '\u2609', color: '#e8e4dc', question: 'What am I releasing?',           theme: 'Liberation' },
    monday:    { name: 'Mula',    sanskrit: 'Mula',    planet: 'Moon',    planetSkt: 'Chandra',  symbol: '\u263D', color: '#7c7c8a', question: 'What is my foundation?',          theme: 'Root' },
    tuesday:   { name: 'Karma',   sanskrit: 'Karma',   planet: 'Mars',    planetSkt: 'Mangala',  symbol: '\u2642', color: '#c0392b', question: 'What action must I take?',        theme: 'Action' },
    wednesday: { name: 'Vidya',   sanskrit: 'Vidya',   planet: 'Mercury', planetSkt: 'Budha',    symbol: '\u263F', color: '#27ae60', question: 'What am I learning?',             theme: 'Knowledge' },
    thursday:  { name: 'Dharma',  sanskrit: 'Dharma',  planet: 'Jupiter', planetSkt: 'Guru',     symbol: '\u2643', color: '#d4a017', question: 'What is my purpose today?',       theme: 'Purpose' },
    friday:    { name: 'Prema',   sanskrit: 'Prema',   planet: 'Venus',   planetSkt: 'Shukra',   symbol: '\u2640', color: '#e8a0bf', question: 'What do I love about this work?', theme: 'Love' },
    saturday:  { name: 'Seva',    sanskrit: 'Seva',     planet: 'Saturn',  planetSkt: 'Shani',    symbol: '\u2644', color: '#b8c4d0', question: 'How am I of service?',            theme: 'Service' }
  };

  var DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  function todayDomain() {
    return DOMAINS[DAY_NAMES[new Date().getDay()]];
  }

  function dayOfYear(d) {
    var start = new Date(d.getFullYear(), 0, 0);
    var diff = d - start;
    return Math.floor(diff / 86400000);
  }

  function weekNumber(d) {
    var oneJan = new Date(d.getFullYear(), 0, 1);
    var days = Math.floor((d - oneJan) / 86400000);
    return Math.ceil((days + oneJan.getDay() + 1) / 7);
  }

  /** Build a squircle SVG string — solid (filled) or outlined (stroke only) */
  var SQUIRCLE_PATH = 'M10 0C13.5 0 16 0 17.5 1 19 2 20 4.5 20 10 20 15.5 19 18 17.5 19 16 20 13.5 20 10 20 6.5 20 4 20 2.5 19 1 18 0 15.5 0 10 0 4.5 1 2 2.5 1 4 0 6.5 0 10 0Z';

  function squircleSVG(color, solid, size) {
    size = size || 16;
    if (solid) {
      return '<svg viewBox="0 0 20 20" width="' + size + '" height="' + size + '" fill="none"><path d="' + SQUIRCLE_PATH + '" fill="' + color + '"/></svg>';
    }
    return '<svg viewBox="0 0 20 20" width="' + size + '" height="' + size + '" fill="none"><path d="' + SQUIRCLE_PATH + '" fill="none" stroke="' + color + '" stroke-width="2"/></svg>';
  }

  function esc(s) { return Utils.esc(s); }

  function hourLabel(h) {
    h = ((h % 24) + 24) % 24;
    if (h === 0) return '12a';
    if (h === 12) return '12p';
    if (h < 12) return h + 'a';
    return (h - 12) + 'p';
  }

  function projectsArray() {
    var out = (Data.state.projects || []).slice();
    out.sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0) || (a.name || '').localeCompare(b.name || ''); });
    return out;
  }

  function findProject(id) {
    var projects = Data.state.projects || [];
    for (var i = 0; i < projects.length; i++) {
      if (projects[i].id === id) return projects[i];
    }
    return null;
  }

  function findTask(id) {
    var tasks = Data.state.tasks || [];
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id === id) return tasks[i];
    }
    return null;
  }

  function projectColor(p) {
    return (p && p.color) ? p.color : '#c4956a';
  }

  /* ================================================================
     Toast
     ================================================================ */
  var _toastTimer = null;

  function toast(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('visible'); });
    });
    // Each toast gets its own timer — no shared state
    setTimeout(function () {
      el.classList.remove('visible');
      setTimeout(function () { if (el.parentNode) el.remove(); }, 300);
    }, 3000);
  }

  /* ================================================================
     State
     ================================================================ */
  var _typeToggleState = 0; // 0=normal, 1=grouped, 2=filter
  var _typeFilters = {};    // which types are visible (all true by default)
  var _activeTimer = null;  // { startedAt: Date, projectId, description }
  var _timerInterval = null;
  var _statusDropdown = null;
  var _colorPickerPopup = null;
  var _typeFilterModal = null;
  var _journalModalOpen = false;
  var _projectModalOpen = false;
  var _taskModalOpen = false;
  var _draggedProjectId = null;
  var _resizingCard = null;
  var _resizingSession = null;
  var _draggingSession = null;
  var _newSessionInput = null;
  var _sessionTracks = {}; // sessionId -> track number (local-only, for manual track positioning)
  var _viewDate = new Date(); // currently viewed day (can navigate forward/back)
  var _taskStatusFilters = {}; // status key -> boolean (true=visible)
  var _taskStatusFilterModal = null;

  // Initialize task status filters to all visible
  for (var sf = 0; sf < STATUSES.length; sf++) _taskStatusFilters[STATUSES[sf].key] = true;

  // Initialize type filters to all visible
  for (var ti = 0; ti < PROJECT_TYPES.length; ti++) _typeFilters[PROJECT_TYPES[ti]] = true;

  /* ================================================================
     Init
     ================================================================ */

  async function init() {
    try {
      await Data.init();
    } catch (err) {
      console.error('App init failed:', err);
      return;
    }

    renderDayInfo();
    renderProjects();
    renderTasks();
    setupAccordion();
    WorldClock.render('world-clock');
    WorldClock.startUpdates();
    renderTimeline();
    setupEventDelegation();
    setupTimelineInteractions();
    setupKeyboard();
    setupLeftColResize();

    // Listen for data changes
    Data.on('dataChanged', function () {
      renderProjects();
      renderTasks();
      renderTimelineSessions();
      updateTimelineHeader();
    });

    // Hide loading, show app
    var loading = document.getElementById('loading');
    if (loading) {
      loading.style.opacity = '0';
      setTimeout(function () { loading.style.display = 'none'; }, 500);
    }
    var app = document.getElementById('app');
    if (app) app.style.display = '';

    // Auto-scroll timeline to current time
    scrollTimelineToNow();

    // Start now-marker updates
    setInterval(updateNowMarker, 15000);
    updateNowMarker();
  }

  /* ================================================================
     Day Info
     ================================================================ */

  function renderDayInfo() {
    var dayName = DAY_NAMES[_viewDate.getDay()];
    var d = DOMAINS[dayName] || DOMAINS.monday;
    var container = document.getElementById('day-info');
    if (!container) return;

    var isToday = Utils.isoDate(_viewDate) === Utils.isoDate(new Date());

    container.innerHTML =
      '<div class="day-nav">' +
        '<button class="day-nav-btn" data-action="day-prev" title="Previous day">\u2039</button>' +
        '<button class="day-nav-btn" data-action="day-next" title="Next day">\u203A</button>' +
      '</div>' +
      '<div class="day-domain" style="color:' + d.color + '">' +
        '<span class="domain-pip" style="background:' + d.color + '"></span>' +
        '<span class="domain-symbol">' + d.symbol + '</span> ' +
        '<span class="domain-name">' + esc(d.name) + '</span>' +
        ' <span class="domain-sanskrit">' + esc(d.sanskrit) + '</span>' +
      '</div>' +
      '<div class="day-theme">' + esc(d.theme) + ' \u00B7 ' + esc(d.planet) + ' \u00B7 ' + esc(d.planetSkt) + '</div>' +
      '<div class="day-date">' + esc(Utils.formatDateFull(_viewDate)) + '</div>' +
      '<div class="day-numbers">Day ' + dayOfYear(_viewDate) + ' \u00B7 Week ' + weekNumber(_viewDate) +
        (isToday ? '' : ' <span class="day-back-link" data-action="day-today" style="cursor:pointer;color:var(--accent);margin-left:6px;font-size:10px;">today</span>') +
      '</div>' +
      '<div class="day-question">\u201C' + esc(d.question) + '\u201D</div>';
    container.querySelector('.day-domain').onclick = function () { openJournalModal(); };
  }

  function navigateDay(offset) {
    _viewDate = new Date(_viewDate);
    _viewDate.setDate(_viewDate.getDate() + offset);
    renderDayInfo();
    renderTimelineSessions();
    updateTimelineHeader();
    updateNowMarker();
    // Reload journal for the new date
    Data.loadTodayJournal(Utils.isoDate(_viewDate));
  }

  /* ================================================================
     Journal Modal
     ================================================================ */

  function openJournalModal() {
    if (_journalModalOpen) return;
    _journalModalOpen = true;

    var journal = Data.state.journal || null;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal">' +
        '<h2>' + esc(todayDomain().name) + ' \u2014 Journal</h2>' +
        '<div class="modal-field">' +
          '<label>What am I working on today?</label>' +
          '<textarea id="j-working" rows="2">' + esc(journal ? journal.working_on : '') + '</textarea>' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>What is my intention for the day?</label>' +
          '<textarea id="j-intention" rows="2">' + esc(journal ? journal.intention : '') + '</textarea>' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>What did I learn today?</label>' +
          '<textarea id="j-learned" rows="2">' + esc(journal ? journal.learned : '') + '</textarea>' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>What am I grateful for today?</label>' +
          '<textarea id="j-grateful" rows="2">' + esc(journal ? journal.grateful_for : '') + '</textarea>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn-cancel" id="j-cancel">Cancel</button>' +
          '<button class="btn-save" id="j-save">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeJournalModal(overlay);
    });
    overlay.querySelector('#j-cancel').onclick = function () { closeJournalModal(overlay); };
    overlay.querySelector('#j-save').onclick = function () {
      var entry = {
        entry_date: Utils.isoDate(new Date()),
        working_on: document.getElementById('j-working').value,
        intention: document.getElementById('j-intention').value,
        learned: document.getElementById('j-learned').value,
        grateful_for: document.getElementById('j-grateful').value
      };
      Data.saveJournal(entry).then(function() {
        toast('Journal saved', 'success');
        closeJournalModal(overlay);
      }).catch(function() {
        toast('Failed to save journal', 'error');
      });
    };

    // Focus first field
    setTimeout(function () {
      var first = overlay.querySelector('textarea');
      if (first) first.focus();
    }, 100);
  }

  function closeJournalModal(overlay) {
    _journalModalOpen = false;
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  /* ================================================================
     Accordion behavior
     ================================================================ */

  function setupAccordion() {
    // Target the outer .acc-col wrappers, not the inner scroll divs
    var colP = document.querySelector('.acc-projects');
    var colT = document.querySelector('.acc-tasks');
    if (!colP || !colT) return;

    colT.addEventListener('mouseenter', function () {
      colP.style.flex = '0.08';
      colT.style.flex = '3';
      colP.classList.add('collapsed');
      colT.classList.add('expanded');
    });

    colP.addEventListener('mouseenter', function () {
      colP.style.flex = '3';
      colT.style.flex = '0.12';
      colP.classList.remove('collapsed');
      colT.classList.remove('expanded');
    });
  }

  /* ================================================================
     Projects Column
     ================================================================ */

  function renderProjects() {
    var container = document.getElementById('col-projects');
    if (!container) return;

    var projects = projectsArray();
    var html = '';

    // Apply type filtering
    var filtered = projects.filter(function (p) {
      var t = p.type || 'other';
      return _typeFilters[t] !== false;
    });

    if (_typeToggleState === 1) {
      // Group by type
      var groups = {};
      for (var i = 0; i < filtered.length; i++) {
        var t = filtered[i].type || 'other';
        if (!groups[t]) groups[t] = [];
        groups[t].push(filtered[i]);
      }
      for (var gi = 0; gi < PROJECT_TYPES.length; gi++) {
        var type = PROJECT_TYPES[gi];
        if (!groups[type] || groups[type].length === 0) continue;
        html += '<div class="type-group-label">' + esc(type) + '</div>';
        for (var j = 0; j < groups[type].length; j++) {
          html += projectCardHTML(groups[type][j]);
        }
      }
    } else {
      for (var k = 0; k < filtered.length; k++) {
        html += projectCardHTML(filtered[k]);
      }
    }

    // Quick-add at bottom
    html += '<div class="quick-add">' +
      '<span class="plus" data-action="focus-project-input">+</span>' +
      '<input type="text" placeholder="New project..." id="project-quick-add" data-action-enter="add-project">' +
    '</div>';

    container.innerHTML = html;

    // Render footer with type toggle (outside scrollable area)
    var footer = document.getElementById('col-projects-footer');
    if (footer) {
      footer.innerHTML = '<button class="type-toggle' + (_typeToggleState > 0 ? ' active' : '') + '" data-action="type-toggle" title="Group / Filter by type">\u25A6</button>';
    }
  }

  function projectCardHTML(p) {
    var c = projectColor(p);
    var h = p.height || 48;
    return '<div class="project-card" data-project-id="' + p.id + '" ' +
      'style="--c:' + c + '; --card-h:' + h + 'px; border-left-color:' + c + '; background: color-mix(in srgb, ' + c + ' 5%, transparent);">' +
      '<span class="card-name">' + esc(p.name) + '</span>' +
      '<button class="edit-icon" data-action="edit-project" data-project-id="' + p.id + '">\u270E</button>' +
    '</div>';
  }

  /* ================================================================
     Project Edit Modal
     ================================================================ */

  function openProjectModal(projectId) {
    if (_projectModalOpen) return;
    _projectModalOpen = true;

    var p = projectId ? findProject(projectId) : null;
    var isEdit = !!p;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal project-modal">' +
        '<h2>' + (isEdit ? 'Edit Project' : 'New Project') + '</h2>' +
        '<div class="modal-field">' +
          '<label>Name</label>' +
          '<input type="text" id="pm-name" value="' + esc(p ? p.name : '') + '">' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>Description</label>' +
          '<textarea id="pm-desc" rows="2">' + esc(p ? p.description : '') + '</textarea>' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>Type</label>' +
          '<select id="pm-type">' +
            PROJECT_TYPES.map(function (t) {
              var sel = (p && p.type === t) ? ' selected' : (!p && t === 'personal' ? ' selected' : '');
              return '<option value="' + t + '"' + sel + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>Color</label>' +
          '<div class="color-row">' +
            '<input type="color" id="pm-color" value="' + (p && p.color ? p.color : '#c4956a') + '">' +
            '<div class="color-preview" id="pm-color-preview" style="background:' + (p && p.color ? p.color : '#c4956a') + '"></div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>Budget</label>' +
          '<input type="number" id="pm-budget" value="' + (p && p.budget ? p.budget : '') + '" placeholder="0">' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>Hourly Rate</label>' +
          '<input type="number" id="pm-rate" value="' + (p && p.hourly_rate ? p.hourly_rate : '') + '" placeholder="0">' +
        '</div>' +
        '<div class="modal-actions">' +
          (isEdit ? '<button class="btn-danger" id="pm-archive">Archive</button>' : '') +
          '<button class="btn-cancel" id="pm-cancel">Cancel</button>' +
          '<button class="btn-save" id="pm-save">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // Color preview update
    var colorInput = overlay.querySelector('#pm-color');
    var colorPreview = overlay.querySelector('#pm-color-preview');
    colorInput.addEventListener('input', function () {
      colorPreview.style.background = colorInput.value;
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeProjectModal(overlay);
    });
    overlay.querySelector('#pm-cancel').onclick = function () { closeProjectModal(overlay); };

    overlay.querySelector('#pm-save').onclick = async function () {
      var name = document.getElementById('pm-name').value.trim();
      if (!name) { toast('Project name is required', 'error'); return; }
      var obj = {
        name: name,
        description: document.getElementById('pm-desc').value.trim() || null,
        type: document.getElementById('pm-type').value,
        color: document.getElementById('pm-color').value,
        budget: parseFloat(document.getElementById('pm-budget').value) || null,
        hourly_rate: parseFloat(document.getElementById('pm-rate').value) || null
      };
      var saved = await Data.saveProject(obj, isEdit ? p.id : undefined);
      if (saved) {
        toast(isEdit ? 'Project updated' : 'Project created', 'success');
        closeProjectModal(overlay);
        renderProjects();
        renderTasks();
      } else {
        toast('Failed to save project', 'error');
      }
    };

    if (isEdit) {
      var archiveBtn = overlay.querySelector('#pm-archive');
      if (archiveBtn) {
        archiveBtn.onclick = async function () {
          if (!confirm('Archive "' + p.name + '"?')) return;
          var ok = await Data.archiveProject(p.id);
          if (ok) {
            toast('Project archived', 'success');
            closeProjectModal(overlay);
            renderProjects();
            renderTasks();
          }
        };
      }
    }

    setTimeout(function () {
      var nameInput = overlay.querySelector('#pm-name');
      if (nameInput) nameInput.focus();
    }, 100);
  }

  function closeProjectModal(overlay) {
    _projectModalOpen = false;
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  /* ================================================================
     Task Edit Modal
     ================================================================ */

  function openTaskModal(taskId) {
    if (_taskModalOpen) return;
    _taskModalOpen = true;

    var t = findTask(taskId);
    if (!t) { _taskModalOpen = false; return; }

    var projects = projectsArray();
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal project-modal">' +
        '<h2>Edit Task</h2>' +
        '<div class="modal-field">' +
          '<label>Title</label>' +
          '<input type="text" id="tm-title" value="' + esc(t.title || t.name || '') + '">' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>Project</label>' +
          '<select id="tm-project">' +
            '<option value="">Unassigned</option>' +
            projects.map(function (p) {
              var sel = (t.project_id === p.id) ? ' selected' : '';
              return '<option value="' + p.id + '"' + sel + '>' + esc(p.name) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn-danger" id="tm-archive">Archive</button>' +
          '<button class="btn-cancel" id="tm-cancel">Cancel</button>' +
          '<button class="btn-save" id="tm-save">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeTaskModal(overlay);
    });
    overlay.querySelector('#tm-cancel').onclick = function () { closeTaskModal(overlay); };

    overlay.querySelector('#tm-save').onclick = function () {
      var title = document.getElementById('tm-title').value.trim();
      if (!title) { toast('Task title is required', 'error'); return; }
      var projectId = document.getElementById('tm-project').value || null;
      Data.saveTask({ title: title, project_id: projectId }, taskId).then(function (saved) {
        if (saved) {
          toast('Task updated', 'success');
          closeTaskModal(overlay);
          renderTasks();
          renderTimelineSessions();
        }
      });
    };

    overlay.querySelector('#tm-archive').onclick = function () {
      Data.archiveTask(taskId).then(function (ok) {
        if (ok) {
          toast('Task archived', 'success');
          closeTaskModal(overlay);
          renderTasks();
        }
      });
    };
  }

  function closeTaskModal(overlay) {
    _taskModalOpen = false;
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  /* ================================================================
     Session Edit Modal
     ================================================================ */

  function openSessionEditModal(sessionId) {
    var session = null;
    for (var i = 0; i < Data.state.timeSessions.length; i++) {
      if (Data.state.timeSessions[i].id === sessionId) { session = Data.state.timeSessions[i]; break; }
    }
    if (!session) return;

    var projects = projectsArray();
    var projOptions = '<option value="">No project</option>';
    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      var sel = (session.project_id === p.id) ? ' selected' : '';
      projOptions += '<option value="' + p.id + '"' + sel + '>' + esc(p.name) + '</option>';
    }

    var startDt = new Date(session.started_at);
    var endDt = session.ended_at ? new Date(session.ended_at) : new Date();
    var startTime = String(startDt.getHours()).padStart(2,'0') + ':' + String(startDt.getMinutes()).padStart(2,'0');
    var endTime = String(endDt.getHours()).padStart(2,'0') + ':' + String(endDt.getMinutes()).padStart(2,'0');

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal" style="max-width:400px">' +
        '<h2>Edit Session</h2>' +
        '<div class="modal-field">' +
          '<label>Description</label>' +
          '<input type="text" id="se-desc" value="' + esc(session.description || '') + '">' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>Project</label>' +
          '<select id="se-project">' + projOptions + '</select>' +
        '</div>' +
        '<div style="display:flex;gap:12px;">' +
          '<div class="modal-field" style="flex:1">' +
            '<label>Start time</label>' +
            '<input type="time" id="se-start" value="' + startTime + '">' +
          '</div>' +
          '<div class="modal-field" style="flex:1">' +
            '<label>End time</label>' +
            '<input type="time" id="se-end" value="' + endTime + '">' +
          '</div>' +
        '</div>' +
        '<div class="modal-field">' +
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">' +
            '<input type="checkbox" id="se-billable"' + (session.is_billable ? ' checked' : '') + ' style="width:auto;accent-color:var(--accent);">' +
            'Billable' +
          '</label>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn-danger" id="se-delete" style="margin-right:auto;">Delete</button>' +
          '<button class="btn-cancel" id="se-cancel">Cancel</button>' +
          '<button class="btn-save" id="se-save">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#se-cancel').onclick = function () { overlay.remove(); };
    overlay.querySelector('#se-delete').onclick = function () {
      if (!confirm('Delete this session?')) return;
      Data.deleteTimeSession(sessionId).then(function () {
        toast('Session deleted', 'info');
        overlay.remove();
        renderTimelineSessions();
        updateTimelineHeader();
      });
    };
    overlay.querySelector('#se-save').onclick = function () {
      var desc = document.getElementById('se-desc').value;
      var projectId = document.getElementById('se-project').value || null;
      var startVal = document.getElementById('se-start').value;
      var endVal = document.getElementById('se-end').value;
      var billable = document.getElementById('se-billable').checked;

      // Build new timestamps preserving the date
      var newStart = new Date(startDt);
      var sp = startVal.split(':');
      newStart.setHours(parseInt(sp[0]), parseInt(sp[1]), 0, 0);
      var newEnd = new Date(endDt);
      var ep = endVal.split(':');
      newEnd.setHours(parseInt(ep[0]), parseInt(ep[1]), 0, 0);

      // Preserve the session's track
      var sessionTrack = (session.track !== undefined && session.track !== null) ? session.track : (_sessionTracks[sessionId] !== undefined ? _sessionTracks[sessionId] : 0);

      Data.saveTimeSession({
        description: desc,
        project_id: projectId,
        started_at: newStart.toISOString(),
        ended_at: newEnd.toISOString(),
        is_billable: billable,
        track: sessionTrack
      }, sessionId).then(function () {
        toast('Session updated', 'success');
        overlay.remove();
        renderTimelineSessions();
        updateTimelineHeader();
      }).catch(function () {
        toast('Failed to save session', 'error');
      });
    };

    setTimeout(function () { document.getElementById('se-desc').focus(); }, 50);
  }

  /* ================================================================
     Color Picker (popup on left-border click)
     ================================================================ */

  function showColorPicker(projectId, anchorEl) {
    closePopups();
    var p = findProject(projectId);
    if (!p) return;

    var popup = document.createElement('div');
    popup.className = 'color-picker-popup show';
    _colorPickerPopup = popup;

    var swatchesHtml = '<div class="color-swatches">';
    for (var i = 0; i < DEFAULT_COLORS.length; i++) {
      swatchesHtml += '<div class="color-swatch" data-color="' + DEFAULT_COLORS[i] + '" style="background:' + DEFAULT_COLORS[i] + '"></div>';
    }
    swatchesHtml += '</div>';
    popup.innerHTML = swatchesHtml + '<input type="color" value="' + (p.color || '#c4956a') + '">';

    var rect = anchorEl.getBoundingClientRect();
    popup.style.top = rect.bottom + 4 + 'px';
    popup.style.left = rect.left + 'px';
    document.body.appendChild(popup);

    function applyColor(color) {
      Data.saveProject({ color: color }, projectId).then(function () {
        renderProjects();
        renderTasks();
        renderTimelineSessions();
      });
      closePopups();
    }

    popup.querySelectorAll('.color-swatch').forEach(function (sw) {
      sw.onclick = function () { applyColor(sw.dataset.color); };
    });
    popup.querySelector('input[type="color"]').addEventListener('change', function () {
      applyColor(this.value);
    });
  }

  /* ================================================================
     Status Dropdown
     ================================================================ */

  function showStatusDropdown(taskId, anchorEl) {
    closePopups();
    var task = findTask(taskId);
    if (!task) return;

    var popup = document.createElement('div');
    popup.className = 'status-dropdown show';
    _statusDropdown = popup;

    var html = '';
    for (var i = 0; i < STATUSES.length; i++) {
      var s = STATUSES[i];
      var isCurrent = task.status === s.key;
      html += '<div class="status-option' + (isCurrent ? ' current' : '') + '" data-status="' + s.key + '">' +
        squircleSVG(s.color, s.solid, 14) +
        '<span>' + esc(s.label) + '</span>' +
      '</div>';
    }
    popup.innerHTML = html;

    var rect = anchorEl.getBoundingClientRect();
    popup.style.top = rect.bottom + 4 + 'px';
    popup.style.left = rect.left + 'px';
    document.body.appendChild(popup);

    popup.querySelectorAll('.status-option').forEach(function (opt) {
      opt.onclick = function () {
        var newStatus = opt.dataset.status;
        Data.saveTask({ status: newStatus }, taskId).then(function () {
          renderTasks();
          renderTimelineSessions();
        });
        closePopups();
      };
    });
  }

  /* ================================================================
     Type Filter Modal
     ================================================================ */

  function showTypeFilter(anchorEl) {
    closePopups();
    var popup = document.createElement('div');
    popup.className = 'type-filter-modal show';
    _typeFilterModal = popup;

    var html = '';
    for (var i = 0; i < PROJECT_TYPES.length; i++) {
      var t = PROJECT_TYPES[i];
      var active = _typeFilters[t] !== false;
      html += '<div class="type-filter-option' + (active ? ' active' : '') + '" data-type="' + t + '">' +
        '<span>' + (active ? '\u2611' : '\u2610') + '</span>' +
        '<span>' + t.charAt(0).toUpperCase() + t.slice(1) + '</span>' +
      '</div>';
    }
    popup.innerHTML = html;

    var rect = anchorEl.getBoundingClientRect();
    popup.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    popup.style.left = rect.left + 'px';
    document.body.appendChild(popup);

    popup.querySelectorAll('.type-filter-option').forEach(function (opt) {
      opt.onclick = function () {
        var type = opt.dataset.type;
        _typeFilters[type] = !_typeFilters[type];
        opt.classList.toggle('active');
        opt.querySelector('span').textContent = _typeFilters[type] ? '\u2611' : '\u2610';
        renderProjects();
      };
    });
  }

  function closePopups() {
    if (_statusDropdown && _statusDropdown.parentNode) _statusDropdown.parentNode.removeChild(_statusDropdown);
    _statusDropdown = null;
    if (_colorPickerPopup && _colorPickerPopup.parentNode) _colorPickerPopup.parentNode.removeChild(_colorPickerPopup);
    _colorPickerPopup = null;
    if (_typeFilterModal && _typeFilterModal.parentNode) _typeFilterModal.parentNode.removeChild(_typeFilterModal);
    _typeFilterModal = null;
    if (_taskStatusFilterModal && _taskStatusFilterModal.parentNode) _taskStatusFilterModal.parentNode.removeChild(_taskStatusFilterModal);
    _taskStatusFilterModal = null;
  }

  /* ================================================================
     Tasks Column
     ================================================================ */

  function renderTasks() {
    var container = document.getElementById('col-tasks');
    if (!container) return;

    var projects = projectsArray();
    var html = '';

    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      var c = projectColor(p);
      var tasks = Data.projectTasks(p.id);

      // Also include tasks that have a feature_id under this project
      var featureTasks = [];
      Data.state.tasks.forEach(function (t) {
        if (t.project_id === p.id) {
          // Check not already in projectTasks (which excludes feature tasks)
          var found = false;
          for (var x = 0; x < tasks.length; x++) {
            if (tasks[x].id === t.id) { found = true; break; }
          }
          if (!found) featureTasks.push(t);
        }
      });
      var allTasks = tasks.concat(featureTasks);
      allTasks.sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });

      var groupFlex = allTasks.length || 1;
      html += '<div class="task-group" style="--c:' + c + '; --group-flex:' + groupFlex + '" data-project-id="' + p.id + '">' +
        '<span class="task-group-label">' + esc(p.name) + '</span>';

      for (var j = 0; j < allTasks.length; j++) {
        var t = allTasks[j];
        if (!taskPassesStatusFilter(t)) continue;
        var statusInfo = STATUS_MAP[t.status] || STATUS_MAP['idea'];
        var isDone = t.status === 'done' || t.status === 'integrated';
        html += '<div class="task-row' + (isDone ? ' done' : '') + '" data-task-id="' + t.id + '" draggable="true">' +
          '<span class="squircle-btn" data-action="status-click" data-task-id="' + t.id + '">' +
            squircleSVG(statusInfo.color, statusInfo.solid, 16) +
          '</span>' +
          '<span class="task-label">' + esc(t.title || t.name || '') + '</span>' +
          '<span class="task-edit-icon" data-action="edit-task" data-task-id="' + t.id + '" title="Edit">\u270E</span>' +
          '<span class="task-delete-icon" data-action="delete-task" data-task-id="' + t.id + '" title="Delete">\u00D7</span>' +
        '</div>';
      }

      if (allTasks.length === 0) {
        html += '<div class="task-row task-empty" style="min-height:8px"></div>';
      }

      // Per-group quick-add
      html += '<div class="task-quick-add">' +
        '<input type="text" placeholder="+ Add task..." data-project-id="' + p.id + '" data-action-enter="add-task-to-project">' +
      '</div>';

      html += '</div>';
    }

    // Unassigned tasks
    var unassigned = [];
    Data.state.tasks.forEach(function (t) {
      if (!t.project_id) unassigned.push(t);
    });
    if (unassigned.length > 0) {
      html += '<div class="task-group" style="--c:#706b62; --group-flex:' + unassigned.length + '">' +
        '<span class="task-group-label">Unassigned</span>';
      for (var u = 0; u < unassigned.length; u++) {
        var ut = unassigned[u];
        if (!taskPassesStatusFilter(ut)) continue;
        var us = STATUS_MAP[ut.status] || STATUS_MAP['idea'];
        var uDone = ut.status === 'done' || ut.status === 'integrated';
        html += '<div class="task-row' + (uDone ? ' done' : '') + '" data-task-id="' + ut.id + '" draggable="true">' +
          '<span class="squircle-btn" data-action="status-click" data-task-id="' + ut.id + '">' +
            squircleSVG(us.color, us.solid, 16) +
          '</span>' +
          '<span class="task-label">' + esc(ut.title || ut.name || '') + '</span>' +
          '<span class="task-edit-icon" data-action="edit-task" data-task-id="' + ut.id + '" title="Edit">\u270E</span>' +
          '<span class="task-delete-icon" data-action="delete-task" data-task-id="' + ut.id + '" title="Delete">\u00D7</span>' +
        '</div>';
      }
      // Per-group quick-add for unassigned
      html += '<div class="task-quick-add">' +
        '<input type="text" placeholder="+ Add task..." data-project-id="" data-action-enter="add-task-to-project">' +
      '</div>';
      html += '</div>';
    }

    container.innerHTML = html;

    // Render footer with filter icon (outside scrollable area)
    var footer = document.getElementById('col-tasks-footer');
    if (footer) {
      footer.innerHTML = '<button class="task-status-filter-btn" data-action="task-status-filter" title="Filter by status">\u25C9</button>';
    }
  }

  function taskPassesStatusFilter(task) {
    return _taskStatusFilters[task.status] !== false;
  }

  function showTaskStatusFilter(anchorEl) {
    closePopups();
    if (_taskStatusFilterModal && _taskStatusFilterModal.parentNode) {
      _taskStatusFilterModal.remove();
      _taskStatusFilterModal = null;
      return;
    }

    var popup = document.createElement('div');
    popup.className = 'type-filter-modal show';
    _taskStatusFilterModal = popup;

    var html = '';
    for (var i = 0; i < STATUSES.length; i++) {
      var s = STATUSES[i];
      var active = _taskStatusFilters[s.key] !== false;
      html += '<div class="type-filter-option' + (active ? ' active' : '') + '" data-status="' + s.key + '">' +
        squircleSVG(s.color, s.solid, 14) +
        '<span>' + esc(s.label) + '</span>' +
        '<span style="margin-left:auto;font-size:11px;">' + (active ? '\u2713' : '') + '</span>' +
      '</div>';
    }
    popup.innerHTML = html;

    var rect = anchorEl.getBoundingClientRect();
    popup.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    popup.style.left = rect.left + 'px';
    document.body.appendChild(popup);

    popup.querySelectorAll('.type-filter-option').forEach(function (opt) {
      opt.onclick = function () {
        var status = opt.dataset.status;
        _taskStatusFilters[status] = !(_taskStatusFilters[status] !== false);
        opt.classList.toggle('active');
        var check = opt.querySelector('span:last-child');
        if (check) check.textContent = _taskStatusFilters[status] ? '\u2713' : '';
        renderTasks();
      };
    });
  }

  /* ================================================================
     Timeline
     ================================================================ */

  var TRACK_HEIGHT = 40; // height of each session track lane

  function renderTimeline() {
    var container = document.getElementById('timeline');
    if (!container) return;

    var html = '';

    // Header bar
    html += '<div class="timeline-header">' +
      '<span class="timeline-header-title">Timeline</span>' +
      '<span class="timeline-header-total" id="timeline-total"></span>' +
      '<div class="timeline-header-actions">' +
        '<button class="timer-btn" id="timer-btn" data-action="toggle-timer">' +
          '\u25B6 Start' +
        '</button>' +
      '</div>' +
    '</div>';

    // Horizontal inner (width matches world clock)
    html += '<div class="timeline-inner" id="timeline-inner">';

    // Grid lines (vertical, one per hour)
    html += '<div class="timeline-grid" id="timeline-grid">';
    for (var g = 0; g <= 24; g++) {
      var pct = (g / 24) * 100;
      html += '<div class="timeline-hour-line" style="left:' + pct + '%"></div>';
    }
    html += '</div>';

    // Now marker (vertical line)
    html += '<div class="timeline-now-marker" id="timeline-now" style="left:0"></div>';

    // Session tracks container
    html += '<div class="timeline-tracks" id="timeline-sessions"></div>';

    // Fixed schedule blocks (sleep, lunch, dinner)
    html += '<div class="timeline-schedule">';
    // Sleep: 1am - 9am
    html += '<div class="schedule-block sleep" style="left:' + (1/24*100) + '%; width:' + (8/24*100) + '%;">' +
      '<span class="schedule-label">Sleep</span></div>';
    // Lunch: 1pm - 1:45pm (0.75 hours)
    html += '<div class="schedule-block meal" style="left:' + (13/24*100) + '%; width:' + (0.75/24*100) + '%;">' +
      '<span class="schedule-label">Lunch</span></div>';
    // Dinner: 7pm - 7:45pm (0.75 hours)
    html += '<div class="schedule-block meal" style="left:' + (19/24*100) + '%; width:' + (0.75/24*100) + '%;">' +
      '<span class="schedule-label">Dinner</span></div>';
    html += '</div>';

    html += '</div>'; // end timeline-inner

    container.innerHTML = html;

    renderTimelineSessions();
    updateTimelineHeader();
    updateNowMarker();
  }

  /**
   * Assign sessions to tracks (lanes) to avoid overlapping.
   * Returns an array of { session, track } objects.
   */
  function assignSessionTracks(sessions, ghost) {
    // Build items with start/end hours
    var items = [];
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      var sd = new Date(s.started_at);
      var ed = s.ended_at ? new Date(s.ended_at) : new Date();
      var sh = sd.getHours() + sd.getMinutes() / 60;
      var eh = ed.getHours() + ed.getMinutes() / 60;
      if (eh - sh < 0.33) eh = sh + 0.33;
      // Check if this session has a track (from DB or local override)
      var manualTrack = (s.track !== undefined && s.track !== null) ? s.track : ((s.id && _sessionTracks[s.id] !== undefined) ? _sessionTracks[s.id] : -1);
      items.push({ session: s, startH: sh, endH: eh, isGhost: false, manualTrack: manualTrack });
    }
    if (ghost) {
      items.push(ghost);
    }
    // Sort by start hour
    items.sort(function (a, b) { return a.startH - b.startH; });

    // First pass: place manually-tracked items
    var trackEnds = []; // end hour of each track
    var maxTrack = 0;
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      if (item.manualTrack >= 0) {
        item.track = item.manualTrack;
        // Ensure trackEnds array is long enough
        while (trackEnds.length <= item.track) trackEnds.push(0);
        trackEnds[item.track] = Math.max(trackEnds[item.track] || 0, item.endH);
        if (item.track + 1 > maxTrack) maxTrack = item.track + 1;
      }
    }

    // Second pass: greedy assignment for items without manual track
    for (var k = 0; k < items.length; k++) {
      var item = items[k];
      if (item.manualTrack >= 0) continue; // already placed
      var placed = false;
      for (var t = 0; t < trackEnds.length; t++) {
        if (item.startH >= (trackEnds[t] || 0)) {
          trackEnds[t] = item.endH;
          item.track = t;
          placed = true;
          break;
        }
      }
      if (!placed) {
        item.track = trackEnds.length;
        trackEnds.push(item.endH);
      }
      if (item.track + 1 > maxTrack) maxTrack = item.track + 1;
    }
    return { items: items, trackCount: Math.max(maxTrack, trackEnds.length, 1) };
  }

  function renderTimelineSessions() {
    var container = document.getElementById('timeline-sessions');
    if (!container) return;

    // Filter sessions to the viewed day using LOCAL date comparison
    var viewStr = Utils.isoDate(_viewDate);
    var sessions = Data.state.timeSessions.filter(function (s) {
      if (!s.started_at) return false;
      return Utils.isoDate(new Date(s.started_at)) === viewStr;
    });

    // Build ghost item if timer running
    var ghost = null;
    if (_activeTimer) {
      var gStart = _activeTimer.startedAt;
      var gNow = new Date();
      var gsh = gStart.getHours() + gStart.getMinutes() / 60;
      var geh = gNow.getHours() + gNow.getMinutes() / 60;
      if (geh - gsh < 0.33) geh = gsh + 0.33;
      ghost = { session: null, startH: gsh, endH: geh, isGhost: true };
    }

    var layout = assignSessionTracks(sessions, ghost);

    // Set container height based on track count
    container.style.height = (layout.trackCount * TRACK_HEIGHT) + 'px';

    var html = '';
    for (var i = 0; i < layout.items.length; i++) {
      var item = layout.items[i];
      if (item.isGhost) {
        html += timerGhostHTML(item.startH, item.endH, item.track);
      } else {
        html += sessionBlockHTML(item.session, item.startH, item.endH, item.track);
      }
    }

    container.innerHTML = html;
  }

  function sessionBlockHTML(s, startHour, endHour, track) {
    var duration = endHour - startHour;
    var leftPct = (startHour / 24) * 100;
    var widthPct = (duration / 24) * 100;
    var topPx = track * TRACK_HEIGHT;

    // Get project color
    var color = '#c4956a';
    if (s.project_id) {
      var proj = findProject(s.project_id);
      if (proj && proj.color) color = proj.color;
    }

    var startTime = Utils.formatTime(s.started_at);
    var endTime = s.ended_at ? Utils.formatTime(s.ended_at) : 'now';

    return '<div class="timeline-session" data-session-id="' + s.id + '" data-track="' + track + '" ' +
      'style="left:' + leftPct + '%; width:' + widthPct + '%; top:' + topPx + 'px; ' +
      'background: color-mix(in srgb, ' + color + ' 25%, transparent); border-left: 3px solid ' + color + ';">' +
      '<div class="resize-left"></div>' +
      '<div class="session-title" data-action="edit-session" data-session-id="' + s.id + '">' + esc(s.description || 'Untitled') + '</div>' +
      '<div class="session-time">' + startTime + ' \u2013 ' + endTime + '</div>' +
      '<button class="session-edit-btn" data-action="edit-session" data-session-id="' + s.id + '" title="Edit">\u270E</button>' +
      '<button class="session-delete" data-action="delete-session" data-session-id="' + s.id + '">\u2715</button>' +
      '<div class="resize-right"></div>' +
    '</div>';
  }

  function timerGhostHTML(startHour, endHour, track) {
    if (!_activeTimer) return '';
    var duration = endHour - startHour;
    var leftPct = (startHour / 24) * 100;
    var widthPct = (duration / 24) * 100;
    var topPx = track * TRACK_HEIGHT;

    var color = '#c4956a';
    if (_activeTimer.projectId) {
      var proj = findProject(_activeTimer.projectId);
      if (proj && proj.color) color = proj.color;
    }

    return '<div class="timeline-session timer-ghost" ' +
      'style="left:' + leftPct + '%; width:' + widthPct + '%; top:' + topPx + 'px; ' +
      'background: color-mix(in srgb, ' + color + ' 20%, transparent); border-left: 3px solid ' + color + ';">' +
      '<div class="session-title">' + esc(_activeTimer.description || 'Timer running...') + '</div>' +
      '<div class="session-time">' + Utils.formatTime(_activeTimer.startedAt.toISOString()) + ' \u2013 now</div>' +
    '</div>';
  }

  function updateTimelineHeader() {
    var totalEl = document.getElementById('timeline-total');
    if (totalEl) {
      var sessions = Data.todaySessions();
      var mins = 0;
      for (var i = 0; i < sessions.length; i++) {
        mins += parseFloat(sessions[i].duration_min || 0);
      }
      totalEl.textContent = Utils.formatDuration(mins) + ' today';
    }
  }

  function updateNowMarker() {
    var marker = document.getElementById('timeline-now');
    if (!marker) return;
    var now = new Date();
    var h = now.getHours() + now.getMinutes() / 60;
    var pct = (h / 24) * 100;
    marker.style.left = pct + '%';

    // Update timer ghost if running
    if (_activeTimer) {
      renderTimelineSessions();
    }
  }

  function scrollTimelineToNow() {
    // No scrolling needed for horizontal timeline — it shows all 24 hours
  }

  /* ================================================================
     Timer
     ================================================================ */

  function toggleTimer() {
    if (_activeTimer) {
      stopTimer();
    } else {
      startTimer();
    }
  }

  function startTimer() {
    // Use the first active project as default, or none
    var projects = projectsArray();
    var defaultProject = projects.length > 0 ? projects[0] : null;

    _activeTimer = {
      startedAt: new Date(),
      projectId: defaultProject ? defaultProject.id : null,
      description: ''
    };

    // Prompt for description
    var desc = prompt('What are you working on?');
    if (desc === null) {
      _activeTimer = null;
      return;
    }
    _activeTimer.description = desc;

    // Update button
    var btn = document.getElementById('timer-btn');
    if (btn) {
      btn.classList.add('running');
      btn.innerHTML = '\u25A0 Stop';
    }

    // Start interval for ghost block updates
    _timerInterval = setInterval(function () {
      renderTimelineSessions();
    }, 30000); // update every 30s

    renderTimelineSessions();
    toast('Timer started', 'info');
  }

  async function stopTimer() {
    if (!_activeTimer) return;

    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

    var session = {
      started_at: _activeTimer.startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      project_id: _activeTimer.projectId,
      description: _activeTimer.description
    };

    var saved = await Data.saveTimeSession(session);
    _activeTimer = null;

    // Update button
    var btn = document.getElementById('timer-btn');
    if (btn) {
      btn.classList.remove('running');
      btn.innerHTML = '\u25B6 Start';
    }

    if (saved) {
      toast('Session saved (' + Utils.formatDuration(saved.duration_min) + ')', 'success');
    }
    renderTimelineSessions();
    updateTimelineHeader();
  }

  /* ================================================================
     Timeline interactions (double-click to add, drag to move/resize)
     ================================================================ */

  /** Convert an X pixel position within timeline-inner to a decimal hour (0-24). */
  function xToHour(inner, clientX) {
    var rect = inner.getBoundingClientRect();
    var relX = clientX - rect.left;
    var pct = Math.max(0, Math.min(1, relX / rect.width));
    return pct * 24;
  }

  function setupTimelineInteractions() {
    var grid = document.getElementById('timeline-grid');
    if (!grid) return;

    // Double-click to create new session
    grid.addEventListener('dblclick', function (e) {
      // If double-clicking on an existing session, open edit modal instead
      var sessionEl = e.target.closest('.timeline-session');
      if (sessionEl && sessionEl.dataset.sessionId) {
        openSessionEditModal(sessionEl.dataset.sessionId);
        return;
      }
      var inner = document.getElementById('timeline-inner');
      if (!inner) return;
      var hour = xToHour(inner, e.clientX);
      var roundedHour = Math.round(hour * 4) / 4; // snap to 15 min
      createSessionAtHour(roundedHour);
    });

    // Drop target for dragged tasks
    var timeline = document.getElementById('timeline');
    if (timeline) {
      timeline.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        timeline.classList.add('drop-target');
      });
      timeline.addEventListener('dragleave', function () {
        timeline.classList.remove('drop-target');
      });
      timeline.addEventListener('drop', function (e) {
        e.preventDefault();
        timeline.classList.remove('drop-target');
        var taskId = e.dataTransfer.getData('text/task-id');
        if (!taskId) return;
        var task = findTask(taskId);
        if (!task) return;

        var inner = document.getElementById('timeline-inner');
        if (!inner) return;
        var hour = Math.floor(xToHour(inner, e.clientX) * 2) / 2;

        var startDate = new Date();
        startDate.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
        var endDate = new Date(startDate.getTime() + 3600000); // 1 hour

        Data.saveTimeSession({
          started_at: startDate.toISOString(),
          ended_at: endDate.toISOString(),
          project_id: task.project_id || null,
          description: task.title || task.name || ''
        }).then(function () {
          renderTimelineSessions();
          updateTimelineHeader();
          toast('Session added from task', 'success');
        });
      });
    }

    // Session drag and resize via mousedown delegation
    document.addEventListener('mousedown', function (e) {
      // Check for session resize handles (now left/right)
      var resizeLeft = e.target.closest('.timeline-session .resize-left');
      var resizeRight = e.target.closest('.timeline-session .resize-right');
      if (resizeLeft || resizeRight) {
        e.preventDefault();
        var sessionEl = e.target.closest('.timeline-session');
        var sessionId = sessionEl.dataset.sessionId;
        startSessionResize(sessionId, sessionEl, resizeLeft ? 'left' : 'right', e);
        return;
      }

      // Check for session drag (move horizontally)
      var sessionEl = e.target.closest('.timeline-session');
      if (sessionEl && !e.target.closest('.session-delete') && !e.target.closest('.session-edit-btn') && !e.target.closest('[data-action="edit-session"]') && !e.target.closest('.resize-left') && !e.target.closest('.resize-right')) {
        e.preventDefault();
        startSessionDrag(sessionEl.dataset.sessionId, sessionEl, e);
      }
    });
  }

  function createSessionAtHour(hour) {
    var startDate = new Date();
    startDate.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
    var endDate = new Date(startDate.getTime() + 3600000);

    // Show inline input positioned horizontally
    var inner = document.getElementById('timeline-inner');
    if (!inner) return;

    var leftPct = (hour / 24) * 100;
    var widthPct = (1 / 24) * 100; // 1 hour wide
    var inputWrap = document.createElement('div');
    inputWrap.className = 'timeline-session';
    inputWrap.style.cssText = 'left:' + leftPct + '%; width:' + widthPct + '%; top:2px; height:36px; background:rgba(196,149,106,0.15); border-left:3px solid var(--accent); z-index:10;';
    inputWrap.innerHTML = '<input class="session-name-input" placeholder="What were you working on?" autofocus>';
    inner.appendChild(inputWrap);

    var input = inputWrap.querySelector('input');
    input.focus();

    function save() {
      var desc = input.value.trim() || 'Untitled';
      inputWrap.remove();

      var projects = projectsArray();
      var projectId = projects.length > 0 ? projects[0].id : null;

      Data.saveTimeSession({
        started_at: startDate.toISOString(),
        ended_at: endDate.toISOString(),
        project_id: projectId,
        description: desc
      }).then(function () {
        renderTimelineSessions();
        updateTimelineHeader();
      });
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { inputWrap.remove(); }
    });
    input.addEventListener('blur', function () {
      setTimeout(function () {
        if (inputWrap.parentNode) save();
      }, 200);
    });
  }

  function startSessionDrag(sessionId, el, startEvent) {
    var session = Data.state.timeSessions.find(function (s) { return s.id === sessionId; });
    if (!session) return;

    var inner = document.getElementById('timeline-inner');
    var tracksContainer = document.getElementById('timeline-sessions');
    if (!inner || !tracksContainer) return;
    var innerRect = inner.getBoundingClientRect();
    var startX = startEvent.clientX;
    var startY = startEvent.clientY;
    // Read current left % and convert to px for dragging
    var origLeftPct = parseFloat(el.style.left);
    var origLeftPx = (origLeftPct / 100) * innerRect.width;
    var origTopPx = parseInt(el.style.top, 10) || 0;

    _draggingSession = sessionId;
    document.body.classList.add('is-dragging');

    function onMove(e) {
      // Horizontal movement (time)
      var dx = e.clientX - startX;
      var newLeftPx = Math.max(0, origLeftPx + dx);
      var newLeftPct = (newLeftPx / innerRect.width) * 100;
      var widthPct = parseFloat(el.style.width);
      if (newLeftPct + widthPct > 100) newLeftPct = 100 - widthPct;
      el.style.left = newLeftPct + '%';

      // Vertical movement (track)
      var dy = e.clientY - startY;
      var newTopPx = origTopPx + dy;
      var newTrack = Math.max(0, Math.round(newTopPx / TRACK_HEIGHT));
      el.style.top = (newTrack * TRACK_HEIGHT) + 'px';

      // Grow the tracks container if dragging beyond current bounds
      var neededHeight = (newTrack + 1) * TRACK_HEIGHT;
      if (neededHeight > tracksContainer.offsetHeight) {
        tracksContainer.style.height = neededHeight + 'px';
      }
    }

    function onUp(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('is-dragging');
      _draggingSession = null;

      var finalLeftPct = parseFloat(el.style.left);
      var newHour = (finalLeftPct / 100) * 24;
      // Snap to 15-minute increments
      newHour = Math.round(newHour * 4) / 4;
      var finalTrack = Math.max(0, Math.round(parseInt(el.style.top, 10) / TRACK_HEIGHT));

      var origStart = new Date(session.started_at);
      var origEnd = session.ended_at ? new Date(session.ended_at) : new Date();
      var durationMs = origEnd - origStart;

      var newStart = new Date(origStart);
      newStart.setHours(Math.floor(newHour), Math.round((newHour % 1) * 60), 0, 0);
      var newEnd = new Date(newStart.getTime() + durationMs);

      // Store the manually-set track locally
      _sessionTracks[sessionId] = finalTrack;

      // Optimistic: update local state immediately so no flicker
      session.started_at = newStart.toISOString();
      session.ended_at = newEnd.toISOString();
      session.track = finalTrack;

      // Save in background (update, not delete+recreate)
      Data.saveTimeSession({
        started_at: newStart.toISOString(),
        ended_at: newEnd.toISOString(),
        project_id: session.project_id,
        description: session.description,
        is_billable: session.is_billable,
        track: finalTrack
      }, sessionId);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startSessionResize(sessionId, el, edge, startEvent) {
    var session = Data.state.timeSessions.find(function (s) { return s.id === sessionId; });
    if (!session) return;

    var inner = document.getElementById('timeline-inner');
    if (!inner) return;
    var innerW = inner.getBoundingClientRect().width;
    var startX = startEvent.clientX;
    var origLeftPct = parseFloat(el.style.left);
    var origWidthPct = parseFloat(el.style.width);
    var minWidthPct = (0.25 / 24) * 100; // 15 min minimum

    _resizingSession = sessionId;
    document.body.classList.add('is-dragging');

    function onMove(e) {
      var dx = e.clientX - startX;
      var dPct = (dx / innerW) * 100;
      if (edge === 'right') {
        var newW = Math.max(minWidthPct, origWidthPct + dPct);
        if (origLeftPct + newW > 100) newW = 100 - origLeftPct;
        el.style.width = newW + '%';
      } else {
        var newLeft = origLeftPct + dPct;
        var newW = origWidthPct - dPct;
        if (newW < minWidthPct) return;
        if (newLeft < 0) { newLeft = 0; newW = origLeftPct + origWidthPct; }
        el.style.left = newLeft + '%';
        el.style.width = newW + '%';
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('is-dragging');
      _resizingSession = null;

      var finalLeftPct = parseFloat(el.style.left);
      var finalWidthPct = parseFloat(el.style.width);
      var startHour = (finalLeftPct / 100) * 24;
      var endHour = ((finalLeftPct + finalWidthPct) / 100) * 24;
      // Snap to 15-minute increments
      startHour = Math.round(startHour * 4) / 4;
      endHour = Math.round(endHour * 4) / 4;

      var today = new Date();
      var newStart = new Date(today);
      newStart.setHours(Math.floor(startHour), Math.round((startHour % 1) * 60), 0, 0);
      var newEnd = new Date(today);
      newEnd.setHours(Math.floor(endHour), Math.round((endHour % 1) * 60), 0, 0);

      // Preserve the session's track
      var sessionTrack = (session.track !== undefined && session.track !== null) ? session.track : (_sessionTracks[sessionId] !== undefined ? _sessionTracks[sessionId] : 0);

      // Optimistic: update local state immediately
      session.started_at = newStart.toISOString();
      session.ended_at = newEnd.toISOString();

      // Save in background (update, not delete+recreate)
      Data.saveTimeSession({
        started_at: newStart.toISOString(),
        ended_at: newEnd.toISOString(),
        project_id: session.project_id,
        description: session.description,
        is_billable: session.is_billable,
        track: sessionTrack
      }, sessionId);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* ================================================================
     Project card reorder (drag) and resize (height)
     ================================================================ */

  function setupProjectDrag(card, projectId) {
    // This is handled via event delegation in setupEventDelegation
  }

  function startProjectResize(card, projectId, startEvent) {
    var startY = startEvent.clientY;
    var startHeight = card.offsetHeight;
    document.body.classList.add('is-dragging');

    function onMove(e) {
      var dy = e.clientY - startY;
      var newH = Math.max(32, startHeight + dy);
      card.style.setProperty('--card-h', newH + 'px');
      card.style.height = newH + 'px';
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('is-dragging');
      card.classList.remove('resize-hover');

      var finalH = card.offsetHeight;
      Data.saveProject({ height: finalH }, projectId);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* ================================================================
     Event delegation
     ================================================================ */

  function setupEventDelegation() {
    var app = document.getElementById('app');
    if (!app) return;

    // Click delegation
    app.addEventListener('click', function (e) {
      var target = e.target;

      // Edit project button
      var editBtn = target.closest('[data-action="edit-project"]');
      if (editBtn) {
        e.stopPropagation();
        openProjectModal(editBtn.dataset.projectId);
        return;
      }

      // Status squircle click
      var statusBtn = target.closest('[data-action="status-click"]');
      if (statusBtn) {
        showStatusDropdown(statusBtn.dataset.taskId, statusBtn);
        return;
      }

      // Edit task
      var editTaskBtn = target.closest('[data-action="edit-task"]');
      if (editTaskBtn) {
        openTaskModal(editTaskBtn.dataset.taskId);
        return;
      }

      // Delete task
      var deleteTaskBtn = target.closest('[data-action="delete-task"]');
      if (deleteTaskBtn) {
        Data.archiveTask(deleteTaskBtn.dataset.taskId).then(function (ok) {
          if (ok) {
            renderTasks();
            toast('Task archived', 'info');
          }
        });
        return;
      }

      // Edit session
      var editSessionBtn = target.closest('[data-action="edit-session"]');
      if (editSessionBtn) {
        e.stopPropagation();
        openSessionEditModal(editSessionBtn.dataset.sessionId);
        return;
      }

      // Delete session
      var delBtn = target.closest('[data-action="delete-session"]');
      if (delBtn) {
        var sid = delBtn.dataset.sessionId;
        Data.deleteTimeSession(sid).then(function () {
          renderTimelineSessions();
          updateTimelineHeader();
          toast('Session deleted', 'info');
        });
        return;
      }

      // Timer toggle
      // Day navigation
      var dayPrev = target.closest('[data-action="day-prev"]');
      if (dayPrev) { navigateDay(-1); return; }
      var dayNext = target.closest('[data-action="day-next"]');
      if (dayNext) { navigateDay(1); return; }
      var dayToday = target.closest('[data-action="day-today"]');
      if (dayToday) { _viewDate = new Date(); navigateDay(0); return; }

      var timerBtn = target.closest('[data-action="toggle-timer"]');
      if (timerBtn) {
        toggleTimer();
        return;
      }

      // Type toggle
      var taskFilterBtn = target.closest('[data-action="task-status-filter"]');
      if (taskFilterBtn) {
        showTaskStatusFilter(taskFilterBtn);
        return;
      }

      var typeBtn = target.closest('[data-action="type-toggle"]');
      if (typeBtn) {
        _typeToggleState = (_typeToggleState + 1) % 3;
        if (_typeToggleState === 0) {
          // Reset filters
          for (var i = 0; i < PROJECT_TYPES.length; i++) _typeFilters[PROJECT_TYPES[i]] = true;
          closePopups();
          renderProjects();
        } else if (_typeToggleState === 1) {
          closePopups();
          renderProjects();
        } else {
          showTypeFilter(typeBtn);
        }
        return;
      }

      // Focus project quick-add
      var focusPlus = target.closest('[data-action="focus-project-input"]');
      if (focusPlus) {
        var input = document.getElementById('project-quick-add');
        if (input) input.focus();
        return;
      }

      // Color picker on project card left border
      var card = target.closest('.project-card');
      if (card) {
        // Check if click was on the left border area (within first ~16px)
        var cardRect = card.getBoundingClientRect();
        var clickX = e.clientX - cardRect.left;
        if (clickX < 16) {
          showColorPicker(card.dataset.projectId, card);
          return;
        }
      }

      // Close popups on outside click
      closePopups();
    });

    // Keydown for quick-add inputs
    app.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var target = e.target;

      // Project quick-add
      if (target.id === 'project-quick-add') {
        var name = target.value.trim();
        if (!name) return;
        target.value = '';
        Data.saveProject({ name: name, type: 'personal', status: 'building' }).then(function (saved) {
          if (saved) {
            renderProjects();
            renderTasks();
            toast('Project created', 'success');
          }
        });
        return;
      }

      // Per-group task quick-add
      if (target.dataset.actionEnter === 'add-task-to-project') {
        var title = target.value.trim();
        if (!title) return;
        target.value = '';

        var projectId = target.dataset.projectId || null;

        Data.saveTask({ title: title, status: 'idea', project_id: projectId }).then(function (saved) {
          if (saved) {
            renderTasks();
            toast('Task added', 'success');
          }
        });
        return;
      }
    });

    // Mousedown for project card resize and reorder
    app.addEventListener('mousedown', function (e) {
      var card = e.target.closest('.project-card');
      if (!card) return;
      if (e.target.closest('.edit-icon')) return;

      var projectId = card.dataset.projectId;

      // Check if near bottom edge (resize)
      var cardRect = card.getBoundingClientRect();
      var relY = e.clientY - cardRect.top;
      if (relY > cardRect.height - 8) {
        e.preventDefault();
        card.classList.add('resize-hover');
        startProjectResize(card, projectId, e);
        return;
      }

      // Otherwise: reorder drag
      e.preventDefault();
      startProjectReorder(card, projectId, e);
    });

    // Mousemove on project cards for resize cursor hint
    app.addEventListener('mousemove', function (e) {
      var card = e.target.closest('.project-card');
      // Clear resize-hover from all cards that aren't the current target
      var allCards = app.querySelectorAll('.project-card.resize-hover');
      for (var i = 0; i < allCards.length; i++) {
        if (allCards[i] !== card) {
          allCards[i].classList.remove('resize-hover');
          allCards[i].style.cursor = '';
        }
      }
      if (!card) return;
      var cardRect = card.getBoundingClientRect();
      var relY = e.clientY - cardRect.top;
      if (relY > cardRect.height - 8) {
        card.classList.add('resize-hover');
        card.style.cursor = 'ns-resize';
      } else {
        card.classList.remove('resize-hover');
        card.style.cursor = '';
      }
    });

    // Task drag start (HTML5 drag and drop for dropping onto timeline)
    app.addEventListener('dragstart', function (e) {
      var taskRow = e.target.closest('.task-row[draggable="true"]');
      if (!taskRow) return;
      var taskId = taskRow.dataset.taskId;
      e.dataTransfer.setData('text/task-id', taskId);
      e.dataTransfer.effectAllowed = 'copy';
      taskRow.classList.add('dragging-task');
      // Clean up on drag end
      taskRow.addEventListener('dragend', function () {
        taskRow.classList.remove('dragging-task');
      }, { once: true });
    });

    // Close popups on outside click (body level)
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.status-dropdown') && !e.target.closest('.color-picker-popup') && !e.target.closest('.type-filter-modal') &&
          !e.target.closest('[data-action="status-click"]') && !e.target.closest('[data-action="type-toggle"]') && !e.target.closest('[data-action="task-status-filter"]') && !e.target.closest('.project-card')) {
        closePopups();
      }
    });
  }

  /* ================================================================
     Project reorder drag
     ================================================================ */

  function startProjectReorder(card, projectId, startEvent) {
    var container = document.getElementById('col-projects');
    if (!container) return;

    var startY = startEvent.clientY;
    var moved = false;

    _draggedProjectId = projectId;
    document.body.classList.add('is-dragging');

    function onMove(e) {
      var dy = Math.abs(e.clientY - startY);
      if (dy < 5) return;
      moved = true;
      card.classList.add('dragging');

      // Find drop target
      var cards = container.querySelectorAll('.project-card:not(.dragging)');
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('drag-over-above', 'drag-over-below');
        var rect = cards[i].getBoundingClientRect();
        var mid = rect.top + rect.height / 2;
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          if (e.clientY < mid) {
            cards[i].classList.add('drag-over-above');
          } else {
            cards[i].classList.add('drag-over-below');
          }
        }
      }
    }

    function onUp(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('is-dragging');
      card.classList.remove('dragging');

      var cards = container.querySelectorAll('.project-card');
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('drag-over-above', 'drag-over-below');
      }

      if (!moved) {
        _draggedProjectId = null;
        return;
      }

      // Determine new order
      var allCards = container.querySelectorAll('.project-card');
      var targetCard = null;
      var insertBefore = false;
      for (var j = 0; j < allCards.length; j++) {
        var rect = allCards[j].getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          targetCard = allCards[j];
          insertBefore = e.clientY < rect.top + rect.height / 2;
          break;
        }
      }

      if (targetCard && targetCard.dataset.projectId !== projectId) {
        // Build new order
        var projects = projectsArray();
        var orderedIds = projects.map(function (p) { return p.id; });

        // Remove dragged project from array
        orderedIds = orderedIds.filter(function (id) { return id !== projectId; });

        // Find target index
        var targetId = targetCard.dataset.projectId;
        var targetIdx = orderedIds.indexOf(targetId);
        if (!insertBefore) targetIdx++;

        // Insert at new position
        orderedIds.splice(targetIdx, 0, projectId);

        // Save sort orders
        var promises = [];
        for (var k = 0; k < orderedIds.length; k++) {
          promises.push(Data.saveProject({ sort_order: k }, orderedIds[k]));
        }
        Promise.all(promises).then(function () {
          renderProjects();
          renderTasks();
        });
      }

      _draggedProjectId = null;
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* ================================================================
     Keyboard
     ================================================================ */

  function setupKeyboard() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closePopups();
        // Close any open modal overlay
        var overlay = document.querySelector('.modal-overlay');
        if (overlay) {
          _journalModalOpen = false;
          _projectModalOpen = false;
          overlay.remove();
        }
      }
    });
  }

  /* ================================================================
     Expose
     ================================================================ */

  window.App = {
    init: init,
    toast: toast,
    renderProjects: renderProjects,
    renderTasks: renderTasks,
    renderTimeline: renderTimeline
  };

  /* ---- Left column resize ---- */
  function setupLeftColResize() {
    var handle = document.getElementById('left-col-resize');
    var col = document.getElementById('left-col');
    if (!handle || !col) return;

    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      handle.classList.add('dragging');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      var startX = e.clientX;
      var startW = col.offsetWidth;

      function onMove(e) {
        var newW = startW + (e.clientX - startX);
        newW = Math.max(200, Math.min(600, newW));
        col.style.width = newW + 'px';
      }

      function onUp() {
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        // Redraw world clock to fit new width
        if (window.WorldClock) WorldClock._drawAll && WorldClock._drawAll(true);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  /* ---- Boot ---- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
