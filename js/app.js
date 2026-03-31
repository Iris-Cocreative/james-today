/* ============================================================
   app.js — Main application controller
   Exposed on window.App
   ============================================================ */
(function () {
  'use strict';

  var activeTab = 'studio';
  var _toastTimer = null;

  /* ================================================================
     Init
     ================================================================ */

  async function init() {
    _showLoading(true);

    try {
      await Data.init();
    } catch (err) {
      console.error('App init failed:', err);
      _showLoading(false);
      return;
    }

    // Set user email in header
    var user = Data.getUser();
    var emailEl = document.querySelector('[data-app="user-email"]');
    if (emailEl && user) emailEl.textContent = user.email || '';

    // Inject qualitative time header
    var qtimeContainer = document.querySelector('[data-app="qtime"]');
    if (qtimeContainer) qtimeContainer.innerHTML = QTime.renderHeader();

    // Set up tab switching
    _initTabs();

    // Global event delegation
    _initDelegation();

    // Listen to data events for re-rendering
    _initDataListeners();

    // Render default tab
    renderActiveTab();

    _showLoading(false);
  }

  /* ================================================================
     Loading screen
     ================================================================ */

  function _showLoading(show) {
    var el = document.querySelector('[data-app="loading"]');
    if (!el) return;
    if (show) {
      el.style.display = 'flex';
      el.style.opacity = '1';
    } else {
      el.style.opacity = '0';
      setTimeout(function () { el.style.display = 'none'; }, 300);
    }
  }

  /* ================================================================
     Tabs
     ================================================================ */

  function _initTabs() {
    var tabBtns = document.querySelectorAll('[data-tab]');
    for (var i = 0; i < tabBtns.length; i++) {
      tabBtns[i].addEventListener('click', function () {
        switchTab(this.dataset.tab);
      });
    }
  }

  function switchTab(tabName) {
    activeTab = tabName;

    // Update tab buttons
    var tabBtns = document.querySelectorAll('[data-tab]');
    for (var i = 0; i < tabBtns.length; i++) {
      tabBtns[i].classList.toggle('active', tabBtns[i].dataset.tab === tabName);
    }

    // Show/hide panels
    var panels = document.querySelectorAll('[data-panel]');
    for (var j = 0; j < panels.length; j++) {
      var match = panels[j].dataset.panel === tabName;
      panels[j].style.display = match ? '' : 'none';
    }

    renderActiveTab();
  }

  function renderActiveTab() {
    switch (activeTab) {
      case 'studio':
        if (window.StudioView) StudioView.render();
        break;
      case 'rhythm':
        if (window.RhythmView) RhythmView.render();
        break;
      case 'time':
        if (window.TimeView) TimeView.render();
        break;
      case 'map':
        if (window.MapView) MapView.render();
        break;
    }
  }

  /* ================================================================
     Data event listeners
     ================================================================ */

  function _initDataListeners() {
    Data.on('loaded', function () {
      renderActiveTab();
    });

    Data.on('projectChanged', function () {
      if (activeTab === 'studio' || activeTab === 'map') renderActiveTab();
    });

    Data.on('featureChanged', function () {
      if (activeTab === 'studio' || activeTab === 'rhythm') renderActiveTab();
    });

    Data.on('taskChanged', function () {
      if (activeTab === 'studio' || activeTab === 'rhythm') renderActiveTab();
    });

    Data.on('timeSessionChanged', function () {
      if (activeTab === 'time') renderActiveTab();
    });
  }

  /* ================================================================
     Global event delegation
     ================================================================ */

  function _initDelegation() {
    document.body.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;

      var action = el.dataset.action;
      var handlers = {
        'open-feature-modal':  _handleOpenFeatureModal,
        'open-task-modal':     _handleOpenTaskModal,
        'open-project-modal':  _handleOpenProjectModal,
        'pick-status':         _handlePickStatus,
        'pick-importance':     _handlePickImportance,
        'pick-week':           _handlePickWeek,
        'toggle-section':      _handleToggleSection,
        'filter-status':       _handleFilterStatus,
        'sign-out':            _handleSignOut,
        'toggle-ai':           _handleToggleAI,
        'archive-stale':       _handleArchiveStale,
        'toggle-qtime':        _handleToggleQTime,
        'modal-close':         function () { Modals.close(); },
      };

      if (handlers[action]) {
        handlers[action](el, e);
      }
    });
  }

  /* ---- Action handlers ---- */

  function _handleOpenFeatureModal(el) {
    var featureId = el.dataset.featureId;
    var projectId = el.dataset.projectId;

    if (featureId) {
      var feature = Data.state.features.get(featureId);
      Modals.featureModal(feature, projectId);
    } else {
      Modals.featureModal(null, projectId);
    }
  }

  function _handleOpenTaskModal(el) {
    var taskId = el.dataset.taskId;
    var featureId = el.dataset.featureId;
    var projectId = el.dataset.projectId;

    if (taskId) {
      var task = Data.state.tasks.get(taskId);
      Modals.taskModal(task, featureId, projectId);
    } else {
      Modals.taskModal(null, featureId, projectId);
    }
  }

  function _handleOpenProjectModal(el) {
    var projectId = el.dataset.projectId;
    if (projectId) {
      var project = Data.state.projects.get(projectId);
      Modals.projectModal(project);
    } else {
      Modals.projectModal();
    }
  }

  function _handlePickStatus(el) {
    // Handled inside modal wiring — this is a no-op at the app level
    // The modal's internal click listener handles the visual state
  }

  function _handlePickImportance(el) {
    // Handled inside modal wiring
  }

  function _handlePickWeek(el) {
    // Handled inside modal wiring
  }

  function _handleToggleSection(el) {
    var targetId = el.dataset.target || el.getAttribute('aria-controls');
    var target = targetId ? document.getElementById(targetId) : el.nextElementSibling;
    if (!target) return;

    var isHidden = target.hidden;
    target.hidden = !isHidden;
    el.setAttribute('aria-expanded', String(isHidden));

    // Toggle chevron icon if present
    var chevron = el.querySelector('.section-chevron');
    if (chevron) {
      chevron.classList.toggle('rotated', isHidden);
    }
  }

  function _handleFilterStatus(el) {
    var status = el.dataset.status;
    // Toggle active state
    el.classList.toggle('active');
    // Trigger re-render of active tab which will read the active filters
    renderActiveTab();
  }

  function _handleSignOut() {
    if (confirm('Sign out?')) {
      Data.signOut();
    }
  }

  function _handleToggleAI(el) {
    var panel = document.querySelector('[data-app="ai-panel"]');
    if (panel) {
      var isHidden = panel.hidden;
      panel.hidden = !isHidden;
      el.classList.toggle('active', isHidden);
    }
  }

  function _handleArchiveStale(el) {
    var days = parseInt(el.dataset.days, 10) || 30;
    var stale = Data.staleItems(days);
    if (stale.length === 0) {
      toast('No stale items found', 'info');
      return;
    }
    if (!confirm('Archive ' + stale.length + ' stale items older than ' + days + ' days?')) return;

    var promises = stale.map(function (item) {
      if (item._type === 'task') return Data.archiveTask(item.id);
      if (item._type === 'feature') return Data.archiveFeature(item.id);
      return Promise.resolve();
    });

    Promise.all(promises).then(function () {
      toast(stale.length + ' stale items archived', 'success');
    });
  }

  function _handleToggleQTime(el) {
    var expanded = el.getAttribute('aria-expanded') === 'true';
    var targetId = el.getAttribute('aria-controls');
    var target = document.getElementById(targetId);
    if (target) {
      target.hidden = expanded;
      el.setAttribute('aria-expanded', String(!expanded));
    }
  }

  /* ================================================================
     Toast notifications
     ================================================================ */

  function toast(message, type) {
    type = type || 'info';

    // Remove existing toast
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    if (_toastTimer) clearTimeout(_toastTimer);

    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = message;
    document.body.appendChild(el);

    // Trigger reflow for animation
    el.offsetHeight; // eslint-disable-line no-unused-expressions
    el.classList.add('toast-visible');

    _toastTimer = setTimeout(function () {
      el.classList.remove('toast-visible');
      setTimeout(function () { el.remove(); }, 300);
    }, 3000);
  }

  /* ================================================================
     Expose
     ================================================================ */

  window.App = {
    init:            init,
    toast:           toast,
    switchTab:       switchTab,
    renderActiveTab: renderActiveTab,
    get activeTab()  { return activeTab; },
  };

  /* ---- Boot on DOMContentLoaded ---- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
