/* ============================================================
   VS Media Real Estate Plugin — main.js
   Communicates between the HTML panel and ExtendScript via
   CSInterface. Works in both Premiere Pro and After Effects.
   ============================================================ */

var cs = new CSInterface();

// ── State ────────────────────────────────────────────────────
var state = {
  app:       null,   // 'PPRO' or 'AEFT'
  lutPath:   '',     // path to Sony S-Log3 LUT
  mogrtPath: ''      // path to subtitle .mogrt template
};

// ── Helpers ──────────────────────────────────────────────────
function status(msg, type) {
  var bar = document.getElementById('statusBar');
  bar.textContent = msg;
  bar.className = 'status-bar' + (type ? ' ' + type : '');
}

function evalScript(script, cb) {
  cs.evalScript(script, function(result) {
    if (result === 'EvalScript error.') {
      status('Erro no script: ' + script.substring(0, 60), 'error');
    }
    if (cb) cb(result);
  });
}

function loadScript(path) {
  cs.evalScript('$.evalFile("' + path + '")');
}

function getExtensionPath() {
  return cs.getSystemPath(SystemPath.EXTENSION);
}

// ── Init ─────────────────────────────────────────────────────
function init() {
  var appName = cs.getHostEnvironment().appName;

  if (appName.indexOf('PPRO') !== -1 || appName === 'Adobe Premiere Pro') {
    state.app = 'PPRO';
    document.getElementById('appBadge').textContent = '● Premiere Pro';
    document.getElementById('appBadge').classList.add('premiere');
    document.getElementById('sectionSpeedRamp').style.opacity = '0.4';
    document.getElementById('sectionSpeedRamp').style.pointerEvents = 'none';
    document.getElementById('sectionLegendas').style.opacity = '1';
  } else {
    state.app = 'AEFT';
    document.getElementById('appBadge').textContent = '● After Effects';
    document.getElementById('appBadge').classList.add('aftereffects');
    document.getElementById('sectionLegendas').style.opacity = '0.4';
    document.getElementById('sectionLegendas').style.pointerEvents = 'none';
  }

  // Load scripts
  var extPath = getExtensionPath();
  if (state.app === 'PPRO') {
    loadScript(extPath + '/scripts/premiere.jsx');
  } else {
    loadScript(extPath + '/scripts/aftereffects.jsx');
  }

  // Default LUT path (Sony official — user can override)
  state.lutPath = extPath + '/luts/S-Gamut3.Cine_SLog3_To_LC-709.cube';
  document.getElementById('lutLabel').textContent = 'Sony S-Log3 → LC-709 (A7C II)';

  status('Pronto. App: ' + (state.app === 'PPRO' ? 'Premiere Pro' : 'After Effects'));
}

// ── Slider live values ────────────────────────────────────────
function bindSlider(id, valId, transform) {
  var slider = document.getElementById(id);
  var val    = document.getElementById(valId);
  slider.addEventListener('input', function() {
    val.textContent = transform ? transform(this.value) : this.value;
  });
}

bindSlider('sliderTemp',      'valTemp',      function(v){ return (v > 0 ? '+' : '') + v; });
bindSlider('sliderContrast',  'valContrast',  function(v){ return (v > 0 ? '+' : '') + v; });
bindSlider('sliderHighlights','valHighlights',function(v){ return (v > 0 ? '+' : '') + v; });
bindSlider('sliderShadows',   'valShadows',   function(v){ return (v > 0 ? '+' : '') + v; });
bindSlider('sliderSat',       'valSat',       function(v){ return v; });
bindSlider('sliderPeak',      'valPeak',      function(v){ return v + '%'; });
bindSlider('sliderRampIn',    'valRampIn',    function(v){ return (v/100).toFixed(2) + 's'; });
bindSlider('sliderRampOut',   'valRampOut',   function(v){ return (v/100).toFixed(2) + 's'; });
bindSlider('sliderBitrate',   'valBitrate',   function(v){ return v; });
bindSlider('sliderSubPos',    'valSubPos',    function(v){ return v + '%'; });

// ── Browse LUT ────────────────────────────────────────────────
document.getElementById('btnBrowseLut').addEventListener('click', function() {
  var result = window.cep.fs.showOpenDialogEx(
    false, false, 'Seleccionar LUT Sony S-Log3',
    '', [{ name: 'LUT Files', extensions: ['cube', '3dl'] }]
  );
  if (result && result.data && result.data.length) {
    state.lutPath = result.data[0];
    var parts = state.lutPath.split(/[\\/]/);
    document.getElementById('lutLabel').textContent = parts[parts.length - 1];
    status('LUT carregado: ' + parts[parts.length - 1], 'ok');
  }
});

