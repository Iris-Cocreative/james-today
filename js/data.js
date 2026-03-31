(function() {
  'use strict';

  var SUPABASE_URL = 'https://reoliysifzxuzpskywtm.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_trmR_URy0KyDtDUfpgjOfg_owXvNPRI';

  var client = null;
  var listeners = {};

  // Adds a .get(id) method to arrays so views can do state.projects.get(id)
  function enrichArray(arr) {
    arr.get = function(id) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id) return arr[i];
      }
      return undefined;
    };
    return arr;
  }

  var state = {
    projects: enrichArray([]),
    features: enrichArray([]),
    tasks: enrichArray([]),
    timeSessions: enrichArray([]),
    journal: null,
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
    // fade in
    requestAnimationFrame(function() { el.style.opacity = '1'; });
    // auto-dismiss
    setTimeout(function() {
      el.style.opacity = '0';
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 3000);
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

  function getUser() {
    return state.user;
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
    return Promise.all([
      loadProjects(),
      loadFeatures(),
      loadTasks(),
      loadTimeSessions(),
      loadTodayJournal(),
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
        state.projects = enrichArray(res.data || []);
        return state.projects;
      })
      .catch(function(err) {
        console.error('[Data] loadProjects error:', err);
        toast('Failed to load projects: ' + (err.message || err), 'error');
        state.projects = enrichArray([]);
      });
  }

  function loadFeatures() {
    return client
      .from('features')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .then(function(res) {
        if (res.error) throw res.error;
        state.features = enrichArray(res.data || []);
        return state.features;
      })
      .catch(function(err) {
        console.error('[Data] loadFeatures error:', err);
        toast('Failed to load features: ' + (err.message || err), 'error');
        state.features = enrichArray([]);
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
        state.tasks = enrichArray(res.data || []);
        return state.tasks;
      })
      .catch(function(err) {
        console.error('[Data] loadTasks error:', err);
        toast('Failed to load tasks: ' + (err.message || err), 'error');
        state.tasks = enrichArray([]);
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
        state.timeSessions = enrichArray(res.data || []);
        return state.timeSessions;
      })
      .catch(function(err) {
        console.error('[Data] loadTimeSessions error:', err);
        toast('Failed to load time sessions: ' + (err.message || err), 'error');
        state.timeSessions = enrichArray([]);
      });
  }

  function loadTodayJournal() {
    var today = Utils.isoDate(new Date());
    return client
      .from('journal')
      .select('*')
      .eq('entry_date', today)
      .maybeSingle()
      .then(function(res) {
        if (res.error) throw res.error;
        state.journal = res.data || null;
        return state.journal;
      })
      .catch(function(err) {
        console.error('[Data] loadTodayJournal error:', err);
        toast('Failed to load journal: ' + (err.message || err), 'error');
        state.journal = null;
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
  // CRUD — Features
  // ---------------------------------------------------------------------------

  function saveFeature(obj, id) {
    try {
      if (id) {
        return client
          .from('features')
          .update(obj)
          .eq('id', id)
          .select()
          .single()
          .then(function(res) {
            if (res.error) throw res.error;
            return loadFeatures().then(function() {
              emit('dataChanged', state);
              return res.data;
            });
          })
          .catch(function(err) {
            console.error('[Data] saveFeature update error:', err);
            toast('Failed to save feature: ' + (err.message || err), 'error');
            throw err;
          });
      } else {
        return client
          .from('features')
          .insert(obj)
          .select()
          .single()
          .then(function(res) {
            if (res.error) throw res.error;
            return loadFeatures().then(function() {
              emit('dataChanged', state);
              return res.data;
            });
          })
          .catch(function(err) {
            console.error('[Data] saveFeature insert error:', err);
            toast('Failed to create feature: ' + (err.message || err), 'error');
            throw err;
          });
      }
    } catch (err) {
      console.error('[Data] saveFeature error:', err);
      toast('Failed to save feature: ' + (err.message || err), 'error');
      return Promise.reject(err);
    }
  }

  function archiveFeature(id) {
    return client
      .from('features')
      .update({ is_archived: true })
      .eq('id', id)
      .then(function(res) {
        if (res.error) throw res.error;
        return loadFeatures().then(function() {
          emit('dataChanged', state);
        });
      })
      .catch(function(err) {
        console.error('[Data] archiveFeature error:', err);
        toast('Failed to archive feature: ' + (err.message || err), 'error');
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

  // ---------------------------------------------------------------------------
  // CRUD — Time Sessions
  // ---------------------------------------------------------------------------

  function saveTimeSession(obj, id) {
    try {
      if (id) {
        return client
          .from('time_sessions')
          .update(obj)
          .eq('id', id)
          .select()
          .single()
          .then(function(res) {
            if (res.error) throw res.error;
            return loadTimeSessions().then(function() {
              emit('dataChanged', state);
              return res.data;
            });
          })
          .catch(function(err) {
            console.error('[Data] saveTimeSession update error:', err);
            toast('Failed to save time session: ' + (err.message || err), 'error');
            throw err;
          });
      } else {
        return client
          .from('time_sessions')
          .insert(obj)
          .select()
          .single()
          .then(function(res) {
            if (res.error) throw res.error;
            return loadTimeSessions().then(function() {
              emit('dataChanged', state);
              return res.data;
            });
          })
          .catch(function(err) {
            console.error('[Data] saveTimeSession insert error:', err);
            toast('Failed to create time session: ' + (err.message || err), 'error');
            throw err;
          });
      }
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
        return loadTimeSessions().then(function() {
          emit('dataChanged', state);
        });
      })
      .catch(function(err) {
        console.error('[Data] deleteTimeSession error:', err);
        toast('Failed to delete time session: ' + (err.message || err), 'error');
        throw err;
      });
  }

  // ---------------------------------------------------------------------------
  // CRUD — Journal
  // ---------------------------------------------------------------------------

  function saveJournal(obj) {
    var today = Utils.isoDate(new Date());
    obj.entry_date = today;

    return client
      .from('journal')
      .upsert(obj, { onConflict: 'entry_date' })
      .select()
      .single()
      .then(function(res) {
        if (res.error) throw res.error;
        state.journal = res.data;
        emit('dataChanged', state);
        return res.data;
      })
      .catch(function(err) {
        console.error('[Data] saveJournal error:', err);
        toast('Failed to save journal: ' + (err.message || err), 'error');
        throw err;
      });
  }

  // ---------------------------------------------------------------------------
  // Local state helpers
  // ---------------------------------------------------------------------------

  function projectTasks(projectId) {
    return state.tasks.filter(function(t) { return t.project_id === projectId; });
  }

  function projectFeatures(projectId) {
    return state.features.filter(function(f) { return f.project_id === projectId; });
  }

  function activeProjects() {
    return state.projects.filter(function(p) {
      return p.status !== 'done' && p.status !== 'integrated';
    });
  }

  function todaySessions() {
    var today = Utils.isoDate(new Date());
    return state.timeSessions.filter(function(s) {
      return s.started_at && Utils.isoDate(s.started_at) === today;
    });
  }

  function totalMinutesToday() {
    var sessions = todaySessions();
    var total = 0;
    sessions.forEach(function(s) {
      if (s.duration_min) {
        total += s.duration_min;
      } else if (s.started_at && s.ended_at) {
        total += Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000);
      }
    });
    return total;
  }

  function staleItems(days) {
    var cutoff = Date.now() - (days * 86400000);
    var items = [];
    state.features.forEach(function(f) {
      if ((f.status === 'idea' || f.status === 'planning') &&
          f.created_at && new Date(f.created_at).getTime() < cutoff) {
        items.push(Object.assign({ _type: 'feature' }, f));
      }
    });
    state.tasks.forEach(function(t) {
      if ((t.status === 'idea' || t.status === 'planning') &&
          t.created_at && new Date(t.created_at).getTime() < cutoff) {
        items.push(Object.assign({ _type: 'task' }, t));
      }
    });
    return items;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.Data = {
    state: state,
    init: init,
    getUser: getUser,
    signOut: signOut,
    loadAll: loadAll,
    loadProjects: loadProjects,
    loadFeatures: loadFeatures,
    loadTasks: loadTasks,
    loadTimeSessions: loadTimeSessions,
    loadTodayJournal: loadTodayJournal,
    saveProject: saveProject,
    archiveProject: archiveProject,
    reorderProjects: reorderProjects,
    saveFeature: saveFeature,
    archiveFeature: archiveFeature,
    saveTask: saveTask,
    archiveTask: archiveTask,
    saveTimeSession: saveTimeSession,
    deleteTimeSession: deleteTimeSession,
    saveJournal: saveJournal,
    projectTasks: projectTasks,
    projectFeatures: projectFeatures,
    activeProjects: activeProjects,
    todaySessions: todaySessions,
    totalMinutesToday: totalMinutesToday,
    staleItems: staleItems,
    on: on,
    emit: emit,
    toast: toast,
  };
})();
