/* ============================================================
   data.js — Supabase data layer & local state
   Exposed on window.Data
   ============================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://reoliysifzxuzpskywtm.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_trmR_URy0KyDtDUfpgjOfg_owXvNPRI';

  var sb = null;  // Supabase client

  /* ---- Local state ---- */
  var state = {
    projects:     new Map(),
    features:     new Map(),
    tasks:        new Map(),
    timeSessions: [],
    user:         null,
  };

  /* ---- Event bus ---- */
  var _listeners = {};

  function on(event, cb) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(cb);
  }

  function emit(event, data) {
    var cbs = _listeners[event];
    if (!cbs) return;
    for (var i = 0; i < cbs.length; i++) {
      try { cbs[i](data); } catch (err) { console.error('Data event handler error:', err); }
    }
  }

  /* ---- Init ---- */
  async function init() {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    var { data: sessionData, error: sessionErr } = await sb.auth.getSession();
    if (sessionErr || !sessionData.session) {
      window.location.href = 'login.html';
      return;
    }
    state.user = sessionData.session.user;

    await loadAll();
    emit('loaded');
  }

  /* ---- Load functions ---- */

  async function loadAll() {
    await Promise.all([
      loadProjects(),
      loadFeatures(),
      loadTasks(),
      loadTimeSessions(),
    ]);
  }

  async function loadProjects() {
    var { data, error } = await sb
      .from('projects')
      .select('*')
      .eq('is_archived', false)
      .order('name');
    if (error) { console.error('loadProjects:', error); return; }
    state.projects = new Map();
    for (var i = 0; i < data.length; i++) {
      state.projects.set(data[i].id, data[i]);
    }
  }

  async function loadFeatures() {
    var { data, error } = await sb
      .from('features')
      .select('*')
      .eq('is_archived', false)
      .order('sort_order');
    if (error) { console.error('loadFeatures:', error); return; }
    state.features = new Map();
    for (var i = 0; i < data.length; i++) {
      state.features.set(data[i].id, data[i]);
    }
  }

  async function loadTasks() {
    var { data, error } = await sb
      .from('tasks')
      .select('*')
      .eq('is_archived', false)
      .order('sort_order')
      .order('created_at', { ascending: false });
    if (error) { console.error('loadTasks:', error); return; }
    state.tasks = new Map();
    for (var i = 0; i < data.length; i++) {
      state.tasks.set(data[i].id, data[i]);
    }
  }

  async function loadTimeSessions() {
    var { data, error } = await sb
      .from('time_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);
    if (error) { console.error('loadTimeSessions:', error); return; }
    state.timeSessions = data || [];
  }

  /* ---- CRUD: Projects ---- */

  async function saveProject(obj, id) {
    try {
      // If status is done or integrated, set completed_at if not already set
      if ((obj.status === 'done' || obj.status === 'integrated') && !obj.completed_at) {
        obj.completed_at = new Date().toISOString();
      }

      var result;
      if (id) {
        obj.updated_at = new Date().toISOString();
        result = await sb.from('projects').update(obj).eq('id', id).select().single();
      } else {
        result = await sb.from('projects').insert(obj).select().single();
      }
      if (result.error) throw result.error;
      var saved = result.data;
      state.projects.set(saved.id, saved);
      emit('projectChanged', saved);
      return saved;
    } catch (err) {
      console.error('saveProject:', err);
      return null;
    }
  }

  async function archiveProject(id) {
    try {
      var { error } = await sb.from('projects').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      state.projects.delete(id);
      emit('projectChanged', { id: id, archived: true });
      return true;
    } catch (err) {
      console.error('archiveProject:', err);
      return null;
    }
  }

  /* ---- CRUD: Features ---- */

  async function saveFeature(obj, id) {
    try {
      if ((obj.status === 'done' || obj.status === 'integrated') && !obj.completed_at) {
        obj.completed_at = new Date().toISOString();
      }

      var result;
      if (id) {
        obj.updated_at = new Date().toISOString();
        result = await sb.from('features').update(obj).eq('id', id).select().single();
      } else {
        result = await sb.from('features').insert(obj).select().single();
      }
      if (result.error) throw result.error;
      var saved = result.data;
      state.features.set(saved.id, saved);
      emit('featureChanged', saved);
      return saved;
    } catch (err) {
      console.error('saveFeature:', err);
      return null;
    }
  }

  async function archiveFeature(id) {
    try {
      var { error } = await sb.from('features').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      state.features.delete(id);
      emit('featureChanged', { id: id, archived: true });
      return true;
    } catch (err) {
      console.error('archiveFeature:', err);
      return null;
    }
  }

  /* ---- CRUD: Tasks ---- */

  async function saveTask(obj, id) {
    try {
      if ((obj.status === 'done' || obj.status === 'integrated') && !obj.completed_at) {
        obj.completed_at = new Date().toISOString();
      }

      var result;
      if (id) {
        obj.updated_at = new Date().toISOString();
        result = await sb.from('tasks').update(obj).eq('id', id).select().single();
      } else {
        result = await sb.from('tasks').insert(obj).select().single();
      }
      if (result.error) throw result.error;
      var saved = result.data;
      state.tasks.set(saved.id, saved);
      emit('taskChanged', saved);
      return saved;
    } catch (err) {
      console.error('saveTask:', err);
      return null;
    }
  }

  async function archiveTask(id) {
    try {
      var { error } = await sb.from('tasks').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      state.tasks.delete(id);
      emit('taskChanged', { id: id, archived: true });
      return true;
    } catch (err) {
      console.error('archiveTask:', err);
      return null;
    }
  }

  /* ---- CRUD: Time Sessions ---- */

  async function saveTimeSession(obj) {
    try {
      var result = await sb.from('time_sessions').insert(obj).select().single();
      if (result.error) throw result.error;
      var saved = result.data;
      state.timeSessions.unshift(saved);
      emit('timeSessionChanged', saved);
      return saved;
    } catch (err) {
      console.error('saveTimeSession:', err);
      return null;
    }
  }

  async function deleteTimeSession(id) {
    try {
      var { error } = await sb.from('time_sessions').delete().eq('id', id);
      if (error) throw error;
      state.timeSessions = state.timeSessions.filter(function (s) { return s.id !== id; });
      emit('timeSessionChanged', { id: id, deleted: true });
      return true;
    } catch (err) {
      console.error('deleteTimeSession:', err);
      return null;
    }
  }

  /* ---- Query helpers (local state, no network) ---- */

  function projectFeatures(projectId) {
    var out = [];
    state.features.forEach(function (f) {
      if (f.project_id === projectId) out.push(f);
    });
    out.sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
    return out;
  }

  function featureTasks(featureId) {
    var out = [];
    state.tasks.forEach(function (t) {
      if (t.feature_id === featureId) out.push(t);
    });
    out.sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
    return out;
  }

  function projectTasks(projectId) {
    var out = [];
    state.tasks.forEach(function (t) {
      if (t.project_id === projectId && !t.feature_id) out.push(t);
    });
    out.sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
    return out;
  }

  function activeProjects() {
    var out = [];
    state.projects.forEach(function (p) {
      if (p.status !== 'done' && p.status !== 'integrated' && p.status !== 'archived') {
        out.push(p);
      }
    });
    out.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    return out;
  }

  function thisWeekItems() {
    var monday = Utils.isoWeek(new Date());
    var items = [];
    state.features.forEach(function (f) {
      if (f.target_week === monday) items.push(Object.assign({ _type: 'feature' }, f));
    });
    state.tasks.forEach(function (t) {
      if (t.target_week === monday) items.push(Object.assign({ _type: 'task' }, t));
    });
    return items;
  }

  function staleItems(days) {
    var out = [];
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    var cutoffMs = cutoff.getTime();

    state.tasks.forEach(function (t) {
      if (t.status === 'idea' && new Date(t.created_at).getTime() < cutoffMs) {
        out.push(Object.assign({ _type: 'task' }, t));
      }
    });
    state.features.forEach(function (f) {
      if (f.status === 'idea' && new Date(f.created_at).getTime() < cutoffMs) {
        out.push(Object.assign({ _type: 'feature' }, f));
      }
    });
    return out;
  }

  function todaysSessions() {
    var todayStr = Utils.isoDate(new Date());
    return state.timeSessions.filter(function (s) {
      return s.started_at && s.started_at.slice(0, 10) === todayStr;
    });
  }

  function totalMinutesToday() {
    var sessions = todaysSessions();
    var total = 0;
    for (var i = 0; i < sessions.length; i++) {
      total += (sessions[i].duration_min || 0);
    }
    return total;
  }

  function featuresByStatus(projectId, statusGroup) {
    var feats = projectFeatures(projectId);
    return feats.filter(function (f) {
      if (statusGroup === 'built')  return f.status === 'done' || f.status === 'integrated';
      if (statusGroup === 'active') return f.status === 'scheduled' || f.status === 'building';
      if (statusGroup === 'todo')   return f.status === 'idea' || f.status === 'planning';
      return false;
    });
  }

  /* ---- Auth ---- */

  async function signOut() {
    if (sb) await sb.auth.signOut();
    window.location.href = 'login.html';
  }

  function getUser() {
    return state.user;
  }

  /* ---- Expose ---- */
  window.Data = {
    state:  state,
    init:   init,
    on:     on,
    emit:   emit,

    loadAll:          loadAll,
    loadProjects:     loadProjects,
    loadFeatures:     loadFeatures,
    loadTasks:        loadTasks,
    loadTimeSessions: loadTimeSessions,

    saveProject:      saveProject,
    archiveProject:   archiveProject,
    saveFeature:      saveFeature,
    archiveFeature:   archiveFeature,
    saveTask:         saveTask,
    archiveTask:      archiveTask,
    saveTimeSession:  saveTimeSession,
    deleteTimeSession: deleteTimeSession,

    projectFeatures:  projectFeatures,
    featureTasks:     featureTasks,
    projectTasks:     projectTasks,
    activeProjects:   activeProjects,
    thisWeekItems:    thisWeekItems,
    staleItems:       staleItems,
    todaysSessions:   todaysSessions,
    totalMinutesToday: totalMinutesToday,
    featuresByStatus: featuresByStatus,

    signOut: signOut,
    getUser: getUser,
  };
})();
