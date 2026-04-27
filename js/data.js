(function() {
  'use strict';

  var SUPABASE_URL = 'https://reoliysifzxuzpskywtm.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_trmR_URy0KyDtDUfpgjOfg_owXvNPRI';

  var client = null;
  var listeners = {};

  var state = {
    projects: [],
    tasks: [],
    timeSessions: [],
    journal: null,            // shortcut: today's journal record
    journalsByDate: {},       // map: 'YYYY-MM-DD' -> journal record (week range)
    weekSessions: [],         // time_sessions for the visible week
    weekStart: null,          // Date — Monday of the visible week
    user: null,
  };

  // ---------------------------------------------------------------------------
  // Event bus
  // ---------------------------------------------------------------------------

  function on(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  }

  function emit(event, data) {
    var cbs = listeners[event] || [];
    for (var i = 0; i < cbs.length; i++) {
      try { cbs[i](data); } catch (e) { console.error('[Data] listener error:', e); }
    }
  }

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------

  function toast(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(container);
    }
    var el = document.createElement('div');
    var bgMap = { success: '#2d6a4f', error: '#a4161a', info: '#343a40' };
    el.style.cssText = 'padding:10px 18px;border-radius:8px;color:#fff;font-size:14px;pointer-events:auto;opacity:0;transition:opacity 0.3s;background:' + (bgMap[type] || bgMap.info) + ';';
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(function() { el.style.opacity = '1'; });
    setTimeout(function() {
      el.style.opacity = '0';
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 3000);
  }

  // ---------------------------------------------------------------------------
  // Date helpers (week-aware)
  // ---------------------------------------------------------------------------

  /** Monday of the week containing `date`. Returns a new Date at 00:00 local. */
  function startOfWeek(date) {
    var d = new Date(date);
    var day = d.getDay();                  // 0=Sun..6=Sat
    var diff = day === 0 ? -6 : 1 - day;   // Monday-based week start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  /** YYYY-MM-DD in local time (matches Utils.isoDate semantics). */
  function dateStr(d) {
    return Utils.isoDate(d);
  }

  // ---------------------------------------------------------------------------
  // Init / Auth
  // ---------------------------------------------------------------------------

  function init() {
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.error('[Data] Supabase JS library not loaded');
      toast('Supabase library not loaded', 'error');
      return Promise.reject(new Error('Supabase not loaded'));
    }

    client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    return client.auth.getSession().then(function(result) {
      var session = result.data && result.data.session;
      if (!session) {
        window.location.href = 'login.html';
        return Promise.reject(new Error('No session'));
      }
      state.user = session.user;
      return loadAll();
    }).then(function() {
      emit('dataChanged', state);
      return state;
    }).catch(function(err) {
      console.error('[Data] init error:', err);
      if (err.message !== 'No session') {
        toast('Failed to initialize: ' + err.message, 'error');
      }
      throw err;
    });
  }

  function signOut() {
    if (!client) return;
    client.auth.signOut().then(function() {
      window.location.href = 'login.html';
    }).catch(function(err) {
      console.error('[Data] sign out error:', err);
      toast('Sign out failed: ' + err.message, 'error');
    });
  }

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  function loadAll() {
    state.weekStart = startOfWeek(new Date());
    var sunday = addDays(state.weekStart, 6);
    return Promise.all([
      loadProjects(),
      loadTasks(),
      loadTimeSessions(),
      loadTodayJournal(),
      loadJournalRange(dateStr(state.weekStart), dateStr(sunday)),
      loadSessionsRange(state.weekStart, sunday),
    ]);
  }

  function loadProjects() {
    return client
      .from('projects')
      .select('*')
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .then(function(res) {
        if (res.error) throw res.error;
        state.projects = res.data || [];
        return state.projects;
      })
      .catch(function(err) {
        console.error('[Data] loadProjects error:', err);
        toast('Failed to load projects: ' + (err.message || err), 'error');
        state.projects = [];
      });
  }

  function loadTasks() {
    return client
      .from('tasks')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .then(function(res) {
        if (res.error) throw res.error;
        state.tasks = res.data || [];
        return state.tasks;
      })
      .catch(function(err) {
        console.error('[Data] loadTasks error:', err);
        toast('Failed to load tasks: ' + (err.message || err), 'error');
        state.tasks = [];
      });
  }

  function loadTimeSessions() {
    return client
      .from('time_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50)
      .then(function(res) {
        if (res.error) throw res.error;
        state.timeSessions = res.data || [];
        return state.timeSessions;
      })
      .catch(function(err) {
        console.error('[Data] loadTimeSessions error:', err);
        toast('Failed to load time sessions: ' + (err.message || err), 'error');
        state.timeSessions = [];
      });
  }

  function loadTodayJournal(d) {
    var today = d || dateStr(new Date());
    return client
      .from('journal')
      .select('*')
      .eq('entry_date', today)
      .maybeSingle()
      .then(function(res) {
        if (res.error) throw res.error;
        state.journal = res.data || null;
        if (state.journal) state.journalsByDate[today] = state.journal;
        return state.journal;
      })
      .catch(function(err) {
        console.error('[Data] loadTodayJournal error:', err);
        toast('Failed to load journal: ' + (err.message || err), 'error');
        state.journal = null;
      });
  }

  /** Load all journal rows in [startDate, endDate] (YYYY-MM-DD inclusive). */
  function loadJournalRange(startDate, endDate) {
    return client
      .from('journal')
      .select('*')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .then(function(res) {
        if (res.error) throw res.error;
        state.journalsByDate = {};
        (res.data || []).forEach(function(j) {
          state.journalsByDate[j.entry_date] = j;
        });
        // Keep `state.journal` shortcut in sync if today is in range
        var today = dateStr(new Date());
        if (state.journalsByDate[today]) state.journal = state.journalsByDate[today];
        return state.journalsByDate;
      })
      .catch(function(err) {
        console.error('[Data] loadJournalRange error:', err);
        toast('Failed to load journal range: ' + (err.message || err), 'error');
        state.journalsByDate = {};
      });
  }

  /** Load time_sessions in [startDate, endDate] (Date objects, inclusive).
      Uses a 1-day buffer on each side to absorb timezone edges; final filter
      happens client-side via local date matching in render code. */
  function loadSessionsRange(startDate, endDate) {
    var lo = addDays(startDate, -1);
    var hi = addDays(endDate, 2);  // exclusive upper bound = day after end+1
    return client
      .from('time_sessions')
      .select('*')
      .gte('started_at', lo.toISOString())
      .lt('started_at', hi.toISOString())
      .order('started_at', { ascending: true })
      .then(function(res) {
        if (res.error) throw res.error;
        state.weekSessions = res.data || [];
        return state.weekSessions;
      })
      .catch(function(err) {
        console.error('[Data] loadSessionsRange error:', err);
        toast('Failed to load week sessions: ' + (err.message || err), 'error');
        state.weekSessions = [];
      });
  }

  // ---------------------------------------------------------------------------
  // CRUD — Projects
  // ---------------------------------------------------------------------------

  function saveProject(obj, id) {
    try {
      if (id) {
        return client
          .from('projects')
          .update(obj)
          .eq('id', id)
          .select()
          .single()
          .then(function(res) {
            if (res.error) throw res.error;
            return loadProjects().then(function() {
              emit('dataChanged', state);
              return res.data;
            });
          })
          .catch(function(err) {
            console.error('[Data] saveProject update error:', err);
            toast('Failed to save project: ' + (err.message || err), 'error');
            throw err;
          });
      } else {
        var maxOrder = 0;
        for (var i = 0; i < state.projects.length; i++) {
          if ((state.projects[i].sort_order || 0) > maxOrder) {
            maxOrder = state.projects[i].sort_order || 0;
          }
        }
        obj.sort_order = maxOrder + 1;

        return client
          .from('projects')
          .insert(obj)
          .select()
          .single()
          .then(function(res) {
            if (res.error) throw res.error;
            return loadProjects().then(function() {
              emit('dataChanged', state);
              return res.data;
            });
          })
          .catch(function(err) {
            console.error('[Data] saveProject insert error:', err);
            toast('Failed to create project: ' + (err.message || err), 'error');
            throw err;
          });
      }
    } catch (err) {
      console.error('[Data] saveProject error:', err);
      toast('Failed to save project: ' + (err.message || err), 'error');
      return Promise.reject(err);
    }
  }

  function archiveProject(id) {
    return client
      .from('projects')
      .update({ is_archived: true })
      .eq('id', id)
      .then(function(res) {
        if (res.error) throw res.error;
        return loadProjects().then(function() {
          emit('dataChanged', state);
        });
      })
      .catch(function(err) {
        console.error('[Data] archiveProject error:', err);
        toast('Failed to archive project: ' + (err.message || err), 'error');
        throw err;
      });
  }

  function reorderProjects(orderedIds) {
    var updates = orderedIds.map(function(id, idx) {
      return client
        .from('projects')
        .update({ sort_order: idx })
        .eq('id', id);
    });

    return Promise.all(updates).then(function(results) {
      for (var i = 0; i < results.length; i++) {
        if (results[i].error) throw results[i].error;
      }
      return loadProjects().then(function() {
        emit('dataChanged', state);
      });
    }).catch(function(err) {
      console.error('[Data] reorderProjects error:', err);
      toast('Failed to reorder projects: ' + (err.message || err), 'error');
      throw err;
    });
  }

  // ---------------------------------------------------------------------------
  // CRUD — Tasks
  // ---------------------------------------------------------------------------

  function saveTask(obj, id) {
    try {
      if (id) {
        return client
          .from('tasks')
          .update(obj)
          .eq('id', id)
          .select()
          .single()
          .then(function(res) {
            if (res.error) throw res.error;
            return loadTasks().then(function() {
              emit('dataChanged', state);
              return res.data;
            });
          })
          .catch(function(err) {
            console.error('[Data] saveTask update error:', err);
            toast('Failed to save task: ' + (err.message || err), 'error');
            throw err;
          });
      } else {
        return client
          .from('tasks')
          .insert(obj)
          .select()
          .single()
          .then(function(res) {
            if (res.error) throw res.error;
            return loadTasks().then(function() {
              emit('dataChanged', state);
              return res.data;
            });
          })
          .catch(function(err) {
            console.error('[Data] saveTask insert error:', err);
            toast('Failed to create task: ' + (err.message || err), 'error');
            throw err;
          });
      }
    } catch (err) {
      console.error('[Data] saveTask error:', err);
      toast('Failed to save task: ' + (err.message || err), 'error');
      return Promise.reject(err);
    }
  }

  function archiveTask(id) {
    return client
      .from('tasks')
      .update({ is_archived: true })
      .eq('id', id)
      .then(function(res) {
        if (res.error) throw res.error;
        return loadTasks().then(function() {
          emit('dataChanged', state);
        });
      })
      .catch(function(err) {
        console.error('[Data] archiveTask error:', err);
        toast('Failed to archive task: ' + (err.message || err), 'error');
        throw err;
      });
  }

  /** Pin a task to a specific date. If status is idea/planning, transition to
      scheduled. Pass `null` to unset. */
  function setTaskScheduledDate(taskId, dateStrOrNull) {
    var task = null;
    for (var i = 0; i < state.tasks.length; i++) {
      if (state.tasks[i].id === taskId) { task = state.tasks[i]; break; }
    }
    var payload = { scheduled_date: dateStrOrNull };
    if (dateStrOrNull && task && (task.status === 'idea' || task.status === 'planning')) {
      payload.status = 'scheduled';
    }
    return saveTask(payload, taskId);
  }

  // ---------------------------------------------------------------------------
  // CRUD — Time Sessions
  // ---------------------------------------------------------------------------

  function saveTimeSession(obj, id) {
    try {
      function attemptSave(payload, retryWithoutTrack) {
        if (id) {
          return client
            .from('time_sessions')
            .update(payload)
            .eq('id', id)
            .select()
            .single()
            .then(function(res) {
              if (res.error) throw res.error;
              return Promise.all([loadTimeSessions(), reloadWeekSessions()]).then(function() {
                emit('dataChanged', state);
                return res.data;
              });
            })
            .catch(function(err) {
              if (retryWithoutTrack && payload.track !== undefined && err && /track|column/i.test(err.message || '')) {
                var fallback = Object.assign({}, payload);
                delete fallback.track;
                return attemptSave(fallback, false);
              }
              console.error('[Data] saveTimeSession update error:', err);
              toast('Failed to save time session: ' + (err.message || err), 'error');
              throw err;
            });
        } else {
          return client
            .from('time_sessions')
            .insert(payload)
            .select()
            .single()
            .then(function(res) {
              if (res.error) throw res.error;
              return Promise.all([loadTimeSessions(), reloadWeekSessions()]).then(function() {
                emit('dataChanged', state);
                return res.data;
              });
            })
            .catch(function(err) {
              if (retryWithoutTrack && payload.track !== undefined && err && /track|column/i.test(err.message || '')) {
                var fallback = Object.assign({}, payload);
                delete fallback.track;
                return attemptSave(fallback, false);
              }
              console.error('[Data] saveTimeSession insert error:', err);
              toast('Failed to create time session: ' + (err.message || err), 'error');
              throw err;
            });
        }
      }
      return attemptSave(obj, true);
    } catch (err) {
      console.error('[Data] saveTimeSession error:', err);
      toast('Failed to save time session: ' + (err.message || err), 'error');
      return Promise.reject(err);
    }
  }

  function deleteTimeSession(id) {
    return client
      .from('time_sessions')
      .delete()
      .eq('id', id)
      .then(function(res) {
        if (res.error) throw res.error;
        return Promise.all([loadTimeSessions(), reloadWeekSessions()]).then(function() {
          emit('dataChanged', state);
        });
      })
      .catch(function(err) {
        console.error('[Data] deleteTimeSession error:', err);
        toast('Failed to delete time session: ' + (err.message || err), 'error');
        throw err;
      });
  }

  function reloadWeekSessions() {
    if (!state.weekStart) return Promise.resolve();
    return loadSessionsRange(state.weekStart, addDays(state.weekStart, 6));
  }

  // ---------------------------------------------------------------------------
  // CRUD — Journal (extended for any date)
  // ---------------------------------------------------------------------------

  /** Save a journal entry for `dateStrParam` (defaults to today).
      UPSERT: only the columns provided are written; existing fields preserved
      on conflict by entry_date. */
  function saveJournal(obj, dateStrParam) {
    var entryDate = dateStrParam || dateStr(new Date());
    var payload = Object.assign({}, obj, { entry_date: entryDate });

    return client
      .from('journal')
      .upsert(payload, { onConflict: 'entry_date' })
      .select()
      .single()
      .then(function(res) {
        if (res.error) throw res.error;
        var saved = res.data;
        state.journalsByDate[saved.entry_date] = saved;
        if (saved.entry_date === dateStr(new Date())) state.journal = saved;
        emit('dataChanged', state);
        return saved;
      })
      .catch(function(err) {
        console.error('[Data] saveJournal error:', err);
        toast('Failed to save journal: ' + (err.message || err), 'error');
        throw err;
      });
  }

  /** Toggle a habit boolean for a specific date. */
  function toggleHabit(dateStrParam, habitKey) {
    var existing = state.journalsByDate[dateStrParam] || {};
    var field = habitKey + '_done';
    var newValue = !existing[field];
    var payload = {};
    payload[field] = newValue;
    return saveJournal(payload, dateStrParam);
  }

  // ---------------------------------------------------------------------------
  // Week navigation
  // ---------------------------------------------------------------------------

  /** Jump to the week containing `date`. Reloads journals + sessions. */
  function setWeekStart(date) {
    var monday = startOfWeek(date);
    state.weekStart = monday;
    var sunday = addDays(monday, 6);
    return Promise.all([
      loadJournalRange(dateStr(monday), dateStr(sunday)),
      loadSessionsRange(monday, sunday),
    ]).then(function() {
      emit('dataChanged', state);
    });
  }

  // ---------------------------------------------------------------------------
  // Local state helpers
  // ---------------------------------------------------------------------------

  function projectTasks(projectId) {
    return state.tasks.filter(function(t) { return t.project_id === projectId; });
  }

  function activeProjects() {
    return state.projects.filter(function(p) {
      return p.status !== 'done' && p.status !== 'integrated';
    });
  }

  function todaySessions() {
    var today = dateStr(new Date());
    return state.timeSessions.filter(function(s) {
      return s.started_at && dateStr(new Date(s.started_at)) === today;
    });
  }

  /** Tasks scheduled to a given local date. */
  function tasksForDate(dateStrParam) {
    return state.tasks.filter(function(t) {
      return t.scheduled_date === dateStrParam;
    });
  }

  /** Sessions whose started_at falls on `dateStrParam` in local time. */
  function weekSessionsForDate(dateStrParam) {
    return state.weekSessions.filter(function(s) {
      return s.started_at && dateStr(new Date(s.started_at)) === dateStrParam;
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.Data = {
    state: state,
    init: init,
    signOut: signOut,
    loadAll: loadAll,
    loadProjects: loadProjects,
    loadTasks: loadTasks,
    loadTimeSessions: loadTimeSessions,
    loadTodayJournal: loadTodayJournal,
    loadJournalRange: loadJournalRange,
    loadSessionsRange: loadSessionsRange,
    saveProject: saveProject,
    archiveProject: archiveProject,
    reorderProjects: reorderProjects,
    saveTask: saveTask,
    archiveTask: archiveTask,
    setTaskScheduledDate: setTaskScheduledDate,
    saveTimeSession: saveTimeSession,
    deleteTimeSession: deleteTimeSession,
    saveJournal: saveJournal,
    toggleHabit: toggleHabit,
    setWeekStart: setWeekStart,
    projectTasks: projectTasks,
    activeProjects: activeProjects,
    todaySessions: todaySessions,
    tasksForDate: tasksForDate,
    weekSessionsForDate: weekSessionsForDate,
    startOfWeek: startOfWeek,
    addDays: addDays,
    dateStr: dateStr,
    on: on,
    emit: emit,
    toast: toast,
  };
})();
