/* ============================================================
   rhythm.js — Rhythm view: weekly pulse and timeline
   Exposed on window.RhythmView
   ============================================================ */
(function () {
  'use strict';

  var ACTIVE_VIEW   = 'pulse'; // 'pulse' | 'timeline'
  var STALE_DAYS    = 14;
  var VISIBLE_WEEKS = 8;

  /* Timeline navigation state */
  var timelineStart = Utils.addWeeks(Utils.getMonday(new Date()), -2);

  /* ---- Helpers ---- */

  function getContainer() {
    return document.querySelector('[data-panel="rhythm"]');
  }

  function thisWeekMonday() {
    return Utils.isoWeek(new Date());
  }

  /** Convert the features and tasks Maps into a single array of items. */
  function allItems() {
    var out = [];
    Data.state.features.forEach(function (f) {
      out.push(Object.assign({ _type: 'feature' }, f));
    });
    Data.state.tasks.forEach(function (t) {
      out.push(Object.assign({ _type: 'task' }, t));
    });
    return out;
  }

  function itemsForWeek(weekIso, items) {
    return items.filter(function (item) {
      return item.target_week === weekIso;
    });
  }

  function groupByProject(items) {
    var groups = {};
    items.forEach(function (item) {
      var pid = item.project_id || '_none';
      if (!groups[pid]) groups[pid] = [];
      groups[pid].push(item);
    });
    return groups;
  }

  function isStale(item) {
    return (item.status === 'idea' || item.status === 'planning') &&
      Utils.daysSince(item.created_at) > STALE_DAYS;
  }

  /* ---- Cards ---- */

  function renderItemCard(item, opts) {
    opts = opts || {};
    var type      = opts.type || item._type || 'feature';
    var cardClass = type === 'task' ? 'card-task' : 'card-feature';
    var pipStyle  = 'background:' + Utils.statusColor(item.status) + ';';

    var project = Data.state.projects.get(item.project_id);
    var projName = project ? project.name : '';

    var meta = '';
    if (projName) {
      meta += '<span style="font-size:var(--text-2xs);color:var(--text-faint);">' + Utils.esc(projName) + '</span>';
    }
    if (opts.showDays) {
      var days = Utils.daysSince(item.updated_at || item.created_at);
      meta += '<span style="font-size:var(--text-2xs);color:var(--text-faint);">' + days + 'd</span>';
    }
    if (opts.showStale) {
      var staleDays = Utils.daysSince(item.created_at);
      meta += '<span style="font-size:var(--text-2xs);color:var(--urgent);">' + staleDays + 'd stale</span>';
    }

    var impBar = '';
    if (item.importance) {
      impBar = '<div class="importance-bar importance-' + Utils.esc(item.importance) + '"></div>';
    }

    var draggable = opts.draggable
      ? ' draggable="true" data-drag-type="' + Utils.esc(type) + '" data-drag-id="' + Utils.esc(item.id) + '"'
      : '';

    return '' +
      '<div class="' + cardClass + '"' + draggable + ' data-item-id="' + Utils.esc(item.id) + '" style="position:relative;">' +
        '<div class="status-pip" style="' + pipStyle + '"></div>' +
        '<span class="' + (type === 'task' ? 'task-title' : 'feature-title') + '">' + Utils.esc(item.title) + '</span>' +
        '<div class="task-meta" style="display:flex;gap:var(--space-3);align-items:center;">' + meta + '</div>' +
        impBar +
      '</div>';
  }

  /* ---- Pulse view ---- */

  function renderPulse() {
    var currentWeek = thisWeekMonday();
    var items = allItems();

    /* Column 1: Building this week */
    var building = items.filter(function (item) {
      return item.target_week === currentWeek && item.status === 'building';
    });

    /* Column 2: Committed (scheduled) this week */
    var committed = items.filter(function (item) {
      return item.target_week === currentWeek && item.status === 'scheduled';
    });

    /* Column 3: Blocked & Stale */
    var blockedStale = items.filter(function (item) {
      return item.is_flagged || isStale(item);
    });

    var html = '<div class="pulse-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-8);padding:var(--space-8) var(--space-10);align-items:flex-start;">';

    html += renderPulseColumn('Building', building, { showDays: true });
    html += renderPulseColumn('Committed', committed, { showDays: true });
    html += renderPulseColumn('Blocked & Stale', blockedStale, { showStale: true });

    html += '</div>';
    return html;
  }

  function renderPulseColumn(title, items, opts) {
    var html = '' +
      '<div class="pulse-column" style="display:flex;flex-direction:column;gap:var(--space-4);">' +
        '<div style="display:flex;align-items:center;gap:var(--space-3);padding-bottom:var(--space-3);border-bottom:1px solid var(--border-subtle);">' +
          '<span style="font-size:var(--text-xs);text-transform:uppercase;letter-spacing:var(--tracking-wider);color:var(--text-tertiary);">' + Utils.esc(title) + '</span>' +
          '<span style="font-size:var(--text-2xs);color:var(--text-faint);">' + items.length + '</span>' +
        '</div>';

    if (items.length === 0) {
      html += '<div class="empty-state" style="padding:var(--space-10) 0;"><div class="empty-text">Nothing here</div></div>';
    } else {
      items.forEach(function (item) {
        html += renderItemCard(item, opts);
      });
    }

    html += '</div>';
    return html;
  }

  /* ---- Timeline view ---- */

  function renderTimeline() {
    var currentWeek = thisWeekMonday();
    var items = allItems();

    /* Navigation */
    var startLabel = Utils.formatWeekLabel(timelineStart);

    var html = '' +
      '<div class="timeline-nav" style="display:flex;align-items:center;gap:var(--space-6);padding:var(--space-4) var(--space-10);">' +
        '<button class="btn-secondary" data-action="timeline-prev" style="padding:var(--space-2) var(--space-6);font-size:var(--text-xs);">&larr; 2 wk</button>' +
        '<button class="btn-secondary" data-action="timeline-today" style="padding:var(--space-2) var(--space-6);font-size:var(--text-xs);">Today</button>' +
        '<button class="btn-secondary" data-action="timeline-next" style="padding:var(--space-2) var(--space-6);font-size:var(--text-xs);">2 wk &rarr;</button>' +
        '<span style="font-size:var(--text-xs);color:var(--text-secondary);">' + Utils.esc(startLabel) + '</span>' +
      '</div>';

    html += '<div class="timeline-scroll" style="display:flex;gap:var(--space-4);padding:var(--space-4) var(--space-10);overflow-x:auto;align-items:flex-start;">';

    /* Unscheduled column */
    var unscheduled = items.filter(function (item) {
      return !item.target_week && item.status !== 'done' && item.status !== 'integrated';
    });
    html += renderTimelineColumn('Unscheduled', null, unscheduled, currentWeek);

    /* Week columns */
    for (var i = 0; i < VISIBLE_WEEKS; i++) {
      var weekDate  = Utils.addWeeks(timelineStart, i);
      var weekIso   = Utils.isoWeek(weekDate);
      var weekLabel = Utils.formatWeekShort(weekDate);
      var weekItems = itemsForWeek(weekIso, items);
      html += renderTimelineColumn(weekLabel, weekIso, weekItems, currentWeek);
    }

    html += '</div>';
    return html;
  }

  function renderTimelineColumn(label, weekIso, items, currentWeek) {
    var isCurrent = weekIso && weekIso === currentWeek;
    var bgStyle = isCurrent ? 'background:var(--accent-ghost);' : '';
    var dropAttr = weekIso !== null
      ? ' data-drop-week="' + Utils.esc(weekIso) + '"'
      : ' data-drop-week="unscheduled"';

    var html = '' +
      '<div class="timeline-col" style="min-width:180px;max-width:220px;flex-shrink:0;display:flex;flex-direction:column;gap:var(--space-3);padding:var(--space-4);border-radius:var(--radius);border:1px solid var(--border-subtle);' + bgStyle + '"' + dropAttr + '>' +
        '<div style="font-size:var(--text-xs);text-transform:uppercase;letter-spacing:var(--tracking-wider);color:' + (isCurrent ? 'var(--accent)' : 'var(--text-tertiary)') + ';padding-bottom:var(--space-2);border-bottom:1px solid var(--border-subtle);">' +
          Utils.esc(label) +
          '<span style="margin-left:var(--space-3);color:var(--text-faint);">' + items.length + '</span>' +
        '</div>';

    if (items.length === 0) {
      html += '<div style="padding:var(--space-6) 0;text-align:center;font-size:var(--text-2xs);color:var(--text-faint);">Drop items here</div>';
    } else {
      var grouped = groupByProject(items);
      Object.keys(grouped).forEach(function (pid) {
        var project = Data.state.projects.get(pid);
        if (project) {
          html += '<div style="font-size:var(--text-2xs);text-transform:uppercase;letter-spacing:var(--tracking-wide);color:var(--text-faint);padding-top:var(--space-2);">' + Utils.esc(project.name) + '</div>';
        }
        grouped[pid].forEach(function (item) {
          html += renderItemCard(item, { type: item._type, draggable: true });
        });
      });
    }

    html += '</div>';
    return html;
  }

  /* ---- Moksha prompt ---- */

  function renderMokshaPrompt() {
    var staleItems = Data.staleItems(STALE_DAYS);

    var html = '<div class="moksha-prompt" style="padding:var(--space-10);margin:var(--space-8) var(--space-10);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);background:var(--bg-card);">';

    if (staleItems.length > 0) {
      html += '' +
        '<div style="display:flex;align-items:center;gap:var(--space-4);margin-bottom:var(--space-6);">' +
          '<span style="font-size:var(--text-md);font-family:var(--font-serif);color:var(--text-primary);">MOKSHA</span>' +
          '<span style="font-size:var(--text-xs);color:var(--text-faint);">\u092E\u094B\u0915\u094D\u0937</span>' +
        '</div>' +
        '<p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-6);">What can I release?</p>';

      staleItems.forEach(function (item) {
        var days = Utils.daysSince(item.created_at);
        var type = item._type || 'feature';
        html += '' +
          '<div style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-3) 0;border-bottom:1px solid var(--border-subtle);">' +
            '<span style="flex:1;font-size:var(--text-sm);color:var(--text-default);">' + Utils.esc(item.title) + '</span>' +
            '<span style="font-size:var(--text-2xs);color:var(--text-faint);">' + days + ' days</span>' +
            '<button class="btn-ghost" style="font-size:var(--text-2xs);padding:var(--space-1) var(--space-3);" data-action="archive-stale" data-type="' + Utils.esc(type) + '" data-id="' + Utils.esc(item.id) + '">Archive</button>' +
          '</div>';
      });

      html += '<p style="font-size:var(--text-xs);color:var(--text-faint);font-style:italic;margin-top:var(--space-6);">Moksha feeds Mula. Release creates space. Space becomes foundation.</p>';
    } else {
      html += '' +
        '<div style="text-align:center;padding:var(--space-8) 0;">' +
          '<p style="font-size:var(--text-sm);color:var(--text-tertiary);font-style:italic;">Nothing to release. The wheel turns.</p>' +
        '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ---- Core question ---- */

  function renderCoreQuestion() {
    var domain = QTime.today();
    return '' +
      '<div class="rhythm-question" style="padding:var(--space-4) var(--space-10);text-align:center;">' +
        '<span style="font-size:var(--text-sm);color:var(--text-tertiary);font-style:italic;font-family:var(--font-serif);">' +
          Utils.esc(domain.question) +
        '</span>' +
      '</div>';
  }

  /* ---- Main render ---- */

  function render() {
    var container = getContainer();
    if (!container) return;

    var html = '';

    /* View toggle */
    html += '' +
      '<div class="rhythm-toggle" style="display:flex;gap:var(--space-3);padding:var(--space-6) var(--space-10);">' +
        '<button class="btn-chip' + (ACTIVE_VIEW === 'pulse' ? ' active' : '') + '" data-action="rhythm-view" data-view="pulse">Pulse</button>' +
        '<button class="btn-chip' + (ACTIVE_VIEW === 'timeline' ? ' active' : '') + '" data-action="rhythm-view" data-view="timeline">Timeline</button>' +
      '</div>';

    /* Core question */
    html += renderCoreQuestion();

    /* View content */
    if (ACTIVE_VIEW === 'pulse') {
      html += renderPulse();
    } else {
      html += renderTimeline();
    }

    /* Moksha prompt */
    html += renderMokshaPrompt();

    container.innerHTML = html;
    bindEvents(container);
  }

  /* ---- Events ---- */

  function bindEvents(container) {
    container.addEventListener('click', handleClick);
    setupDragDrop(container);
  }

  function handleClick(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;

    var action = target.getAttribute('data-action');

    switch (action) {
      case 'rhythm-view':
        ACTIVE_VIEW = target.getAttribute('data-view');
        render();
        break;
      case 'timeline-prev':
        navigateTimeline(-2);
        break;
      case 'timeline-today':
        goToToday();
        break;
      case 'timeline-next':
        navigateTimeline(2);
        break;
      case 'archive-stale':
        archiveStale(target.getAttribute('data-type'), target.getAttribute('data-id'));
        break;
    }
  }

  function setupDragDrop(container) {
    container.addEventListener('dragstart', function (e) {
      var card = e.target.closest('[data-drag-id]');
      if (!card) return;

      var payload = JSON.stringify({
        type: card.getAttribute('data-drag-type'),
        id:   card.getAttribute('data-drag-id'),
      });
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.effectAllowed = 'move';

      setTimeout(function () {
        card.classList.add('dragging');
      }, 0);
    });

    container.addEventListener('dragend', function (e) {
      var card = e.target.closest('[data-drag-id]');
      if (card) card.classList.remove('dragging');

      var targets = container.querySelectorAll('.drop-target');
      for (var i = 0; i < targets.length; i++) {
        targets[i].classList.remove('drop-target');
      }
    });

    container.addEventListener('dragover', function (e) {
      var col = e.target.closest('[data-drop-week]');
      if (!col) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drop-target');
    });

    container.addEventListener('dragleave', function (e) {
      var col = e.target.closest('[data-drop-week]');
      if (!col) return;
      if (col.contains(e.relatedTarget)) return;
      col.classList.remove('drop-target');
    });

    container.addEventListener('drop', function (e) {
      var col = e.target.closest('[data-drop-week]');
      if (!col) return;
      e.preventDefault();
      col.classList.remove('drop-target');

      var raw = e.dataTransfer.getData('application/json');
      if (!raw) return;

      var payload;
      try { payload = JSON.parse(raw); } catch (_) { return; }

      var weekVal = col.getAttribute('data-drop-week');
      var newWeek = weekVal === 'unscheduled' ? null : weekVal;

      if (payload.type === 'feature') {
        Data.saveFeature({ target_week: newWeek }, payload.id).then(function () {
          render();
        });
      } else if (payload.type === 'task') {
        Data.saveTask({ target_week: newWeek }, payload.id).then(function () {
          render();
        });
      }
    });
  }

  /* ---- Actions ---- */

  function navigateTimeline(weeks) {
    timelineStart = Utils.addWeeks(timelineStart, weeks);
    render();
  }

  function goToToday() {
    timelineStart = Utils.addWeeks(Utils.getMonday(new Date()), -2);
    render();
  }

  function archiveStale(type, id) {
    var archive = type === 'task' ? Data.archiveTask : Data.archiveFeature;
    archive(id).then(function (ok) {
      if (ok) {
        App.toast('Archived', 'success');
        render();
      }
    });
  }

  /* ---- Expose ---- */
  window.RhythmView = {
    render:            render,
    renderPulse:       renderPulse,
    renderTimeline:    renderTimeline,
    renderMokshaPrompt: renderMokshaPrompt,
    navigateTimeline:  navigateTimeline,
    goToToday:         goToToday,
    get timelineStart() { return timelineStart; },
  };
})();
