/* ============================================================================
   career.js — Career Search page
   Loads + renders the Career Search project, milestones (features),
   opportunities (Kanban), conversations log. Inline auth + Supabase init.
   ============================================================================ */
(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────
  var SUPABASE_URL = 'https://reoliysifzxuzpskywtm.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_trmR_URy0KyDtDUfpgjOfg_owXvNPRI';
  var WAVE_DATE = '2026-05-29';                  // Wave conference deadline
  var PROJECT_NAME = 'Career Search';            // Seeded project name
  var STALE_DAYS = 9;                            // Highlight opps with no activity in N days

  var STATUSES = [
    { key: 'researching', label: 'Researching', color: 'var(--status-idea)' },
    { key: 'applied',     label: 'Applied',     color: 'var(--status-planning)' },
    { key: 'talking',     label: 'Talking',     color: 'var(--status-scheduled)' },
    { key: 'interview',   label: 'Interview',   color: 'var(--status-building)' },
    { key: 'offer',       label: 'Offer',       color: 'var(--status-done)' },
    { key: 'closed',      label: 'Closed',      color: 'var(--text-faint)' },
    { key: 'declined',    label: 'Declined',    color: 'var(--error)' }
  ];

  var FEATURE_PIP = {
    idea:        'var(--status-idea)',
    planning:    'var(--status-planning)',
    scheduled:   'var(--status-scheduled)',
    building:    'var(--status-building)',
    done:        'var(--status-done)',
    integrated:  'var(--status-integrated)'
  };

  // ─── State ─────────────────────────────────────────────────────────────────
  var sb = null;
  var user = null;
  var project = null;          // Career Search project row
  var features = [];           // milestones for that project
  var opportunities = [];
  var conversations = [];      // recent + per-opp on demand

  // ─── Toast ─────────────────────────────────────────────────────────────────
  function toast(msg, type) {
    type = type || 'info';
    var c = document.getElementById('toast-container');
    var el = document.createElement('div');
    var bg = { success: '#2d6a4f', error: '#a4161a', info: '#343a40' }[type] || '#343a40';
    el.style.cssText = 'padding:10px 18px;border-radius:6px;color:#fff;font-size:13px;pointer-events:auto;opacity:0;transition:opacity .25s;background:' + bg + ';';
    el.textContent = msg;
    c.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; });
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 250);
    }, 2800);
  }

  // ─── Date helpers ──────────────────────────────────────────────────────────
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function parseDate(s) { if (!s) return null; var d = new Date(s + 'T00:00:00'); return isNaN(d) ? null : d; }
  function daysBetween(a, b) {
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }
  function startOfWeekMonday(d) {
    var dt = new Date(d); dt.setHours(0,0,0,0);
    var day = dt.getDay(); // 0=Sun
    var diff = (day === 0 ? -6 : 1 - day);
    dt.setDate(dt.getDate() + diff);
    return dt;
  }
  function fmtMonthDay(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function fmtFullDate(s) {
    var d = parseDate(s); if (!d) return '';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function fmtRelative(iso) {
    if (!iso) return 'no activity';
    var d = new Date(iso);
    var diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'today';
    if (diff === 1) return '1 day ago';
    if (diff < 7) return diff + ' days ago';
    if (diff < 30) return Math.floor(diff / 7) + 'w ago';
    return Math.floor(diff / 30) + 'mo ago';
  }
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ─── Auth + init ───────────────────────────────────────────────────────────
  function init() {
    if (typeof supabase === 'undefined') {
      toast('Supabase JS not loaded', 'error');
      return;
    }
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    sb.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (!session) {
        window.location.href = 'login.html';
        return;
      }
      user = session.user;
      document.getElementById('who').textContent = user.email || '';
      return loadAll();
    }).then(function () {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('app').style.display = '';
      renderAll();
    }).catch(function (err) {
      console.error('[Career] init error:', err);
      toast('Load failed: ' + (err && err.message ? err.message : err), 'error');
      document.getElementById('loading').style.display = 'none';
    });

    document.getElementById('signOutBtn').addEventListener('click', function () {
      sb.auth.signOut().then(function () { window.location.href = 'login.html'; });
    });
  }

  // ─── Data loaders ──────────────────────────────────────────────────────────
  function loadAll() {
    return loadProject().then(function () {
      return Promise.all([loadFeatures(), loadOpportunities(), loadRecentConversations()]);
    });
  }

  function loadProject() {
    return sb.from('projects')
      .select('*')
      .eq('name', PROJECT_NAME)
      .eq('is_archived', false)
      .limit(1)
      .then(function (res) {
        if (res.error) throw res.error;
        project = (res.data && res.data[0]) || null;
        if (!project) {
          toast('Career Search project not found — run the migration first', 'error');
        }
      });
  }

  function loadFeatures() {
    if (!project) { features = []; return Promise.resolve(); }
    return sb.from('features')
      .select('*')
      .eq('project_id', project.id)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) throw res.error;
        features = res.data || [];
      });
  }

  function loadOpportunities() {
    return sb.from('opportunities')
      .select('*')
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        opportunities = res.data || [];
      });
  }

  function loadRecentConversations() {
    return sb.from('conversations')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(20)
      .then(function (res) {
        if (res.error) throw res.error;
        conversations = res.data || [];
      });
  }

  function loadConversationsForOpp(oppId) {
    return sb.from('conversations')
      .select('*')
      .eq('opportunity_id', oppId)
      .order('occurred_at', { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data || [];
      });
  }

  // ─── Render: top countdown ────────────────────────────────────────────────
  function renderCountdown() {
    var today = new Date(); today.setHours(0,0,0,0);
    var deadline = parseDate(WAVE_DATE);
    var days = daysBetween(today, deadline);
    document.getElementById('countDays').textContent = days >= 0 ? days : 0;
    document.getElementById('countTarget').textContent =
      deadline.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    // Build weeks strip from this week's Monday → deadline week
    var startMon = startOfWeekMonday(today);
    var deadlineMon = startOfWeekMonday(deadline);
    var totalWeeks = Math.max(1, Math.round(daysBetween(startMon, deadlineMon) / 7) + 1);
    var strip = document.getElementById('weeksStrip');
    strip.innerHTML = '';
    var thisWeekMon = startOfWeekMonday(today).getTime();
    for (var i = 0; i < totalWeeks; i++) {
      var wkStart = new Date(startMon); wkStart.setDate(startMon.getDate() + i * 7);
      var pip = document.createElement('div');
      pip.className = 'week-pip';
      if (wkStart.getTime() === thisWeekMon) pip.classList.add('current');
      else if (wkStart.getTime() < thisWeekMon) pip.classList.add('past');
      pip.innerHTML =
        '<div class="week-pip-num">' + (i + 1) + '</div>' +
        '<div>' + fmtMonthDay(wkStart) + '</div>';
      strip.appendChild(pip);
    }
  }

  // ─── Render: milestones ────────────────────────────────────────────────────
  function renderMilestones() {
    var host = document.getElementById('milestones');
    host.innerHTML = '';

    if (!features.length) {
      host.innerHTML = '<div class="empty" style="grid-column: 1 / -1;">No milestones yet — run the Career Search migration to seed them.</div>';
      document.getElementById('milestonesDoneCount').textContent = '';
      return;
    }

    var done = features.filter(function (f) { return f.status === 'done' || f.status === 'integrated'; }).length;
    document.getElementById('milestonesDoneCount').textContent = done + ' / ' + features.length + ' done';

    features.forEach(function (f, i) {
      var card = document.createElement('div');
      card.className = 'milestone';
      card.dataset.id = f.id;
      card.innerHTML =
        '<div class="milestone-num">' + String(i + 1).padStart(2, '0') + '</div>' +
        '<div class="milestone-status">' +
          '<span class="milestone-pip" style="background:' + (FEATURE_PIP[f.status] || 'var(--text-faint)') + ';"></span>' +
          escapeHtml(f.status) +
        '</div>' +
        '<div class="milestone-title">' + escapeHtml(f.title) + '</div>' +
        '<div class="milestone-meta">' +
          '<span>' + (f.target_week ? 'Week of ' + fmtMonthDay(parseDate(f.target_week)) : '—') + '</span>' +
          '<span>' + (f.importance || '') + '</span>' +
        '</div>';
      card.addEventListener('click', function () { openFeatureModal(f); });
      host.appendChild(card);
    });
  }

  // ─── Render: kanban ────────────────────────────────────────────────────────
  function renderKanban() {
    var host = document.getElementById('kanban');
    host.innerHTML = '';

    document.getElementById('oppsCount').textContent =
      opportunities.length + ' total';

    STATUSES.forEach(function (s) {
      var col = document.createElement('div');
      col.className = 'kanban-col';
      col.dataset.status = s.key;

      var inCol = opportunities.filter(function (o) { return o.status === s.key; });

      col.innerHTML =
        '<div class="kanban-col-head">' +
          '<div class="kanban-col-title">' +
            '<span class="pip" style="background:' + s.color + ';"></span>' +
            s.label +
          '</div>' +
          '<div class="kanban-col-count">' + inCol.length + '</div>' +
        '</div>';

      inCol.forEach(function (o) {
        var card = document.createElement('div');
        card.className = 'opp';
        card.draggable = true;
        card.dataset.id = o.id;

        var staleClass = '';
        if (o.last_activity_at) {
          var d = Math.floor((Date.now() - new Date(o.last_activity_at).getTime()) / (1000 * 60 * 60 * 24));
          if (d >= STALE_DAYS && o.status !== 'closed' && o.status !== 'declined') staleClass = ' stale';
        }

        var compStr = '';
        if (o.comp_min || o.comp_max) {
          var fmt = function (n) { return '$' + (n / 1000).toFixed(0) + 'k'; };
          if (o.comp_min && o.comp_max) compStr = fmt(o.comp_min) + '–' + fmt(o.comp_max);
          else if (o.comp_max)          compStr = '≤ ' + fmt(o.comp_max);
          else                          compStr = '≥ ' + fmt(o.comp_min);
        }

        card.innerHTML =
          '<div class="opp-company">' + escapeHtml(o.company) + '</div>' +
          (o.role_title ? '<div class="opp-role">' + escapeHtml(o.role_title) + '</div>' : '') +
          '<div class="opp-meta">' +
            '<span class="opp-priority ' + (o.priority || 'med') + '"><span class="dot"></span>' + (o.priority || 'med') + '</span>' +
            (compStr ? '<span>' + compStr + '</span>' : '') +
            '<span class="opp-activity' + staleClass + '">' + fmtRelative(o.last_activity_at) + '</span>' +
          '</div>';

        card.addEventListener('click', function () { openOppModal(o); });
        attachDrag(card);
        col.appendChild(card);
      });

      var add = document.createElement('button');
      add.className = 'kanban-col-add';
      add.textContent = '+ Add';
      add.addEventListener('click', function () { openOppModal(null, s.key); });
      col.appendChild(add);

      attachDrop(col);
      host.appendChild(col);
    });
  }

  // ─── Drag and drop ─────────────────────────────────────────────────────────
  var draggingId = null;

  function attachDrag(el) {
    el.addEventListener('dragstart', function (e) {
      draggingId = el.dataset.id;
      el.classList.add('dragging');
      try { e.dataTransfer.setData('text/plain', draggingId); } catch (err) {}
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', function () {
      el.classList.remove('dragging');
      draggingId = null;
    });
  }

  function attachDrop(col) {
    col.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', function () { col.classList.remove('drag-over'); });
    col.addEventListener('drop', function (e) {
      e.preventDefault();
      col.classList.remove('drag-over');
      var id = draggingId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
      if (!id) return;
      var newStatus = col.dataset.status;
      var opp = opportunities.find(function (o) { return o.id === id; });
      if (!opp || opp.status === newStatus) return;
      updateOpp(id, { status: newStatus });
    });
  }

  // ─── Render: bottom panels ────────────────────────────────────────────────
  function renderThisWeek() {
    var host = document.getElementById('thisWeek');
    var today = new Date(); today.setHours(0,0,0,0);
    var weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);

    var items = opportunities
      .filter(function (o) { return o.next_step && o.next_step_date; })
      .filter(function (o) {
        var d = parseDate(o.next_step_date);
        return d && d >= today && d <= weekEnd;
      })
      .sort(function (a, b) { return parseDate(a.next_step_date) - parseDate(b.next_step_date); });

    if (!items.length) {
      host.innerHTML = '<div class="empty">No next steps scheduled this week.</div>';
      return;
    }

    host.innerHTML = items.map(function (o) {
      return '<div class="next-step-item">' +
        '<div class="next-step-date">' + fmtFullDate(o.next_step_date) + ' · ' + escapeHtml(o.company) + '</div>' +
        '<div>' + escapeHtml(o.next_step) + '</div>' +
      '</div>';
    }).join('');
  }

  function renderRecentConvs() {
    var host = document.getElementById('recentConvs');
    var items = conversations.slice(0, 10);
    if (!items.length) {
      host.innerHTML = '<div class="empty">No conversations logged yet.</div>';
      return;
    }
    host.innerHTML = items.map(function (c) {
      var opp = opportunities.find(function (o) { return o.id === c.opportunity_id; });
      var when = new Date(c.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return '<div class="conv-item">' +
        '<div class="conv-date">' + when +
          (c.channel ? ' · ' + c.channel.replace('_',' ') : '') +
          (opp ? ' · ' + escapeHtml(opp.company) : '') +
        '</div>' +
        '<div class="conv-summary">' + escapeHtml(c.summary) + '</div>' +
      '</div>';
    }).join('');
  }

  function renderAll() {
    renderCountdown();
    renderMilestones();
    renderKanban();
    renderThisWeek();
    renderRecentConvs();
  }

  // ─── Opportunity modal ────────────────────────────────────────────────────
  var editingOppId = null;

  function openOppModal(opp, presetStatus) {
    editingOppId = opp ? opp.id : null;
    var titleEl = document.getElementById('oppModalTitle');
    var subEl = document.getElementById('oppModalSub');

    titleEl.innerHTML = opp ? escapeHtml(opp.company) + ' <em>opportunity</em>' : 'New <em>opportunity</em>';
    subEl.textContent = opp ? ('Last activity ' + fmtRelative(opp.last_activity_at)) : 'Add a company or role to track';

    var fields = ['company','role_title','source','location','url','comp_min','comp_max','status','priority','fit_score','next_step','next_step_date','notes'];
    fields.forEach(function (f) {
      var el = document.getElementById('m_' + f);
      if (!el) return;
      if (opp) {
        el.value = opp[f] == null ? '' : opp[f];
      } else {
        if (f === 'status') el.value = presetStatus || 'researching';
        else if (f === 'priority') el.value = 'med';
        else el.value = '';
      }
    });

    var convSection = document.getElementById('oppConvSection');
    var archiveBtn = document.getElementById('archiveOppBtn');
    if (opp) {
      convSection.style.display = '';
      archiveBtn.style.display = '';
      // Default new conversation date to today
      document.getElementById('conv_date').value = todayISO();
      document.getElementById('conv_summary').value = '';
      document.getElementById('conv_next').value = '';
      document.getElementById('conv_next_date').value = '';
      document.getElementById('conv_channel').value = '';
      document.getElementById('conv_direction').value = '';
      loadConversationsForOpp(opp.id).then(renderOppConvLog);
    } else {
      convSection.style.display = 'none';
      archiveBtn.style.display = 'none';
    }

    document.getElementById('oppModal').classList.add('open');
    document.getElementById('m_company').focus();
  }

  function renderOppConvLog(rows) {
    var host = document.getElementById('oppConvLog');
    if (!rows.length) {
      host.innerHTML = '<div class="empty">No conversations logged yet.</div>';
      return;
    }
    host.innerHTML = rows.map(function (c) {
      var when = new Date(c.occurred_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return '<div class="conv-log-item">' +
        '<div class="conv-log-head">' +
          '<span>' + when + '</span>' +
          (c.channel ? '<span class="conv-log-channel">' + c.channel.replace('_',' ') + '</span>' : '') +
          (c.direction ? '<span>' + c.direction + '</span>' : '') +
        '</div>' +
        '<div class="conv-log-summary">' + escapeHtml(c.summary) + '</div>' +
        (c.next_step ? '<div class="conv-log-next">→ ' + escapeHtml(c.next_step) +
          (c.next_step_date ? ' · ' + fmtFullDate(c.next_step_date) : '') +
          '</div>' : '') +
      '</div>';
    }).join('');
  }

  function collectOppForm() {
    function num(id) { var v = document.getElementById(id).value; return v === '' ? null : Number(v); }
    function str(id) { var v = document.getElementById(id).value; return v === '' ? null : v; }
    return {
      company: document.getElementById('m_company').value.trim(),
      role_title: str('m_role_title'),
      source: str('m_source'),
      location: str('m_location'),
      url: str('m_url'),
      comp_min: num('m_comp_min'),
      comp_max: num('m_comp_max'),
      status: document.getElementById('m_status').value,
      priority: document.getElementById('m_priority').value,
      fit_score: num('m_fit_score'),
      next_step: str('m_next_step'),
      next_step_date: str('m_next_step_date'),
      notes: str('m_notes')
    };
  }

  function saveOpp() {
    var payload = collectOppForm();
    if (!payload.company) { toast('Company is required', 'error'); return; }

    var p = editingOppId
      ? sb.from('opportunities').update(payload).eq('id', editingOppId).select().single()
      : sb.from('opportunities').insert(payload).select().single();

    p.then(function (res) {
      if (res.error) throw res.error;
      toast(editingOppId ? 'Updated' : 'Added', 'success');
      closeModal('oppModal');
      return loadOpportunities().then(renderAll);
    }).catch(function (err) {
      toast('Save failed: ' + err.message, 'error');
    });
  }

  function updateOpp(id, patch) {
    sb.from('opportunities').update(patch).eq('id', id).select().single().then(function (res) {
      if (res.error) throw res.error;
      var i = opportunities.findIndex(function (o) { return o.id === id; });
      if (i >= 0) opportunities[i] = res.data;
      renderKanban();
      renderThisWeek();
    }).catch(function (err) { toast('Update failed: ' + err.message, 'error'); });
  }

  function archiveOpp() {
    if (!editingOppId) return;
    if (!confirm('Archive this opportunity? It will be hidden from the board.')) return;
    sb.from('opportunities').update({ is_archived: true }).eq('id', editingOppId).then(function (res) {
      if (res.error) throw res.error;
      toast('Archived', 'success');
      closeModal('oppModal');
      return loadOpportunities().then(renderAll);
    }).catch(function (err) { toast('Archive failed: ' + err.message, 'error'); });
  }

  function addConversation() {
    if (!editingOppId) return;
    var summary = document.getElementById('conv_summary').value.trim();
    if (!summary) { toast('Summary is required', 'error'); return; }
    var dateVal = document.getElementById('conv_date').value;
    var occurred_at = dateVal ? new Date(dateVal + 'T12:00:00').toISOString() : new Date().toISOString();
    var payload = {
      opportunity_id: editingOppId,
      occurred_at: occurred_at,
      channel: document.getElementById('conv_channel').value || null,
      direction: document.getElementById('conv_direction').value || null,
      summary: summary,
      next_step: document.getElementById('conv_next').value || null,
      next_step_date: document.getElementById('conv_next_date').value || null
    };
    sb.from('conversations').insert(payload).select().single().then(function (res) {
      if (res.error) throw res.error;
      toast('Logged', 'success');
      // Reset form fields
      document.getElementById('conv_summary').value = '';
      document.getElementById('conv_next').value = '';
      document.getElementById('conv_next_date').value = '';
      document.getElementById('conv_channel').value = '';
      document.getElementById('conv_direction').value = '';
      // Reload conv log + opportunities (last_activity_at trigger fired)
      return Promise.all([
        loadConversationsForOpp(editingOppId).then(renderOppConvLog),
        loadOpportunities(),
        loadRecentConversations()
      ]);
    }).then(function () {
      renderKanban();
      renderRecentConvs();
    }).catch(function (err) { toast('Log failed: ' + err.message, 'error'); });
  }

  // ─── Feature (milestone) modal ────────────────────────────────────────────
  var editingFeatureId = null;

  function openFeatureModal(f) {
    editingFeatureId = f.id;
    document.getElementById('featureModalTitle').textContent = f.title;
    document.getElementById('featureModalSub').textContent = f.target_week
      ? 'Target week of ' + fmtFullDate(f.target_week) : 'No target week set';
    document.getElementById('f_title').value = f.title || '';
    document.getElementById('f_status').value = f.status || 'idea';
    document.getElementById('f_target_week').value = f.target_week || '';
    document.getElementById('f_description').value = f.description || '';
    document.getElementById('featureModal').classList.add('open');
  }

  function saveFeature() {
    if (!editingFeatureId) return;
    var payload = {
      title: document.getElementById('f_title').value.trim(),
      status: document.getElementById('f_status').value,
      target_week: document.getElementById('f_target_week').value || null,
      description: document.getElementById('f_description').value || null
    };
    if (!payload.title) { toast('Title is required', 'error'); return; }
    sb.from('features').update(payload).eq('id', editingFeatureId).select().single().then(function (res) {
      if (res.error) throw res.error;
      toast('Saved', 'success');
      closeModal('featureModal');
      return loadFeatures().then(renderMilestones);
    }).catch(function (err) { toast('Save failed: ' + err.message, 'error'); });
  }

  // ─── Modal helpers ────────────────────────────────────────────────────────
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  function bindModalEvents() {
    document.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', function () { closeModal(el.dataset.closeModal); });
    });
    document.querySelectorAll('.modal-backdrop').forEach(function (b) {
      b.addEventListener('click', function (e) { if (e.target === b) b.classList.remove('open'); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.open').forEach(function (m) { m.classList.remove('open'); });
      }
    });

    document.getElementById('addOppBtn').addEventListener('click', function () { openOppModal(null); });
    document.getElementById('saveOppBtn').addEventListener('click', saveOpp);
    document.getElementById('archiveOppBtn').addEventListener('click', archiveOpp);
    document.getElementById('addConvBtn').addEventListener('click', addConversation);
    document.getElementById('saveFeatureBtn').addEventListener('click', saveFeature);
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    bindModalEvents();
    init();
  });
})();
