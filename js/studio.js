/* ============================================================
   studio.js — Studio view (default/home)
   Work organized spatially as project columns
   Exposed on window.StudioView
   ============================================================ */
(function () {
  'use strict';

  var MACRO_GROUPS = {
    built:  ['done', 'integrated'],
    active: ['scheduled', 'building'],
    todo:   ['idea', 'planning'],
  };

  var FIELD_STATUSES = ['planning', 'building', 'integrated'];
  var ALL_STATUSES   = ['idea', 'planning', 'scheduled', 'building', 'done', 'integrated'];

  /* ---- State ---- */
  var activeFilters = new Set();
  var showFeatures  = true;
  var showTasks     = true;

  /* ---- Helpers ---- */

  function getContainer() {
    return document.querySelector('[data-panel="studio"]');
  }

  function isField(status) {
    return FIELD_STATUSES.indexOf(status) !== -1;
  }

  function macroGroup(status) {
    if (MACRO_GROUPS.built.indexOf(status) !== -1)  return 'built';
    if (MACRO_GROUPS.active.indexOf(status) !== -1) return 'active';
    return 'todo';
  }

  function featurePassesFilter(feature) {
    if (activeFilters.size === 0) return true;
    return activeFilters.has(feature.status);
  }

  function taskPassesFilter(task) {
    if (activeFilters.size === 0) return true;
    return activeFilters.has(task.status);
  }

  function countByStatus(features) {
    var counts = {};
    ALL_STATUSES.forEach(function (s) { counts[s] = 0; });
    features.forEach(function (f) {
      if (counts[f.status] !== undefined) counts[f.status]++;
    });
    return counts;
  }

  function taskCountForFeature(featureId) {
    var count = 0;
    Data.state.tasks.forEach(function (t) {
      if (t.feature_id === featureId) count++;
    });
    return count;
  }

  function tasksForProject(projectId) {
    var out = [];
    Data.state.tasks.forEach(function (t) {
      if (t.project_id === projectId) out.push(t);
    });
    return out;
  }

  /* ---- Status bar graph ---- */

  function renderStatusBar(features) {
    var counts = countByStatus(features);
    var html = '<div class="status-bar">';
    ALL_STATUSES.forEach(function (s) {
      var w = counts[s] * 8;
      if (w > 0) {
        html += '<div class="segment segment-' + s + '" style="width:' + w + 'px;"></div>';
      }
    });
    html += '</div>';
    return html;
  }

  /* ---- Feature card ---- */

  function renderFeatureCard(feature) {
    var field  = isField(feature.status);
    var cls    = 'card-feature' + (field ? ' is-field' : ' is-gate');
    var pipStyle;

    if (field) {
      pipStyle = 'background:' + Utils.statusColor(feature.status) + ';';
    } else {
      pipStyle = 'background:transparent; border:2px solid ' + Utils.statusColor(feature.status) + ';';
    }

    var urgentBorder = feature.is_flagged ? ' border-left:3px solid var(--urgent);' : '';

    var impClass = 'importance-bar importance-' + (feature.importance || 'med');
    var tc = taskCountForFeature(feature.id);
    var taskBadge = '';
    if (tc > 0) {
      taskBadge = '<span style="font-size:var(--text-2xs);color:var(--text-faint);margin-left:auto;padding:0 var(--space-2);">' + tc + '</span>';
    }

    return '' +
      '<div class="' + cls + '" style="' + urgentBorder + '" data-feature-id="' + Utils.esc(feature.id) + '">' +
        '<div class="status-pip" style="' + pipStyle + '"></div>' +
        '<span class="feature-title">' + Utils.esc(feature.title) + '</span>' +
        taskBadge +
        '<span class="feature-edit-icon" data-action="open-feature-modal" data-feature-id="' + Utils.esc(feature.id) + '">&#9998;</span>' +
        '<div class="' + impClass + '"></div>' +
      '</div>';
  }

  /* ---- Task card ---- */

  function renderTaskCard(task) {
    var pipStyle = 'background:' + Utils.statusColor(task.status) + ';';
    var meta = '';

    if (task.due_date) {
      var overdue = Utils.daysSince(task.due_date) > 0 && task.status !== 'done' && task.status !== 'integrated';
      var dateColor = overdue ? 'color:var(--error);' : '';
      meta += '<span style="' + dateColor + '">' + Utils.esc(Utils.formatDate(task.due_date)) + '</span>';
    }

    var project = Data.state.projects.get(task.project_id);
    if (project) {
      meta += '<span>' + Utils.esc(project.name) + '</span>';
    }

    return '' +
      '<div class="card-task" data-task-id="' + Utils.esc(task.id) + '">' +
        '<div class="status-pip" style="' + pipStyle + '"></div>' +
        '<span class="task-title">' + Utils.esc(task.title) + '</span>' +
        '<div class="task-meta">' + meta + '</div>' +
      '</div>';
  }

  /* ---- Feature section (grouped by macro status) ---- */

  function renderFeatureSection(label, features, tasks, projectId, macroKey) {
    var filtered = features.filter(featurePassesFilter);
    if (filtered.length === 0 && activeFilters.size > 0) return '';

    var collapsed = (macroKey === 'built' && filtered.length > 3);
    var sectionId = 'section-' + projectId + '-' + macroKey;

    var html = '' +
      '<div class="feature-section" data-macro="' + macroKey + '">' +
        '<div class="feature-section-header" data-action="toggle-collapse" data-target="' + sectionId + '" ' +
          'style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) 0;cursor:pointer;user-select:none;">' +
          '<span style="font-size:var(--text-2xs);text-transform:uppercase;letter-spacing:var(--tracking-wider);color:var(--text-tertiary);">' +
            Utils.esc(label) +
          '</span>' +
          '<span style="font-size:var(--text-2xs);color:var(--text-faint);">' + filtered.length + '</span>' +
          '<span class="collapse-arrow" style="font-size:var(--text-2xs);color:var(--text-faint);margin-left:auto;">' +
            (collapsed ? '\u25B6' : '\u25BC') +
          '</span>' +
        '</div>' +
        '<div class="feature-section-body" id="' + sectionId + '"' + (collapsed ? ' style="display:none;"' : '') + '>';

    filtered.forEach(function (f) {
      if (showFeatures) {
        html += renderFeatureCard(f);
      }

      if (showTasks) {
        var featureTasks = tasks.filter(function (t) {
          return t.feature_id === f.id && taskPassesFilter(t);
        });
        featureTasks.forEach(function (t) {
          html += renderTaskCard(t);
        });
      }
    });

    html += '</div></div>';
    return html;
  }

  /* ---- Project column ---- */

  function renderColumn(projectId) {
    var project = Data.state.projects.get(projectId);
    if (!project) return '';

    var features = Data.projectFeatures(projectId);
    var tasks    = tasksForProject(projectId);

    var builtFeatures  = features.filter(function (f) { return macroGroup(f.status) === 'built'; });
    var activeFeatures = features.filter(function (f) { return macroGroup(f.status) === 'active'; });
    var todoFeatures   = features.filter(function (f) { return macroGroup(f.status) === 'todo'; });

    var total     = features.length;
    var doneCount = builtFeatures.length;

    var pipStyle = 'background:' + Utils.statusColor(project.status) + ';';
    var domainHint = '';
    if (project.domain) {
      domainHint = ' style="border-top:2px solid var(--domain-' + Utils.esc(project.domain) + ');"';
    }

    var html = '' +
      '<div class="project-col" data-project-id="' + Utils.esc(project.id) + '"' + domainHint + '>' +
        '<div class="card-project-header">' +
          '<div class="project-header-top">' +
            '<div class="status-pip" style="' + pipStyle + '" data-action="open-project-modal" data-project-id="' + Utils.esc(project.id) + '"></div>' +
            '<span class="project-name" style="font-family:var(--font-serif);">' + Utils.esc(project.name) + '</span>' +
            '<span class="type-badge">' + Utils.esc(project.type || '') + '</span>' +
          '</div>' +
          renderStatusBar(features) +
          '<div class="project-completion">' + doneCount + '/' + total + ' features</div>' +
        '</div>';

    html += renderFeatureSection('Built', builtFeatures, tasks, projectId, 'built');
    html += renderFeatureSection('In Progress', activeFeatures, tasks, projectId, 'active');
    html += renderFeatureSection('To Build', todoFeatures, tasks, projectId, 'todo');

    html += '' +
        '<div class="quick-add">' +
          '<input type="text" placeholder="+ Add feature..." ' +
            'data-action="quick-add-input" data-project-id="' + Utils.esc(project.id) + '">' +
        '</div>' +
      '</div>';

    return html;
  }

  /* ---- Toolbar ---- */

  function renderToolbar() {
    var html = '<div class="studio-toolbar" style="display:flex;align-items:center;gap:var(--space-6);padding:var(--space-6) var(--space-10);flex-wrap:wrap;">';

    /* Status legend filter chips */
    html += '<div class="legend">';
    ALL_STATUSES.forEach(function (s) {
      var active = activeFilters.has(s) ? ' active' : '';
      html += '' +
        '<div class="legend-chip' + active + '" data-action="toggle-status-filter" data-status="' + s + '">' +
          '<span class="pip pip-' + s + '"></span>' +
          Utils.esc(Utils.statusLabel(s)) +
        '</div>';
    });
    html += '</div>';

    /* Section toggles */
    html += '<div style="display:flex;gap:var(--space-3);margin-left:auto;">';
    html += '<button class="btn-chip' + (showFeatures ? ' active' : '') + '" data-action="toggle-section" data-section="features">Features</button>';
    html += '<button class="btn-chip' + (showTasks ? ' active' : '') + '" data-action="toggle-section" data-section="tasks">Tasks</button>';
    html += '</div>';

    /* + Project button */
    html += '<button class="btn-add" data-action="open-project-modal">+ Project</button>';

    html += '</div>';
    return html;
  }

  /* ---- Main render ---- */

  function render() {
    var container = getContainer();
    if (!container) return;

    var projects = Data.activeProjects();

    var html = renderToolbar();

    html += '<div class="studio-scroll" style="display:flex;gap:var(--space-8);padding:var(--space-6) var(--space-10);overflow-x:auto;align-items:flex-start;flex:1;">';

    if (projects.length === 0) {
      html += '' +
        '<div class="empty-state">' +
          '<div class="empty-icon">&#9633;</div>' +
          '<div class="empty-text">No active projects</div>' +
          '<div class="empty-sub">Create a project to get started</div>' +
        '</div>';
    } else {
      projects.forEach(function (p) {
        html += renderColumn(p.id);
      });
    }

    html += '</div>';
    container.innerHTML = html;

    bindEvents(container);
  }

  /* ---- Surgical column re-render ---- */

  function rerenderColumn(projectId) {
    var container = getContainer();
    if (!container) return;
    var existing = container.querySelector('[data-project-id="' + projectId + '"]');
    if (!existing) return;
    var temp = document.createElement('div');
    temp.innerHTML = renderColumn(projectId);
    var newCol = temp.firstElementChild;
    if (newCol) existing.replaceWith(newCol);
  }

  /* ---- Event binding ---- */

  function bindEvents(container) {
    container.addEventListener('click', handleClick);
    container.addEventListener('keydown', handleKeydown);
  }

  function handleClick(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;

    var action = target.getAttribute('data-action');

    switch (action) {
      case 'toggle-status-filter':
        toggleStatusFilter(target.getAttribute('data-status'));
        break;
      case 'toggle-section':
        toggleSection(target.getAttribute('data-section'));
        break;
      case 'open-project-modal':
        var projectId = target.getAttribute('data-project-id');
        if (projectId) {
          var project = Data.state.projects.get(projectId);
          Modals.projectModal(project);
        } else {
          Modals.projectModal();
        }
        break;
      case 'open-feature-modal':
        var featureId = target.getAttribute('data-feature-id');
        if (featureId) {
          var feature = Data.state.features.get(featureId);
          Modals.featureModal(feature);
        }
        break;
      case 'toggle-collapse':
        toggleCollapse(target.getAttribute('data-target'));
        break;
    }
  }

  function handleKeydown(e) {
    if (e.key !== 'Enter') return;
    var target = e.target;
    if (target.getAttribute('data-action') !== 'quick-add-input') return;

    var title = target.value.trim();
    if (!title) return;

    var pid = target.getAttribute('data-project-id');
    quickAddFeature(pid, title);
    target.value = '';
  }

  /* ---- Actions ---- */

  function toggleStatusFilter(status) {
    if (activeFilters.has(status)) {
      activeFilters.delete(status);
    } else {
      activeFilters.add(status);
    }
    render();
  }

  function toggleSection(section) {
    if (section === 'features') {
      showFeatures = !showFeatures;
    } else if (section === 'tasks') {
      showTasks = !showTasks;
    }
    render();
  }

  function toggleCollapse(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return;
    var hidden = el.style.display === 'none';
    el.style.display = hidden ? '' : 'none';
    var header = el.previousElementSibling;
    if (header) {
      var arrow = header.querySelector('.collapse-arrow');
      if (arrow) arrow.textContent = hidden ? '\u25BC' : '\u25B6';
    }
  }

  function quickAddFeature(projectId, title) {
    Data.saveFeature({
      project_id: projectId,
      title: title,
      status: 'idea',
      importance: 'med',
    }).then(function () {
      rerenderColumn(projectId);
    });
  }

  /* ---- Expose ---- */
  window.StudioView = {
    render:             render,
    renderColumn:       rerenderColumn,
    toggleStatusFilter: toggleStatusFilter,
    toggleSection:      toggleSection,
    quickAddFeature:    quickAddFeature,
  };
})();
