/* VS Media — Speed Ramp Tool · main.js */

var cs = new CSInterface();

// ── State ────────────────────────────────────────────────────
var marks      = [];   // [{ t: seconds, id: unique }]
var markId     = 0;
var layerIndex = -1;   // selected layer index in AE (1-based)
var fps        = 25;   // comp framerate (updated on refresh)

// ── Helpers ──────────────────────────────────────────────────
function status(msg, type) {
  var bar = document.getElementById('statusBar');
  bar.textContent = msg;
  bar.className = 'status-bar' + (type ? ' ' + type : '');
}

function evalScript(script, cb) {
  cs.evalScript(script, function(result) {
    if (result === 'EvalScript error.') {
      status('Erro no script.', 'error');
      if (cb) cb(null);
      return;
    }
    if (cb) cb(result);
  });
}

/** Converte segundos para timecode HH:MM:SS:FF */
function toTC(secs) {
  var f   = fps || 25;
  var s   = Math.floor(secs);
  var fr  = Math.round((secs - s) * f);
  var hh  = Math.floor(s / 3600);
  var mm  = Math.floor((s % 3600) / 60);
  var ss  = s % 60;
  return pad(hh) + ':' + pad(mm) + ':' + pad(ss) + ':' + pad(fr);
}

function pad(n) { return n < 10 ? '0' + n : String(n); }

function sliderDurToSecs(v) { return (parseInt(v) / 10).toFixed(1); }

// ── Refresh layer info ────────────────────────────────────────
function refreshLayer() {
  evalScript('getLayerInfo()', function(result) {
    if (!result || result.indexOf('error:') === 0) {
      layerIndex = -1;
      document.getElementById('layerDot').classList.remove('active');
      document.getElementById('layerName').textContent = 'Nenhum layer seleccionado';
      document.getElementById('btnMark').disabled = true;
      updateApplyBtn();
      return;
    }
    try {
      var info = JSON.parse(result);
      layerIndex = info.index;
      fps        = info.fps || 25;
      document.getElementById('layerDot').classList.add('active');
      document.getElementById('layerName').textContent = info.name;
      document.getElementById('btnMark').disabled = false;
      status('Layer: ' + info.name, 'ok');
      updateApplyBtn();
    } catch (e) {
      status('Erro ao ler layer.', 'error');
    }
  });
}

// ── Marks list render ─────────────────────────────────────────
function renderMarks() {
  var list  = document.getElementById('marksList');
  var empty = document.getElementById('marksEmpty');

  if (!marks.length) {
    list.innerHTML = '';
    list.appendChild(empty);
    updateApplyBtn();
    return;
  }

  // Sort by time
  marks.sort(function(a, b) { return a.t - b.t; });

  list.innerHTML = '';
  for (var i = 0; i < marks.length; i++) {
    var m   = marks[i];
    var div = document.createElement('div');
    div.className = 'mark-item';
    div.innerHTML =
      '<span class="mark-num">' + (i + 1) + '</span>' +
      '<span class="mark-dot"></span>' +
      '<span class="mark-tc">' + toTC(m.t) + '</span>' +
      '<button class="mark-remove" data-id="' + m.id + '" title="Remover">×</button>';
    list.appendChild(div);
  }

  // Remove buttons
  var btns = list.querySelectorAll('.mark-remove');
  for (var j = 0; j < btns.length; j++) {
    btns[j].addEventListener('click', function() {
      removeMark(parseInt(this.getAttribute('data-id')));
    });
  }

  updateApplyBtn();
}

function removeMark(id) {
  marks = marks.filter(function(m) { return m.id !== id; });
  renderMarks();
}

function updateApplyBtn() {
  var ok = layerIndex > 0 && marks.length > 0;
  document.getElementById('btnApply').disabled  = !ok;
  document.getElementById('applyHint').textContent = ok
    ? marks.length + ' ponto(s) marcado(s) — pronto para aplicar.'
    : 'Selecciona um layer e marca pelo menos 1 ponto.';
}

// ── Slider bindings ───────────────────────────────────────────
function bindSlider(id, valId, fmt) {
  var s = document.getElementById(id);
  var v = document.getElementById(valId);
  s.addEventListener('input', function() {
    v.textContent = fmt(this.value);
  });
}

bindSlider('sliderFast', 'valFast', function(v){ return v + '%'; });
bindSlider('sliderDur',  'valDur',  function(v){ return sliderDurToSecs(v) + 's'; });
bindSlider('sliderEase', 'valEase', function(v){ return v + '%'; });

// ── Mark current time ─────────────────────────────────────────
document.getElementById('btnMark').addEventListener('click', function() {
  evalScript('getCurrentTime()', function(result) {
    if (!result || result === 'null') {
      status('Sem comp activa ou layer seleccionado.', 'error');
      return;
    }
    var t = parseFloat(result);
    if (isNaN(t)) { status('Não foi possível ler o tempo actual.', 'error'); return; }

    // Prevent duplicates within 0.1s
    for (var i = 0; i < marks.length; i++) {
      if (Math.abs(marks[i].t - t) < 0.1) {
        status('Ponto já marcado neste tempo.', 'info');
        return;
      }
    }

    marks.push({ t: t, id: ++markId });
    renderMarks();
    status('Marcado: ' + toTC(t), 'ok');
  });
});

// ── Clear all ─────────────────────────────────────────────────
document.getElementById('btnClearAll').addEventListener('click', function() {
  marks = [];
  renderMarks();
  status('Pontos apagados.', 'info');
});

// ── Refresh layer ─────────────────────────────────────────────
document.getElementById('btnRefresh').addEventListener('click', refreshLayer);

// ── Apply ─────────────────────────────────────────────────────
document.getElementById('btnApply').addEventListener('click', function() {
  if (layerIndex < 1 || !marks.length) return;

  status('A aplicar speed ramps...', 'info');

  var params = {
    fastPct:   parseInt(document.getElementById('sliderFast').value),
    zoneDur:   parseFloat(sliderDurToSecs(document.getElementById('sliderDur').value)),
    influence: parseInt(document.getElementById('sliderEase').value)
  };

  var timesJSON  = JSON.stringify(marks.map(function(m){ return m.t; }));
  var paramsJSON = JSON.stringify(params);
  var script     = 'applySpeedRamps(' + layerIndex + ',' + JSON.stringify(timesJSON) + ',' + JSON.stringify(paramsJSON) + ')';

  evalScript(script, function(result) {
    if (result === 'ok') {
      status('Speed ramps aplicados com sucesso!', 'ok');
    } else {
      status(result || 'Erro desconhecido.', 'error');
    }
  });
});

// ── Load scripts & init ───────────────────────────────────────
function init() {
  var extPath = cs.getSystemPath(SystemPath.EXTENSION);
  cs.evalScript('$.evalFile("' + extPath + '/scripts/aftereffects.jsx")', function() {
    refreshLayer();
  });

  document.getElementById('btnMark').disabled = true;
  renderMarks();
}

init();
