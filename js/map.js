/* ============================================================
   map.js — Map view: project cards grid
   Exposed on window.MapView
   ============================================================ */
(function () {
  'use strict';

  var PROJECT_TYPES = ['All', 'Client', 'Personal', 'House', 'Art', 'Internal'];
  var activeType    = 'All';

  /* ---- Helpers ---- */

  function getContainer() {
    return document.querySelector('[data-panel="map"]');
  }

  function projectMatchesFilter(project) {
    if (activeType === 'All') return true;
    return (project.type || '').toLowerCase() === activeType.toLowerCase();
  }

  function projectFeatureStats(project) {
    var features = Data.projectFeatures(project.id);
    var total  = features.length;
    var active = 0;
    var built  = 0;

    features.forEach(function (f) {
      if (f.status === 'done' || f.status === 'integrated') {
        built++;
      } else if (f.status === 'scheduled' || f.status === 'building') {
        active++;
      }
    });

    return { total: total, active: active, built: built };
  }

  function completionPercent(stats) {
    if (stats.total === 0) return 0;
    return Math.round((stats.built / stats.total) * 100);
  }

  /* ---- Project card ---- */

  function renderCard(project) {
    var stats    = projectFeatureStats(project);
    var pct      = completionPercent(stats);
    var color    = project.color || 'var(--accent)';
    var pipStyle = 'background:' + Utils.statusColor(project.status) + ';';

    var html = '' +
      '<div class="map-card" data-action="open-project-card" data-project-id="' + Utils.esc(project.id) + '" ' +
        'style="display:flex;flex-direction:column;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius);overflow:hidden;cursor:pointer;transition:background var(--transition),border-color var(--transition),transform var(--transition);">';

    /* Top color bar */
    html += '<div style="height:2px;background:' + Utils.esc(color) + ';"></div>';

    /* Image */
    if (project.image_url) {
      html += '<div style="height:100px;overflow:hidden;"><img src="' + Utils.esc(project.image_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;"></div>';
    }

    /* Body */
    html += '<div style="padding:var(--space-6) var(--space-8);display:flex;flex-direction:column;gap:var(--space-3);">';

    /* Name */
    html += '<div style="font-family:var(--font-serif);font-size:var(--text-sm);font-weight:600;color:var(--text-primary);letter-spacing:var(--tracking-tight);">' + Utils.esc(project.name) + '</div>';

    /* Type badge */
    html += '<span style="align-self:flex-start;font-size:var(--text-2xs);text-transform:uppercase;letter-spacing:var(--tracking-widest);color:var(--text-faint);padding:var(--space-1) var(--space-3);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);">' + Utils.esc(project.type || '') + '</span>';

    /* Description */
    if (project.description) {
      var excerpt = project.description.length > 120
        ? project.description.substring(0, 120) + '...'
        : project.description;
      html += '<div style="font-size:var(--text-xs);color:var(--text-tertiary);line-height:1.4;">' + Utils.esc(excerpt) + '</div>';
    }

    /* Footer */
    html += '' +
      '<div style="display:flex;align-items:center;gap:var(--space-4);padding-top:var(--space-3);border-top:1px solid var(--border-subtle);margin-top:var(--space-2);">' +
        '<div style="display:flex;align-items:center;gap:var(--space-2);">' +
          '<div style="width:6px;height:6px;border-radius:var(--radius-full);' + pipStyle + '"></div>' +
          '<span style="font-size:var(--text-2xs);color:var(--text-tertiary);">' + Utils.esc(Utils.statusLabel(project.status)) + '</span>' +
        '</div>' +
        '<span style="font-size:var(--text-2xs);color:var(--text-faint);">' + stats.active + ' active &middot; ' + stats.total + ' total</span>' +
      '</div>';

    /* Completion bar */
    html += '' +
      '<div style="height:2px;background:var(--bg-sunken);border-radius:1px;overflow:hidden;">' +
        '<div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:1px;transition:width var(--transition-slow);"></div>' +
      '</div>';

    html += '</div>'; /* body */
    html += '</div>'; /* card */

    return html;
  }

  /* ---- Toolbar ---- */

  function renderToolbar() {
    var html = '<div class="map-toolbar" style="display:flex;align-items:center;gap:var(--space-6);padding:var(--space-6) var(--space-10);flex-wrap:wrap;">';

    /* Type filter chips */
    html += '<div class="legend">';
    PROJECT_TYPES.forEach(function (t) {
      var active = (activeType === t) ? ' active' : '';
      html += '<div class="legend-chip' + active + '" data-action="filter-project-type" data-type="' + Utils.esc(t) + '">' + Utils.esc(t) + '</div>';
    });
    html += '</div>';

    /* + Project button */
    html += '<button class="btn-add" style="margin-left:auto;" data-action="open-project-modal">+ Project</button>';

    html += '</div>';
    return html;
  }

  /* ---- Main render ---- */

  function render() {
    var container = getContainer();
    if (!container) return;

    var allProjects = [];
    Data.state.projects.forEach(function (p) {
      if (!p.is_archived) allProjects.push(p);
    });

    var filtered = allProjects.filter(projectMatchesFilter);

    var html = renderToolbar();

    html += '<div class="map-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--space-8);padding:var(--space-6) var(--space-10);">';

    if (filtered.length === 0) {
      html += '' +
        '<div class="empty-state" style="grid-column:1/-1;">' +
          '<div class="empty-icon">&#9633;</div>' +
          '<div class="empty-text">No projects found</div>' +
          '<div class="empty-sub">Try a different filter or create a new project</div>' +
        '</div>';
    } else {
      filtered.forEach(function (p) {
        html += renderCard(p);
      });
    }

    html += '</div>';

    container.innerHTML = html;
    bindEvents(container);
  }

  /* ---- Events ---- */

  function bindEvents(container) {
    container.addEventListener('click', handleClick);
  }

  function handleClick(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;

    var action = target.getAttribute('data-action');

    switch (action) {
      case 'filter-project-type':
        activeType = target.getAttribute('data-type');
        render();
        break;
      case 'open-project-modal':
        Modals.projectModal();
        break;
      case 'open-project-card':
        var pid = target.getAttribute('data-project-id');
        var project = Data.state.projects.get(pid);
        if (project) Modals.projectModal(project);
        break;
    }
  }

  /* ---- Expose ---- */
  window.MapView = {
    render:     render,
    renderCard: renderCard,
  };
})();
