/* ============================================================
   modals.js — Modal system
   Exposed on window.Modals
   ============================================================ */
(function () {
  'use strict';

  var _currentModal = null;
  var _isDirty = false;
  var _outsideClickCount = 0;
  var _dirtyTimer = null;

  var STATUSES = ['idea', 'planning', 'scheduled', 'building', 'done', 'integrated'];
  var IMPORTANCES = ['low', 'med', 'high'];
  var PROJECT_TYPES = ['client', 'personal', 'house', 'art', 'internal', 'other'];
  var PROJECT_STATUSES = ['idea', 'planning', 'scheduled', 'building', 'done', 'integrated', 'paused', 'archived'];
  var DOMAIN_NAMES = ['mula', 'dharma', 'seva', 'karma', 'vidya', 'sangha', 'prema', 'moksha'];

  /* ================================================================
     Core modal infrastructure
     ================================================================ */

  function open(contentHTML, options) {
    options = options || {};
    // Close any existing modal first
    if (_currentModal) _forceClose();

    _isDirty = false;
    _outsideClickCount = 0;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        _handleOutsideClick();
      }
    });

    var modal = document.createElement('div');
    modal.className = 'modal';
    if (options.width) modal.style.maxWidth = options.width;

    var header = '';
    if (options.title) {
      header = '<div class="modal-header"><h2 class="modal-title">' + Utils.esc(options.title) + '</h2>' +
        '<button class="modal-close-btn" data-action="modal-close" aria-label="Close">&times;</button></div>';
    }

    var footer = '';
    if (options.onSave || options.onDelete) {
      footer = '<div class="modal-footer">';
      if (options.onDelete) {
        footer += '<button class="btn btn-danger modal-delete-btn" data-action="modal-delete">Archive</button>';
      }
      footer += '<div class="modal-footer-right">';
      footer += '<button class="btn btn-ghost" data-action="modal-close">Cancel</button>';
      if (options.onSave) {
        footer += '<button class="btn btn-primary modal-save-btn" data-action="modal-save">Save</button>';
      }
      footer += '</div></div>';
    }

    modal.innerHTML = header + '<div class="modal-body">' + contentHTML + '</div>' + footer;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Wire up save/delete/close buttons via delegation on the modal
    modal.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var action = el.dataset.action;
      if (action === 'modal-close') close();
      if (action === 'modal-save' && options.onSave) options.onSave(modal);
      if (action === 'modal-delete' && options.onDelete) options.onDelete(modal);
    });

    // ESC to close
    modal._escHandler = function (e) {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', modal._escHandler);

    _currentModal = { overlay: overlay, modal: modal };
    _trackDirty(modal);

    // Trigger the open transition on next frame
    requestAnimationFrame(function () {
      overlay.classList.add('open');
      var first = modal.querySelector('input, textarea, select');
      if (first) first.focus();
    });

    return modal;
  }

  function close() {
    if (!_currentModal) return;
    if (_isDirty) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    _forceClose();
  }

  function _forceClose() {
    if (!_currentModal) return;
    if (_currentModal.modal._escHandler) {
      document.removeEventListener('keydown', _currentModal.modal._escHandler);
    }
    if (_dirtyTimer) { clearTimeout(_dirtyTimer); _dirtyTimer = null; }
    _currentModal.overlay.remove();
    _currentModal = null;
    _isDirty = false;
    _outsideClickCount = 0;
  }

  function _trackDirty(modalEl) {
    _dirtyTimer = setTimeout(function () {
      var inputs = modalEl.querySelectorAll('input, textarea, select');
      for (var i = 0; i < inputs.length; i++) {
        inputs[i].addEventListener('input', _markDirty);
        inputs[i].addEventListener('change', _markDirty);
      }
    }, 150);
  }

  function _markDirty() {
    _isDirty = true;
  }

  function _handleOutsideClick() {
    if (!_isDirty) { _forceClose(); return; }
    _outsideClickCount++;
    if (_outsideClickCount >= 2) {
      if (confirm('You have unsaved changes. Discard them?')) _forceClose();
      else _outsideClickCount = 1;
    }
  }

  /* ================================================================
     Picker helpers (return HTML strings)
     ================================================================ */

  function statusPickerHTML(currentStatus) {
    var html = '<div class="picker-row status-picker">';
    for (var i = 0; i < STATUSES.length; i++) {
      var s = STATUSES[i];
      var isActive = (s === currentStatus);
      var bg = isActive ? Utils.statusColor(s) : 'transparent';
      var border = Utils.statusColor(s);
      var textColor = isActive ? 'var(--bg-primary)' : Utils.statusColor(s);
      html += '<button type="button" class="pill-btn' + (isActive ? ' active' : '') + '" ' +
        'data-action="pick-status" data-status="' + s + '" ' +
        'style="background:' + bg + '; border-color:' + border + '; color:' + textColor + ';">' +
        Utils.statusLabel(s) + '</button>';
    }
    html += '</div>';
    return html;
  }

  function importancePickerHTML(currentImportance) {
    var labels = { low: 'Low', med: 'Med', high: 'High' };
    var html = '<div class="picker-row importance-picker">';
    for (var i = 0; i < IMPORTANCES.length; i++) {
      var imp = IMPORTANCES[i];
      var isActive = (imp === currentImportance);
      html += '<button type="button" class="pill-btn importance-pill' + (isActive ? ' active' : '') + '" ' +
        'data-action="pick-importance" data-importance="' + imp + '" ' +
        'style="' + (isActive ? 'background:var(--accent-teal); color:var(--bg-primary); border-color:var(--accent-teal);' : '') + '">' +
        labels[imp] + '</button>';
    }
    html += '</div>';
    return html;
  }

  function weekPickerHTML(currentWeek) {
    var today = new Date();
    var thisMonday = Utils.getMonday(today);
    // 2 past + current + 9 future = 12 weeks
    var startMonday = Utils.addWeeks(thisMonday, -2);

    var html = '<div class="picker-row week-picker">';
    for (var i = 0; i < 12; i++) {
      var monday = Utils.addWeeks(startMonday, i);
      var mondayStr = Utils.isoDate(monday);
      var isActive = (mondayStr === currentWeek);
      var isCurrent = (mondayStr === Utils.isoDate(thisMonday));
      var classes = 'pill-btn week-pill';
      if (isActive) classes += ' active';
      if (isCurrent) classes += ' current-week';
      html += '<button type="button" class="' + classes + '" ' +
        'data-action="pick-week" data-week="' + mondayStr + '">' +
        Utils.formatWeekShort(monday) + '</button>';
    }
    html += '</div>';
    return html;
  }

  /* ---- Project dropdown helper ---- */
  function _projectDropdownHTML(selectedId, fieldName) {
    fieldName = fieldName || 'project_id';
    var projects = Data.activeProjects();
    var html = '<select name="' + fieldName + '" class="modal-select">';
    html += '<option value="">No project</option>';
    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      var sel = (p.id === selectedId) ? ' selected' : '';
      html += '<option value="' + Utils.esc(p.id) + '"' + sel + '>' + Utils.esc(p.name) + '</option>';
    }
    html += '</select>';
    return html;
  }

  /* ---- Feature dropdown helper (filtered by project) ---- */
  function _featureDropdownHTML(selectedFeatureId, projectId) {
    var features = projectId ? Data.projectFeatures(projectId) : [];
    var html = '<select name="feature_id" class="modal-select">';
    html += '<option value="">No feature</option>';
    for (var i = 0; i < features.length; i++) {
      var f = features[i];
      var sel = (f.id === selectedFeatureId) ? ' selected' : '';
      html += '<option value="' + Utils.esc(f.id) + '"' + sel + '>' + Utils.esc(f.title) + '</option>';
    }
    html += '</select>';
    return html;
  }

  /* ================================================================
     Feature modal
     ================================================================ */

  function featureModal(feature, projectId) {
    var f = feature || {};
    var isEdit = !!f.id;
    var pid = f.project_id || projectId || '';

    var html = '' +
      '<div class="modal-field">' +
        '<label>Title</label>' +
        '<input type="text" name="title" class="modal-input" value="' + Utils.esc(f.title || '') + '" placeholder="Feature title" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Description</label>' +
        '<textarea name="description" class="modal-textarea" rows="3" placeholder="Optional description">' + Utils.esc(f.description || '') + '</textarea>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Status</label>' +
        statusPickerHTML(f.status || 'idea') +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Importance</label>' +
        importancePickerHTML(f.importance || 'med') +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Target week</label>' +
        weekPickerHTML(f.target_week || '') +
      '</div>' +
      '<div class="modal-field">' +
        '<label class="toggle-label"><input type="checkbox" name="flagged" ' + (f.flagged ? 'checked' : '') + ' /> Flagged</label>' +
      '</div>';

    if (!projectId) {
      html += '<div class="modal-field">' +
        '<label>Project</label>' +
        _projectDropdownHTML(pid) +
      '</div>';
    }

    var title = isEdit ? 'Edit Feature' : 'New Feature';

    var modal = open(html, {
      title: title,
      width: '520px',
      onSave: function (modalEl) {
        _saveFeatureFromModal(modalEl, f.id, projectId);
      },
      onDelete: isEdit ? function () {
        if (confirm('Archive this feature?')) {
          Data.archiveFeature(f.id).then(function (ok) {
            if (ok) { App.toast('Feature archived', 'success'); _forceClose(); }
            else App.toast('Error archiving feature', 'error');
          });
        }
      } : null,
    });

    // Wire up interactive pickers inside the modal
    _wireStatusPicker(modal);
    _wireImportancePicker(modal);
    _wireWeekPicker(modal);
  }

  function _saveFeatureFromModal(modalEl, existingId, forcedProjectId) {
    var title = modalEl.querySelector('[name="title"]').value.trim();
    if (!title) { App.toast('Title is required', 'error'); return; }

    var obj = {
      title:       title,
      description: modalEl.querySelector('[name="description"]').value.trim() || null,
      status:      _getPickedStatus(modalEl),
      importance:  _getPickedImportance(modalEl),
      target_week: _getPickedWeek(modalEl),
      is_flagged:  modalEl.querySelector('[name="flagged"]').checked,
    };

    var projectSelect = modalEl.querySelector('[name="project_id"]');
    if (projectSelect) {
      obj.project_id = projectSelect.value || null;
    } else if (forcedProjectId) {
      obj.project_id = forcedProjectId;
    }

    Data.saveFeature(obj, existingId || undefined).then(function (saved) {
      if (saved) { App.toast(existingId ? 'Feature updated' : 'Feature created', 'success'); _forceClose(); }
      else App.toast('Error saving feature', 'error');
    });
  }

  /* ================================================================
     Task modal
     ================================================================ */

  function taskModal(task, featureId, projectId) {
    var t = task || {};
    var isEdit = !!t.id;
    var pid = t.project_id || projectId || '';
    var fid = t.feature_id || featureId || '';

    var html = '' +
      '<div class="modal-field">' +
        '<label>Title</label>' +
        '<input type="text" name="title" class="modal-input" value="' + Utils.esc(t.title || '') + '" placeholder="Task title" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Description</label>' +
        '<textarea name="description" class="modal-textarea" rows="3" placeholder="Optional description">' + Utils.esc(t.description || '') + '</textarea>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Status</label>' +
        statusPickerHTML(t.status || 'idea') +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Importance</label>' +
        importancePickerHTML(t.importance || 'med') +
      '</div>' +
      '<div class="modal-field">' +
        '<label class="toggle-label"><input type="checkbox" name="is_urgent" ' + (t.is_urgent ? 'checked' : '') + ' /> Urgent</label>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Due date</label>' +
        '<input type="date" name="due_date" class="modal-input" value="' + Utils.esc(t.due_date || '') + '" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Target week</label>' +
        weekPickerHTML(t.target_week || '') +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Project</label>' +
        _projectDropdownHTML(pid) +
      '</div>' +
      '<div class="modal-field" data-feature-dropdown>' +
        '<label>Feature</label>' +
        _featureDropdownHTML(fid, pid) +
      '</div>';

    var title = isEdit ? 'Edit Task' : 'New Task';

    var modal = open(html, {
      title: title,
      width: '520px',
      onSave: function (modalEl) {
        _saveTaskFromModal(modalEl, t.id);
      },
      onDelete: isEdit ? function () {
        if (confirm('Archive this task?')) {
          Data.archiveTask(t.id).then(function (ok) {
            if (ok) { App.toast('Task archived', 'success'); _forceClose(); }
            else App.toast('Error archiving task', 'error');
          });
        }
      } : null,
    });

    _wireStatusPicker(modal);
    _wireImportancePicker(modal);
    _wireWeekPicker(modal);

    // When project changes, refresh the feature dropdown
    var projSelect = modal.querySelector('[name="project_id"]');
    if (projSelect) {
      projSelect.addEventListener('change', function () {
        var container = modal.querySelector('[data-feature-dropdown]');
        if (container) {
          // Keep label, replace select
          var label = container.querySelector('label');
          container.innerHTML = '';
          container.appendChild(label);
          container.insertAdjacentHTML('beforeend', _featureDropdownHTML('', projSelect.value));
        }
        _markDirty();
      });
    }
  }

  function _saveTaskFromModal(modalEl, existingId) {
    var title = modalEl.querySelector('[name="title"]').value.trim();
    if (!title) { App.toast('Title is required', 'error'); return; }

    var obj = {
      title:       title,
      description: modalEl.querySelector('[name="description"]').value.trim() || null,
      status:      _getPickedStatus(modalEl),
      importance:  _getPickedImportance(modalEl),
      is_urgent:   modalEl.querySelector('[name="is_urgent"]').checked,
      due_date:    modalEl.querySelector('[name="due_date"]').value || null,
      target_week: _getPickedWeek(modalEl),
      project_id:  modalEl.querySelector('[name="project_id"]').value || null,
    };

    var featureSelect = modalEl.querySelector('[name="feature_id"]');
    if (featureSelect && featureSelect.value) {
      obj.feature_id = featureSelect.value;
    }

    Data.saveTask(obj, existingId || undefined).then(function (saved) {
      if (saved) { App.toast(existingId ? 'Task updated' : 'Task created', 'success'); _forceClose(); }
      else App.toast('Error saving task', 'error');
    });
  }

  /* ================================================================
     Project modal
     ================================================================ */

  function projectModal(project) {
    var p = project || {};
    var isEdit = !!p.id;

    function optionsHTML(list, selected) {
      var h = '';
      for (var i = 0; i < list.length; i++) {
        var v = list[i];
        var label = v.charAt(0).toUpperCase() + v.slice(1);
        h += '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + label + '</option>';
      }
      return h;
    }

    var domainOptions = '<option value="">None</option>';
    for (var i = 0; i < DOMAIN_NAMES.length; i++) {
      var d = DOMAIN_NAMES[i];
      var label = d.charAt(0).toUpperCase() + d.slice(1);
      domainOptions += '<option value="' + d + '"' + (d === p.domain ? ' selected' : '') + '>' + label + '</option>';
    }

    var html = '' +
      '<div class="modal-field">' +
        '<label>Name</label>' +
        '<input type="text" name="name" class="modal-input" value="' + Utils.esc(p.name || '') + '" placeholder="Project name" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Description</label>' +
        '<textarea name="description" class="modal-textarea" rows="3" placeholder="Optional description">' + Utils.esc(p.description || '') + '</textarea>' +
      '</div>' +
      '<div class="modal-row">' +
        '<div class="modal-field modal-half">' +
          '<label>Type</label>' +
          '<select name="type" class="modal-select">' + optionsHTML(PROJECT_TYPES, p.type || 'personal') + '</select>' +
        '</div>' +
        '<div class="modal-field modal-half">' +
          '<label>Status</label>' +
          '<select name="status" class="modal-select">' + optionsHTML(PROJECT_STATUSES, p.status || 'idea') + '</select>' +
        '</div>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Domain</label>' +
        '<select name="domain" class="modal-select">' + domainOptions + '</select>' +
      '</div>' +
      '<div class="modal-row">' +
        '<div class="modal-field modal-half">' +
          '<label>Start date</label>' +
          '<input type="date" name="start_date" class="modal-input" value="' + Utils.esc(p.start_date || '') + '" />' +
        '</div>' +
        '<div class="modal-field modal-half">' +
          '<label>Target date</label>' +
          '<input type="date" name="target_date" class="modal-input" value="' + Utils.esc(p.target_date || '') + '" />' +
        '</div>' +
      '</div>' +
      '<div class="modal-row">' +
        '<div class="modal-field modal-half">' +
          '<label>Budget</label>' +
          '<input type="number" name="budget" class="modal-input" value="' + Utils.esc(p.budget != null ? p.budget : '') + '" placeholder="0" step="0.01" />' +
        '</div>' +
        '<div class="modal-field modal-half">' +
          '<label>Hourly rate</label>' +
          '<input type="number" name="hourly_rate" class="modal-input" value="' + Utils.esc(p.hourly_rate != null ? p.hourly_rate : '') + '" placeholder="0" step="0.01" />' +
        '</div>' +
      '</div>' +
      '<div class="modal-row">' +
        '<div class="modal-field modal-half">' +
          '<label>Color</label>' +
          '<input type="color" name="color" class="modal-input modal-color-input" value="' + Utils.esc(p.color || '#6366f1') + '" />' +
        '</div>' +
        '<div class="modal-field modal-half">' +
          '<label>Image URL</label>' +
          '<input type="url" name="image_url" class="modal-input" value="' + Utils.esc(p.image_url || '') + '" placeholder="https://..." />' +
        '</div>' +
      '</div>';

    var title = isEdit ? 'Edit Project' : 'New Project';

    open(html, {
      title: title,
      width: '580px',
      onSave: function (modalEl) {
        _saveProjectFromModal(modalEl, p.id);
      },
      onDelete: isEdit ? function () {
        if (confirm('Archive this project?')) {
          Data.archiveProject(p.id).then(function (ok) {
            if (ok) { App.toast('Project archived', 'success'); _forceClose(); }
            else App.toast('Error archiving project', 'error');
          });
        }
      } : null,
    });
  }

  function _saveProjectFromModal(modalEl, existingId) {
    var name = modalEl.querySelector('[name="name"]').value.trim();
    if (!name) { App.toast('Name is required', 'error'); return; }

    var budgetVal = modalEl.querySelector('[name="budget"]').value;
    var rateVal = modalEl.querySelector('[name="hourly_rate"]').value;

    var obj = {
      name:        name,
      description: modalEl.querySelector('[name="description"]').value.trim() || null,
      type:        modalEl.querySelector('[name="type"]').value,
      status:      modalEl.querySelector('[name="status"]').value,
      domain:      modalEl.querySelector('[name="domain"]').value || null,
      start_date:  modalEl.querySelector('[name="start_date"]').value || null,
      target_date: modalEl.querySelector('[name="target_date"]').value || null,
      budget:      budgetVal !== '' ? parseFloat(budgetVal) : null,
      hourly_rate: rateVal !== '' ? parseFloat(rateVal) : null,
      color:       modalEl.querySelector('[name="color"]').value || null,
      image_url:   modalEl.querySelector('[name="image_url"]').value.trim() || null,
    };

    Data.saveProject(obj, existingId || undefined).then(function (saved) {
      if (saved) { App.toast(existingId ? 'Project updated' : 'Project created', 'success'); _forceClose(); }
      else App.toast('Error saving project', 'error');
    });
  }

  /* ================================================================
     Internal picker wiring helpers
     ================================================================ */

  function _wireStatusPicker(modal) {
    modal.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="pick-status"]');
      if (!btn) return;
      var status = btn.dataset.status;
      var row = btn.closest('.status-picker');
      if (!row) return;
      var pills = row.querySelectorAll('.pill-btn');
      for (var i = 0; i < pills.length; i++) {
        var s = pills[i].dataset.status;
        var isActive = (s === status);
        pills[i].classList.toggle('active', isActive);
        pills[i].style.background = isActive ? Utils.statusColor(s) : 'transparent';
        pills[i].style.color = isActive ? 'var(--bg-primary)' : Utils.statusColor(s);
      }
      _markDirty();
    });
  }

  function _wireImportancePicker(modal) {
    modal.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="pick-importance"]');
      if (!btn) return;
      var importance = btn.dataset.importance;
      var row = btn.closest('.importance-picker');
      if (!row) return;
      var pills = row.querySelectorAll('.pill-btn');
      for (var i = 0; i < pills.length; i++) {
        var isActive = (pills[i].dataset.importance === importance);
        pills[i].classList.toggle('active', isActive);
        pills[i].style.background = isActive ? 'var(--accent-teal)' : '';
        pills[i].style.color = isActive ? 'var(--bg-primary)' : '';
        pills[i].style.borderColor = isActive ? 'var(--accent-teal)' : '';
      }
      _markDirty();
    });
  }

  function _wireWeekPicker(modal) {
    modal.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="pick-week"]');
      if (!btn) return;
      var week = btn.dataset.week;
      var row = btn.closest('.week-picker');
      if (!row) return;
      var pills = row.querySelectorAll('.pill-btn');
      for (var i = 0; i < pills.length; i++) {
        var isActive = (pills[i].dataset.week === week);
        pills[i].classList.toggle('active', isActive);
      }
      // Allow deselect by clicking active week
      if (btn.classList.contains('active') && btn.dataset.week === week) {
        // It was just activated, keep it
      }
      _markDirty();
    });
  }

  function _getPickedStatus(modalEl) {
    var active = modalEl.querySelector('.status-picker .pill-btn.active');
    return active ? active.dataset.status : 'idea';
  }

  function _getPickedImportance(modalEl) {
    var active = modalEl.querySelector('.importance-picker .pill-btn.active');
    return active ? active.dataset.importance : 'med';
  }

  function _getPickedWeek(modalEl) {
    var active = modalEl.querySelector('.week-picker .pill-btn.active');
    return active ? active.dataset.week : null;
  }

  /* ---- Expose ---- */
  window.Modals = {
    open:               open,
    close:              close,
    _forceClose:        _forceClose,
    _trackDirty:        _trackDirty,
    _markDirty:         _markDirty,
    get _isDirty()      { return _isDirty; },
    get _outsideClickCount() { return _outsideClickCount; },

    featureModal:       featureModal,
    taskModal:          taskModal,
    projectModal:       projectModal,

    statusPickerHTML:     statusPickerHTML,
    importancePickerHTML: importancePickerHTML,
    weekPickerHTML:       weekPickerHTML,
  };
})();
