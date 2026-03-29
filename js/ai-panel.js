/* ============================================================
   ai-panel.js — AI chat side panel
   Exposed on window.AIPanel
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'anthropic_api_key';
  var MODEL       = 'claude-sonnet-4-20250514';
  var API_URL     = 'https://api.anthropic.com/v1/messages';
  var panelEl     = null;
  var messagesEl  = null;
  var messages    = []; // { role: 'user'|'assistant', content: string }

  var SYSTEM_PROMPT =
    'You are a personal project management assistant embedded in a time management dashboard called james.today. ' +
    'The user is a solo creative/developer who organizes work through projects, features, and tasks. ' +
    'Each day is associated with a planetary domain (qualitative time system): ' +
    'Saturday=Mula/Saturn, Sunday=Dharma/Sun, Monday=Seva/Moon, Tuesday=Karma/Mars, Wednesday=Vidya/Mercury, Thursday=Sangha/Jupiter, Friday=Prema/Venus. ' +
    'The 6 statuses are: idea, planning, scheduled, building, done, integrated. ' +
    'Be concise, practical, and aware of what the user is currently working on. ' +
    'Suggest prioritization, flag stale items, help with planning. ' +
    'Keep responses short unless asked to elaborate.';

  /* ---- API key ---- */

  function getApiKey() {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function saveApiKey(key) {
    try {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } catch (_) { /* noop */ }
  }

  function hasApiKey() {
    return getApiKey().length > 0;
  }

  /* ---- Context builder ---- */

  function buildContext() {
    var domain = QTime.today();
    var parts = [];

    parts.push('Today: ' + Utils.formatDateFull(Utils.isoDate(new Date())));
    parts.push('Domain: ' + domain.name + ' (' + domain.planet + ') — "' + domain.question + '"');

    /* Active projects summary */
    var projects = Data.activeProjects();
    if (projects.length > 0) {
      parts.push('');
      parts.push('Active projects (' + projects.length + '):');
      projects.forEach(function (p) {
        var features = Data.projectFeatures(p.id);
        var built = features.filter(function (f) { return f.status === 'done' || f.status === 'integrated'; }).length;
        parts.push('  - ' + p.name + ' [' + (p.type || 'unknown') + '] — ' + built + '/' + features.length + ' features complete, status: ' + p.status);
      });
    }

    /* This week items */
    var weekItems = Data.thisWeekItems();
    if (weekItems.length > 0) {
      parts.push('');
      parts.push('This week (' + weekItems.length + ' items):');
      weekItems.slice(0, 15).forEach(function (item) {
        var project = Data.state.projects.get(item.project_id);
        var projName = project ? project.name : '?';
        parts.push('  - [' + item.status + '] ' + item.title + ' (' + projName + ')' + (item.importance === 'high' ? ' *HIGH*' : ''));
      });
    }

    /* Timer state */
    if (window.TimeView && TimeView.timerStartedAt) {
      var elapsed = Math.round((Date.now() - TimeView.timerStartedAt.getTime()) / 60000);
      parts.push('');
      parts.push('Timer running: ' + elapsed + ' minutes');
    }

    /* Recent sessions */
    var todaySessions = Data.todaysSessions();
    if (todaySessions.length > 0) {
      parts.push('');
      parts.push('Today\'s sessions (' + todaySessions.length + '):');
      todaySessions.forEach(function (s) {
        var mins = s.duration_min || Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
        var project = Data.state.projects.get(s.project_id);
        parts.push('  - ' + (s.description || 'Untitled') + ' (' + (project ? project.name : '?') + ') — ' + Utils.formatDuration(mins));
      });
    }

    return parts.join('\n');
  }

  /* ---- Render panel structure ---- */

  function renderPanelHTML() {
    return '' +
      '<div class="ai-panel" id="ai-panel">' +
        '<div class="ai-panel-header" style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-6) var(--space-8);border-bottom:1px solid var(--border-subtle);">' +
          '<span style="font-size:var(--text-sm);font-weight:500;color:var(--text-primary);letter-spacing:var(--tracking-wide);">Assistant</span>' +
          '<button data-action="ai-close" style="font-size:var(--text-md);color:var(--text-faint);padding:var(--space-1) var(--space-3);border-radius:var(--radius-sm);transition:color var(--transition);">&times;</button>' +
        '</div>' +
        '<div class="ai-panel-messages" id="ai-messages" style="flex:1;overflow-y:auto;padding:var(--space-6) var(--space-8);display:flex;flex-direction:column;gap:var(--space-4);">' +
        '</div>' +
        '<div class="ai-panel-input" style="padding:var(--space-4) var(--space-8);border-top:1px solid var(--border-subtle);display:flex;gap:var(--space-3);">' +
          '<input type="text" id="ai-input" placeholder="Ask something..." style="flex:1;">' +
          '<button class="btn-primary" data-action="ai-send" style="padding:var(--space-4) var(--space-6);font-size:var(--text-xs);">Send</button>' +
        '</div>' +
      '</div>';
  }

  function renderSetupForm() {
    return '' +
      '<div style="padding:var(--space-10);display:flex;flex-direction:column;gap:var(--space-6);text-align:center;">' +
        '<p style="font-size:var(--text-sm);color:var(--text-secondary);">Enter your Anthropic API key to enable the AI assistant</p>' +
        '<input type="password" id="ai-key-input" placeholder="sk-ant-..." style="font-size:var(--text-sm);">' +
        '<button class="btn-primary" data-action="ai-save-key" style="align-self:center;">Save Key</button>' +
        '<p style="font-size:var(--text-2xs);color:var(--text-faint);">Stored locally in your browser. Never sent to any server except Anthropic.</p>' +
      '</div>';
  }

  /* ---- Message rendering ---- */

  function renderMessage(role, content) {
    var align  = role === 'user' ? 'flex-end' : 'flex-start';
    var bg     = role === 'user' ? 'var(--accent-subtle)' : 'var(--bg-card)';
    var border = role === 'user' ? 'var(--accent-line)' : 'var(--border-subtle)';

    return '' +
      '<div style="align-self:' + align + ';max-width:85%;padding:var(--space-4) var(--space-6);background:' + bg + ';border:1px solid ' + border + ';border-radius:var(--radius);font-size:var(--text-sm);color:var(--text-default);line-height:1.5;white-space:pre-wrap;word-wrap:break-word;">' +
        Utils.esc(content) +
      '</div>';
  }

  function refreshMessages() {
    if (!messagesEl) return;

    if (!hasApiKey()) {
      messagesEl.innerHTML = renderSetupForm();
      return;
    }

    var html = '';
    messages.forEach(function (m) {
      html += renderMessage(m.role, m.content);
    });

    if (messages.length === 0) {
      html += '' +
        '<div style="text-align:center;padding:var(--space-10) 0;">' +
          '<p style="font-size:var(--text-sm);color:var(--text-tertiary);">Ask me about your projects, priorities, or schedule.</p>' +
        '</div>';
    }

    messagesEl.innerHTML = html;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, content) {
    messages.push({ role: role, content: content });
    refreshMessages();
  }

  /* ---- API call ---- */

  function send(userMessage) {
    if (!userMessage || !userMessage.trim()) return;
    userMessage = userMessage.trim();

    addMessage('user', userMessage);

    var apiKey = getApiKey();
    if (!apiKey) {
      addMessage('assistant', 'No API key configured. Please set up your key first.');
      return;
    }

    /* Build API messages */
    var context = buildContext();
    var apiMessages = [];

    /* Include conversation history (last 20 messages max) */
    var historyStart = Math.max(0, messages.length - 20);
    for (var i = historyStart; i < messages.length; i++) {
      apiMessages.push({
        role: messages[i].role,
        content: messages[i].content,
      });
    }

    /* Prepend context to first user message */
    if (apiMessages.length === 1) {
      apiMessages[0].content = '[Dashboard context]\n' + context + '\n\n[User]\n' + apiMessages[0].content;
    }

    /* Add loading indicator */
    var loadingId = 'ai-loading-' + Date.now();
    if (messagesEl) {
      var loadingEl = document.createElement('div');
      loadingEl.id = loadingId;
      loadingEl.style.cssText = 'align-self:flex-start;padding:var(--space-4) var(--space-6);font-size:var(--text-xs);color:var(--text-faint);';
      loadingEl.textContent = 'Thinking...';
      messagesEl.appendChild(loadingEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
      }),
    })
    .then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error(err.error ? err.error.message : 'API request failed (' + res.status + ')');
        });
      }
      return res.json();
    })
    .then(function (data) {
      var loader = document.getElementById(loadingId);
      if (loader) loader.remove();

      var text = '';
      if (data.content && data.content.length > 0) {
        text = data.content.map(function (block) { return block.text || ''; }).join('');
      }
      addMessage('assistant', text || '(No response)');
    })
    .catch(function (err) {
      var loader = document.getElementById(loadingId);
      if (loader) loader.remove();
      addMessage('assistant', 'Error: ' + err.message);
    });
  }

  /* ---- Init ---- */

  function init() {
    /* Create panel DOM */
    var wrapper = document.createElement('div');
    wrapper.innerHTML = renderPanelHTML();
    panelEl = wrapper.firstElementChild;
    document.body.appendChild(panelEl);

    /* Style the panel */
    panelEl.style.cssText = '' +
      'position:fixed;top:0;right:0;bottom:0;width:var(--ai-panel-width);' +
      'background:var(--bg-raised);border-left:1px solid var(--border-subtle);' +
      'display:flex;flex-direction:column;z-index:150;' +
      'transform:translateX(100%);transition:transform var(--transition-slow);';

    messagesEl = panelEl.querySelector('#ai-messages');
    refreshMessages();
    bindEvents();
  }

  /* ---- Toggle ---- */

  function toggle() {
    if (!panelEl) init();

    var isOpen = panelEl.classList.contains('open');

    if (isOpen) {
      panelEl.classList.remove('open');
      panelEl.style.transform = 'translateX(100%)';
      document.body.classList.remove('ai-open');
    } else {
      panelEl.classList.add('open');
      panelEl.style.transform = 'translateX(0)';
      document.body.classList.add('ai-open');
      var input = panelEl.querySelector('#ai-input');
      if (input) setTimeout(function () { input.focus(); }, 100);
    }
  }

  /* ---- Events ---- */

  function bindEvents() {
    if (!panelEl) return;

    panelEl.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;

      var action = target.getAttribute('data-action');

      switch (action) {
        case 'ai-close':
          toggle();
          break;
        case 'ai-send':
          sendFromInput();
          break;
        case 'ai-save-key':
          saveKeyFromInput();
          break;
      }
    });

    panelEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.id === 'ai-input') {
        e.preventDefault();
        sendFromInput();
      }
      if (e.key === 'Enter' && e.target.id === 'ai-key-input') {
        e.preventDefault();
        saveKeyFromInput();
      }
    });
  }

  function sendFromInput() {
    var input = panelEl ? panelEl.querySelector('#ai-input') : null;
    if (!input) return;
    var msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    send(msg);
  }

  function saveKeyFromInput() {
    var input = panelEl ? panelEl.querySelector('#ai-key-input') : null;
    if (!input) return;
    var key = input.value.trim();
    if (!key) return;
    saveApiKey(key);
    refreshMessages();
  }

  /* ---- Render (returns HTML string for reference, panel is fixed-position) ---- */

  function render() {
    return renderPanelHTML();
  }

  /* ---- Expose ---- */
  window.AIPanel = {
    init:       init,
    toggle:     toggle,
    send:       send,
    render:     render,
    addMessage: addMessage,
  };
})();