// ── Browse MOGRT ──────────────────────────────────────────────
document.getElementById('btnBrowseMogrt').addEventListener('click', function() {
  var result = window.cep.fs.showOpenDialogEx(
    false, false, 'Seleccionar Template de Legendas',
    '', [{ name: 'Motion Graphics Template', extensions: ['mogrt'] }]
  );
  if (result && result.data && result.data.length) {
    state.mogrtPath = result.data[0];
    var parts = state.mogrtPath.split(/[\\/]/);
    document.getElementById('mogrtLabel').textContent = parts[parts.length - 1];
    status('Template carregado: ' + parts[parts.length - 1], 'ok');
  }
});

// ── Apply LUT ─────────────────────────────────────────────────
document.getElementById('btnApplyLut').addEventListener('click', function() {
  if (!state.lutPath) { status('Nenhum LUT seleccionado.', 'error'); return; }
  status('A aplicar LUT...', 'info');

  var script = state.app === 'PPRO'
    ? 'applyLutPremiere("' + state.lutPath.replace(/\\/g, '/') + '")'
    : 'applyLutAE("' + state.lutPath.replace(/\\/g, '/') + '")';

  evalScript(script, function(result) {
    if (result && result !== 'EvalScript error.') {
      status('LUT aplicado a ' + result + ' clip(s).', 'ok');
    }
  });
});

// ── Apply Grade ───────────────────────────────────────────────
document.getElementById('btnApplyGrade').addEventListener('click', function() {
  status('A aplicar color grade...', 'info');

  var params = {
    temp:       parseInt(document.getElementById('sliderTemp').value),
    contrast:   parseInt(document.getElementById('sliderContrast').value),
    highlights: parseInt(document.getElementById('sliderHighlights').value),
    shadows:    parseInt(document.getElementById('sliderShadows').value),
    saturation: parseInt(document.getElementById('sliderSat').value)
  };

  var script = state.app === 'PPRO'
    ? 'applyGradePremiere(' + JSON.stringify(params) + ')'
    : 'applyGradeAE(' + JSON.stringify(params) + ')';

  evalScript(script, function(result) {
    if (result && result !== 'EvalScript error.') {
      status('Color grade aplicado.', 'ok');
    }
  });
});

// ── Apply Speed Ramp (AE only) ────────────────────────────────
document.getElementById('btnApplySpeedRamp').addEventListener('click', function() {
  if (state.app !== 'AEFT') { status('Speed Ramp só disponível no After Effects.', 'error'); return; }

  status('A aplicar speed ramp...', 'info');

  var rampType  = document.querySelector('input[name="rampType"]:checked').value;
  var peakSpeed = parseInt(document.getElementById('sliderPeak').value) / 100;
  var rampIn    = parseInt(document.getElementById('sliderRampIn').value)  / 100;
  var rampOut   = parseInt(document.getElementById('sliderRampOut').value) / 100;

  var script = 'applySpeedRamp("' + rampType + '",' + peakSpeed + ',' + rampIn + ',' + rampOut + ')';

  evalScript(script, function(result) {
    if (result === 'ok') {
      status('Speed ramp aplicado com sucesso.', 'ok');
    } else if (result) {
      status(result, 'error');
    }
  });
});

// ── Apply Subtitles (Premiere only) ──────────────────────────
document.getElementById('btnApplySubtitles').addEventListener('click', function() {
  if (state.app !== 'PPRO') { status('Legendas disponíveis no Premiere Pro.', 'error'); return; }
  if (!state.mogrtPath) { status('Carrega um template .mogrt primeiro.', 'error'); return; }

  status('A aplicar template de legendas...', 'info');

  var yPos = parseInt(document.getElementById('sliderSubPos').value);
  var script = 'applySubtitleTemplate("' + state.mogrtPath.replace(/\\/g, '/') + '",' + yPos + ')';

  evalScript(script, function(result) {
    if (result === 'ok') {
      status('Template de legendas aplicado.', 'ok');
    } else if (result) {
      status(result, 'error');
    }
  });
});

// ── Export ────────────────────────────────────────────────────
document.getElementById('btnExport').addEventListener('click', function() {
  if (state.app !== 'PPRO') { status('Export disponível no Premiere Pro.', 'error'); return; }

  status('A enviar para Media Encoder...', 'info');

  var bitrate = parseInt(document.getElementById('sliderBitrate').value);
  var script  = 'exportH264_4K(' + bitrate + ')';

  evalScript(script, function(result) {
    if (result === 'ok') {
      status('Adicionado ao Media Encoder. Verifica a fila.', 'ok');
    } else if (result) {
      status(result, 'error');
    }
  });
});

// ── Start ─────────────────────────────────────────────────────
init();
