/* ============================================================
   qualitative-time.js — Qualitative time / domain system
   Exposed on window.QTime
   ============================================================ */
(function () {
  'use strict';

  var DOMAINS = {
    saturday: {
      name:     'MULA',
      planet:   'Saturn',
      sanskrit: 'Shani',
      symbol:   '\u2644',       // ♄
      question: 'What does my body need right now?',
      energy:   'Structure, discipline, time. The root. Saturday strips things back to bone and stone \u2014 what remains when everything decorative is removed. This is the day to confront limits honestly, to build slow and solid, to honour the body as the first temple.',
      color:    'var(--domain-mula)',
    },
    sunday: {
      name:     'DHARMA',
      planet:   'Sun',
      sanskrit: 'Surya',
      symbol:   '\u2609',       // ☉
      question: 'What is this in service of?',
      energy:   'Purpose, will, illumination. Sunday is the axis \u2014 the day to reconnect with why you do any of this. Not productivity, but alignment. Let the light burn away what is not yours to carry.',
      color:    'var(--domain-dharma)',
    },
    monday: {
      name:     'SEVA',
      planet:   'Moon',
      sanskrit: 'Chandra',
      symbol:   '\u263D',       // ☽
      question: 'Who am I responsible to today?',
      energy:   'Nourishment, emotional intelligence. Monday is tidal \u2014 responsive, reflective. The work here is care: tending relationships, answering needs, showing up with softness and precision. Service as practice.',
      color:    'var(--domain-seva)',
    },
    tuesday: {
      name:     'KARMA',
      planet:   'Mars',
      sanskrit: 'Mangal',
      symbol:   '\u2642',       // ♂
      question: "What\u2019s the ONE thing?",
      energy:   'Energy, precision, will to act. Tuesday cuts. It is the day of the blade \u2014 single-pointed focus, the courage to commit fully to one thing and let the rest wait. Move fast, move clean.',
      color:    'var(--domain-karma)',
    },
    wednesday: {
      name:     'VIDYA',
      planet:   'Mercury',
      sanskrit: 'Budh',
      symbol:   '\u263F',       // ☿
      question: 'What am I learning right now?',
      energy:   'Intellect, speech, transmission. Wednesday is the messenger\u2019s day \u2014 move information, write, teach, learn. The mind is quick; let it be curious. Speak precisely. Listen twice.',
      color:    'var(--domain-vidya)',
    },
    thursday: {
      name:     'SANGHA',
      planet:   'Jupiter',
      sanskrit: 'Guru',
      symbol:   '\u2643',       // ♃
      question: "Who\u2019s with me?",
      energy:   'Growth, wisdom, expansion. Thursday is communal \u2014 the day to think bigger, to collaborate, to seek counsel. The guru principle: you grow fastest in the company of those who see further.',
      color:    'var(--domain-sangha)',
    },
    friday: {
      name:     'PREMA',
      planet:   'Venus',
      sanskrit: 'Shukra',
      symbol:   '\u2640',       // ♀
      question: 'Am I present, or just proximate?',
      energy:   'Love, beauty, sacred exchange. Friday softens the edges. It is the day to make things beautiful, to savour, to be fully present with what you love. Art, pleasure, and devotion are not indulgences \u2014 they are the point.',
      color:    'var(--domain-prema)',
    },
  };

  var MOKSHA = {
    name:     'MOKSHA',
    planet:   null,
    sanskrit: null,
    symbol:   '\u221E',         // ∞
    question: 'What can I release?',
    energy:   'The space between breaths. The eighth domain belongs to no day \u2014 it is the gap, the letting-go. Moksha is not something you do; it is what remains when you stop.',
    color:    'var(--domain-moksha)',
  };

  function today() {
    var dayName = Utils.getDayName();
    return DOMAINS[dayName] || MOKSHA;
  }

  function forDay(dayName) {
    if (!dayName) return MOKSHA;
    var key = dayName.toLowerCase();
    return DOMAINS[key] || MOKSHA;
  }

  /** Returns HTML string for the header qualitative-time display. */
  function renderHeader() {
    var domain = today();
    var id = 'qtime-expand-' + Date.now();

    return '' +
      '<div class="qtime-header">' +
        '<div class="qtime-summary" data-action="toggle-qtime" aria-expanded="false" aria-controls="' + id + '">' +
          '<span class="qtime-pip" style="background:' + domain.color + ';"></span>' +
          '<span class="qtime-domain">' + Utils.esc(domain.name) + '</span>' +
          '<span class="qtime-planet-symbol">' + Utils.esc(domain.symbol) + '</span>' +
          '<span class="qtime-planet-name">' + Utils.esc(domain.planet) + '</span>' +
          '<span class="qtime-day">' + Utils.esc(Utils.getDayName().charAt(0).toUpperCase() + Utils.getDayName().slice(1)) + '</span>' +
        '</div>' +
        '<div class="qtime-question text-tertiary">' + Utils.esc(domain.question) + '</div>' +
        '<div class="qtime-energy" id="' + id + '" hidden>' +
          '<p class="text-tertiary">' + Utils.esc(domain.energy) + '</p>' +
        '</div>' +
      '</div>';
  }

  /** Returns HTML for the print daily sheet header. */
  function renderPrintHeader() {
    var domain = today();
    var dayName = Utils.getDayName();
    var dateStr = Utils.formatDateFull(new Date());

    return '' +
      '<div class="print-qtime-header">' +
        '<div class="print-qtime-top">' +
          '<span class="print-qtime-domain" style="color:' + domain.color + ';">' + Utils.esc(domain.name) + '</span>' +
          '<span class="print-qtime-sanskrit">' + Utils.esc(domain.sanskrit) + '</span>' +
          '<span class="print-qtime-planet">' + Utils.esc(domain.symbol) + ' ' + Utils.esc(domain.planet) + '</span>' +
        '</div>' +
        '<div class="print-qtime-date">' + Utils.esc(dateStr) + '</div>' +
        '<div class="print-qtime-question">\u201C' + Utils.esc(domain.question) + '\u201D</div>' +
      '</div>';
  }

  /* ---- Expose ---- */
  window.QTime = {
    DOMAINS: DOMAINS,
    MOKSHA:  MOKSHA,
    today:   today,
    forDay:  forDay,
    renderHeader:      renderHeader,
    renderPrintHeader: renderPrintHeader,
  };
})();
