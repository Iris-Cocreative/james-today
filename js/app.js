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
    { key: 'idea',       label: 'Idea',       color: 'var(--status-idea)',       solid: '#add8e6' },
    { key: 'planning',   label: 'Planning',   color: 'var(--status-planning)',   solid: '#ffd700' },
    { key: 'scheduled',  label: 'Scheduled',  color: 'var(--status-scheduled)',  solid: '#ffa500' },
    { key: 'building',   label: 'Building',   color: 'var(--status-building)',   solid: '#32cd32' },
    { key: 'done',       label: 'Done',       color: 'var(--status-done)',       solid: '#1e90ff' },
    { key: 'integrated', label: 'Integrated', color: 'var(--status-integrated)', solid: '#9370db' }
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

  /** Build a squircle SVG string for a status color */
  function squircleSVG(color, size) {
    size = size || 16;
    var r = size / 2;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="1" y="1" width="' + (size - 2) + '" height="' + (size - 2) + '" rx="' + Math.round(r * 0.35) + '" ' +
      'fill="' + color + '" opacity="0.85"/></svg>';
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
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () {
      el.classList.remove('visible');
      setTimeout(function () { el.remove(); }, 300);
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
  var _draggedProjectId = null;
  var _resizingCard = null;
  var _resizingSession = null;
  var _draggingSession = null;
  var _newSessionInput = null;

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

    // Listen for data changes
    Data.on('projectChanged', function () { renderProjects(); renderTasks(); renderTimelineSessions(); });
    Data.on('taskChanged', function () { renderTasks(); renderTimelineSessions(); });
    Data.on('timeSessionChanged', function () { renderTimelineSessions(); updateTimelineHeader(); });

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
    var d = todayDomain();
    var now = new Date();
    var container = document.getElementById('day-info');
    if (!container) return;
    container.innerHTML =
      '<div class="day-domain" style="color:' + d.color + '">' +
        '<span class="domain-pip" style="background:' + d.color + '"></span>' +
        '<span class="domain-symbol">' + d.symbol + '</span> ' +
        '<span class="domain-name">' + esc(d.name) + '</span>' +
        ' <span class="domain-sanskrit">' + esc(d.sanskrit) + '</span>' +
      '</div>' +
      '<div class="day-theme">' + esc(d.theme) + ' \u00B7 ' + esc(d.planet) + ' \u00B7 ' + esc(d.planetSkt) + '</div>' +
      '<div class="day-date">' + esc(Utils.formatDateFull(now)) + '</div>' +
      '<div class="day-numbers">Day ' + dayOfYear(now) + ' \u00B7 Week ' + weekNumber(now) + '</div>' +
      '<div class="day-question">\u201C' + esc(d.question) + '\u201D</div>';
    container.onclick = function () { openJournalModal(); };
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
    var colP = document.getElementById('col-projects');
    var colT = document.getElementById('col-tasks');
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

    // Type toggle button
    html += '<div class="projects-bottom-bar">' +
      '<button class="type-toggle' + (_typeToggleState > 0 ? ' active' : '') + '" data-action="type-toggle" title="Group / Filter by type">' +
        '\u25A6' +
      '</button>' +
    '</div>';

    container.innerHTML = html;
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
        squircleSVG(s.solid, 14) +
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
      html += '<div class="task-group" style="--c:' + c + '; --group-flex:' + groupFlex + '" data-project-id="' + p.id + '">';
      html += '<div class="task-group-header">' + esc(p.name) + '</div>';

      for (var j = 0; j < allTasks.length; j++) {
        var t = allTasks[j];
        var statusInfo = STATUS_MAP[t.status] || STATUS_MAP['idea'];
        var isDone = t.status === 'done' || t.status === 'integrated';
        html += '<div class="task-row' + (isDone ? ' done' : '') + '" data-task-id="' + t.id + '" draggable="true">' +
          '<span class="squircle-btn" data-action="status-click" data-task-id="' + t.id + '">' +
            squircleSVG(statusInfo.solid, 16) +
          '</span>' +
          '<span class="task-label">' + esc(t.title || t.name || '') + '</span>' +
        '</div>';
      }

      if (allTasks.length === 0) {
        html += '<div class="task-row"><span class="task-label" style="opacity:0.3;font-style:italic">No tasks</span></div>';
      }

      html += '</div>';
    }

    // Unassigned tasks
    var unassigned = [];
    Data.state.tasks.forEach(function (t) {
      if (!t.project_id) unassigned.push(t);
    });
    if (unassigned.length > 0) {
      html += '<div class="task-group" style="--c:#706b62; --group-flex:' + unassigned.length + '">';
      html += '<div class="task-group-header">Unassigned</div>';
      for (var u = 0; u < unassigned.length; u++) {
        var ut = unassigned[u];
        var us = STATUS_MAP[ut.status] || STATUS_MAP['idea'];
        var uDone = ut.status === 'done' || ut.status === 'integrated';
        html += '<div class="task-row' + (uDone ? ' done' : '') + '" data-task-id="' + ut.id + '" draggable="true">' +
          '<span class="squircle-btn" data-action="status-click" data-task-id="' + ut.id + '">' +
            squircleSVG(us.solid, 16) +
          '</span>' +
          '<span class="task-label">' + esc(ut.title || ut.name || '') + '</span>' +
        '</div>';
      }
      html += '</div>';
    }

    // Quick-add
    html += '<div class="quick-add">' +
      '<span class="project-cycle" id="task-project-cycle" style="background:' + (projects.length > 0 ? projectColor(projects[0]) : '#706b62') + '" ' +
        'data-action="cycle-task-project" data-project-index="0" title="Click to change project"></span>' +
      '<span class="plus">+</span>' +
      '<input type="text" placeholder="New task..." id="task-quick-add" data-action-enter="add-task">' +
    '</div>';

    container.innerHTML = html;
  }

  /* ================================================================
     Timeline
     ================================================================ */

  var HOUR_HEIGHT = 60;
  var TOTAL_HEIGHT = 24 * HOUR_HEIGHT; // 1440px

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

    // Scrollable inner
    html += '<div class="timeline-inner" id="timeline-inner">';

    // Hour labels
    html += '<div class="timeline-hours">';
    for (var h = 0; h < 24; h++) {
      html += '<div class="timeline-hour-label" style="top:' + (h * HOUR_HEIGHT) + 'px">' + hourLabel(h) + '</div>';
    }
    html += '</div>';

    // Grid lines
    html += '<div class="timeline-grid" id="timeline-grid">';
    for (var g = 0; g < 24; g++) {
      html += '<div class="timeline-hour-line" style="top:' + (g * HOUR_HEIGHT) + 'px"></div>';
    }
    html += '</div>';

    // Now marker
    html += '<div class="timeline-now-marker" id="timeline-now" style="top:0"></div>';

    // Sessions container
    html += '<div id="timeline-sessions"></div>';

    html += '</div>'; // end timeline-inner

    container.innerHTML = html;

    renderTimelineSessions();
    updateTimelineHeader();
    updateNowMarker();
  }

  function renderTimelineSessions() {
    var container = document.getElementById('timeline-sessions');
    if (!container) return;

    var todayStr = Utils.isoDate(new Date());
    var sessions = Data.state.timeSessions.filter(function (s) {
      return s.started_at && s.started_at.slice(0, 10) === todayStr;
    });

    var html = '';
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      html += sessionBlockHTML(s);
    }

    // Active timer ghost block
    if (_activeTimer) {
      html += timerGhostHTML();
    }

    container.innerHTML = html;
  }

  function sessionBlockHTML(s) {
    var startDate = new Date(s.started_at);
    var endDate = s.ended_at ? new Date(s.ended_at) : new Date();
    var startHour = startDate.getHours() + startDate.getMinutes() / 60;
    var endHour = endDate.getHours() + endDate.getMinutes() / 60;
    var duration = endHour - startHour;
    if (duration < 0.33) duration = 0.33; // min height

    var top = startHour * HOUR_HEIGHT;
    var height = duration * HOUR_HEIGHT;

    // Get project color
    var color = '#c4956a';
    if (s.project_id) {
      var proj = findProject(s.project_id);
      if (proj && proj.color) color = proj.color;
    }

    var startTime = Utils.formatTime(s.started_at);
    var endTime = s.ended_at ? Utils.formatTime(s.ended_at) : 'now';

    return '<div class="timeline-session" data-session-id="' + s.id + '" ' +
      'style="top:' + top + 'px; height:' + height + 'px; background: color-mix(in srgb, ' + color + ' 25%, transparent); border-left: 3px solid ' + color + ';">' +
      '<div class="resize-top"></div>' +
      '<div class="session-title">' + esc(s.description || 'Untitled') + '</div>' +
      '<div class="session-time">' + startTime + ' \u2013 ' + endTime + '</div>' +
      '<button class="session-delete" data-action="delete-session" data-session-id="' + s.id + '">\u2715</button>' +
      '<div class="resize-bottom"></div>' +
    '</div>';
  }

  function timerGhostHTML() {
    if (!_activeTimer) return '';
    var start = _activeTimer.startedAt;
    var now = new Date();
    var startHour = start.getHours() + start.getMinutes() / 60;
    var nowHour = now.getHours() + now.getMinutes() / 60;
    var duration = nowHour - startHour;
    if (duration < 0.33) duration = 0.33;

    var top = startHour * HOUR_HEIGHT;
    var height = duration * HOUR_HEIGHT;

    var color = '#c4956a';
    if (_activeTimer.projectId) {
      var proj = findProject(_activeTimer.projectId);
      if (proj && proj.color) color = proj.color;
    }

    return '<div class="timeline-session timer-ghost" ' +
      'style="top:' + top + 'px; height:' + height + 'px; background: color-mix(in srgb, ' + color + ' 20%, transparent); border-left: 3px solid ' + color + ';">' +
      '<div class="session-title">' + esc(_activeTimer.description || 'Timer running...') + '</div>' +
      '<div class="session-time">' + Utils.formatTime(_activeTimer.startedAt.toISOString()) + ' \u2013 now</div>' +
    '</div>';
  }

  function updateTimelineHeader() {
    var totalEl = document.getElementById('timeline-total');
    if (totalEl) {
      var mins = Data.totalMinutesToday();
      totalEl.textContent = Utils.formatDuration(mins) + ' today';
    }
  }

  function updateNowMarker() {
    var marker = document.getElementById('timeline-now');
    if (!marker) return;
    var now = new Date();
    var h = now.getHours() + now.getMinutes() / 60;
    marker.style.top = (h * HOUR_HEIGHT) + 'px';

    // Update timer ghost if running
    if (_activeTimer) {
      renderTimelineSessions();
    }
  }

  function scrollTimelineToNow() {
    var timeline = document.getElementById('timeline');
    if (!timeline) return;
    var now = new Date();
    var h = now.getHours() + now.getMinutes() / 60;
    var targetScroll = (h * HOUR_HEIGHT) - (timeline.clientHeight / 2);
    // Wait for layout
    setTimeout(function () {
      timeline.scrollTop = Math.max(0, targetScroll);
    }, 100);
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

  function setupTimelineInteractions() {
    var grid = document.getElementById('timeline-grid');
    if (!grid) return;

    // Double-click to create new session
    grid.addEventListener('dblclick', function (e) {
      var rect = grid.getBoundingClientRect();
      var y = e.clientY - rect.top + grid.parentElement.parentElement.scrollTop;
      var hour = y / HOUR_HEIGHT;
      var roundedHour = Math.floor(hour * 2) / 2; // snap to half hours
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
        var rect = inner.getBoundingClientRect();
        var y = e.clientY - rect.top + timeline.scrollTop;
        var hour = Math.floor((y / HOUR_HEIGHT) * 2) / 2;

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
      // Check for session resize handles
      var resizeTop = e.target.closest('.timeline-session .resize-top');
      var resizeBottom = e.target.closest('.timeline-session .resize-bottom');
      if (resizeTop || resizeBottom) {
        e.preventDefault();
        var sessionEl = e.target.closest('.timeline-session');
        var sessionId = sessionEl.dataset.sessionId;
        startSessionResize(sessionId, sessionEl, resizeTop ? 'top' : 'bottom', e);
        return;
      }

      // Check for session drag (move)
      var sessionEl = e.target.closest('.timeline-session');
      if (sessionEl && !e.target.closest('.session-delete') && !e.target.closest('.resize-top') && !e.target.closest('.resize-bottom')) {
        e.preventDefault();
        startSessionDrag(sessionEl.dataset.sessionId, sessionEl, e);
      }
    });
  }

  function createSessionAtHour(hour) {
    var startDate = new Date();
    startDate.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
    var endDate = new Date(startDate.getTime() + 3600000);

    // Show inline input
    var inner = document.getElementById('timeline-inner');
    if (!inner) return;

    var top = hour * HOUR_HEIGHT;
    var inputWrap = document.createElement('div');
    inputWrap.className = 'timeline-session';
    inputWrap.style.cssText = 'top:' + top + 'px; height:' + HOUR_HEIGHT + 'px; left:50px; right:8px; background:rgba(196,149,106,0.15); border-left:3px solid var(--accent); z-index:10;';
    inputWrap.innerHTML = '<input class="session-name-input" placeholder="What were you working on?" autofocus>';
    inner.appendChild(inputWrap);

    var input = inputWrap.querySelector('input');
    input.focus();

    function save() {
      var desc = input.value.trim() || 'Untitled';
      inputWrap.remove();

      // Try to find a matching project by first project
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
      // Small delay to allow click events
      setTimeout(function () {
        if (inputWrap.parentNode) save();
      }, 200);
    });
  }

  function startSessionDrag(sessionId, el, startEvent) {
    var session = Data.state.timeSessions.find(function (s) { return s.id === sessionId; });
    if (!session) return;

    var inner = document.getElementById('timeline-inner');
    if (!inner) return;
    var innerRect = inner.getBoundingClientRect();
    var timeline = document.getElementById('timeline');
    var startY = startEvent.clientY;
    var origTop = parseFloat(el.style.top);

    _draggingSession = sessionId;
    document.body.classList.add('is-dragging');

    function onMove(e) {
      var dy = e.clientY - startY;
      var newTop = Math.max(0, Math.min(TOTAL_HEIGHT - parseFloat(el.style.height), origTop + dy));
      el.style.top = newTop + 'px';
    }

    function onUp(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('is-dragging');
      _draggingSession = null;

      var finalTop = parseFloat(el.style.top);
      var newHour = finalTop / HOUR_HEIGHT;

      // Calculate new start and end
      var origStart = new Date(session.started_at);
      var origEnd = session.ended_at ? new Date(session.ended_at) : new Date();
      var durationMs = origEnd - origStart;

      var newStart = new Date(origStart);
      newStart.setHours(Math.floor(newHour), Math.round((newHour % 1) * 60), 0, 0);
      var newEnd = new Date(newStart.getTime() + durationMs);

      // Update via delete and re-add (since Data.saveTimeSession only inserts)
      Data.deleteTimeSession(sessionId).then(function () {
        return Data.saveTimeSession({
          started_at: newStart.toISOString(),
          ended_at: newEnd.toISOString(),
          project_id: session.project_id,
          description: session.description,
          is_billable: session.is_billable
        });
      }).then(function () {
        renderTimelineSessions();
        updateTimelineHeader();
      });
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startSessionResize(sessionId, el, edge, startEvent) {
    var session = Data.state.timeSessions.find(function (s) { return s.id === sessionId; });
    if (!session) return;

    var startY = startEvent.clientY;
    var origTop = parseFloat(el.style.top);
    var origHeight = parseFloat(el.style.height);

    _resizingSession = sessionId;
    document.body.classList.add('is-dragging');

    function onMove(e) {
      var dy = e.clientY - startY;
      if (edge === 'bottom') {
        var newH = Math.max(HOUR_HEIGHT * 0.25, origHeight + dy);
        el.style.height = newH + 'px';
      } else {
        var newTop = Math.max(0, origTop + dy);
        var newH = origHeight - dy;
        if (newH < HOUR_HEIGHT * 0.25) return;
        el.style.top = newTop + 'px';
        el.style.height = newH + 'px';
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('is-dragging');
      _resizingSession = null;

      var finalTop = parseFloat(el.style.top);
      var finalH = parseFloat(el.style.height);
      var startHour = finalTop / HOUR_HEIGHT;
      var endHour = (finalTop + finalH) / HOUR_HEIGHT;

      var today = new Date();
      var newStart = new Date(today);
      newStart.setHours(Math.floor(startHour), Math.round((startHour % 1) * 60), 0, 0);
      var newEnd = new Date(today);
      newEnd.setHours(Math.floor(endHour), Math.round((endHour % 1) * 60), 0, 0);

      Data.deleteTimeSession(sessionId).then(function () {
        return Data.saveTimeSession({
          started_at: newStart.toISOString(),
          ended_at: newEnd.toISOString(),
          project_id: session.project_id,
          description: session.description,
          is_billable: session.is_billable
        });
      }).then(function () {
        renderTimelineSessions();
        updateTimelineHeader();
      });
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
      var timerBtn = target.closest('[data-action="toggle-timer"]');
      if (timerBtn) {
        toggleTimer();
        return;
      }

      // Type toggle
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

      // Cycle task project
      var cycleBtn = target.closest('[data-action="cycle-task-project"]');
      if (cycleBtn) {
        var projects = projectsArray();
        if (projects.length === 0) return;
        var idx = parseInt(cycleBtn.dataset.projectIndex || '0', 10);
        idx = (idx + 1) % projects.length;
        cycleBtn.dataset.projectIndex = idx;
        cycleBtn.style.background = projectColor(projects[idx]);
        cycleBtn.title = projects[idx].name;
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

      // Task quick-add
      if (target.id === 'task-quick-add') {
        var title = target.value.trim();
        if (!title) return;
        target.value = '';

        // Get selected project from cycle button
        var cycleBtn = document.getElementById('task-project-cycle');
        var projects = projectsArray();
        var projectId = null;
        if (cycleBtn && projects.length > 0) {
          var idx = parseInt(cycleBtn.dataset.projectIndex || '0', 10);
          projectId = projects[idx] ? projects[idx].id : null;
        }

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
          !e.target.closest('[data-action="status-click"]') && !e.target.closest('[data-action="type-toggle"]') && !e.target.closest('.project-card')) {
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

  /* ---- Boot ---- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
