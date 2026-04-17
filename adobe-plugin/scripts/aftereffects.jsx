/* ============================================================
   VS Media — Speed Ramp Tool · aftereffects.jsx

   Lógica:
   - O utilizador marca pontos de "slow" no painel
   - Cada ponto torna-se uma zona de slow motion centrada nesse tempo
   - Entre zonas slow: vídeo corre a fastPct%
   - Nas zonas slow: vídeo corre a slowPct%
   - Transições com curvas bezier (KeyframeEase)
   ============================================================ */

// ── Utilitários ──────────────────────────────────────────────

function getActiveComp() {
  var item = app.project.activeItem;
  return (item instanceof CompItem) ? item : null;
}

/** Devolve o primeiro layer seleccionado na comp activa */
function getFirstSelectedLayer(comp) {
  for (var i = 1; i <= comp.numLayers; i++) {
    if (comp.layer(i).selected) return comp.layer(i);
  }
  return null;
}

// ── getLayerInfo ─────────────────────────────────────────────
/**
 * Chamado pelo painel para detectar o layer e fps activos.
 * @returns {string} JSON com { index, name, fps } ou "error:..."
 */
function getLayerInfo() {
  var comp = getActiveComp();
  if (!comp) return 'error:no_comp';

  var layer = getFirstSelectedLayer(comp);
  if (!layer) return 'error:no_layer';

  return JSON.stringify({
    index: layer.index,
    name:  layer.name,
    fps:   comp.frameRate
  });
}

// ── getCurrentTime ────────────────────────────────────────────
/**
 * Devolve o tempo actual do CTI (Current Time Indicator) em segundos.
 */
function getCurrentTime() {
  var comp = getActiveComp();
  if (!comp) return 'null';
  return String(comp.time);
}

// ── applySpeedRamps ───────────────────────────────────────────
/**
 * Aplica speed ramps a um layer via Time Remapping.
 *
 * Algoritmo:
 *   1. Ordena os pontos marcados por tempo
 *   2. Constrói segmentos: [fast | slow | fast | slow | ...]
 *   3. Para cada segmento calcula o source time acumulado
 *      (slow avança pouco, fast avança rápido)
 *   4. Cria keyframes com curvas bezier nas transições
 *
 * @param {number} layerIdx    Índice do layer (1-based)
 * @param {string} timesJSON   JSON array de comp times (segundos) ex: "[2.5, 5.0, 8.3]"
 * @param {string} paramsJSON  JSON com { slowPct, fastPct, slowDur, influence }
 * @returns {string} "ok" ou mensagem de erro
 */
function applySpeedRamps(layerIdx, timesJSON, paramsJSON) {
  try {
    var comp = getActiveComp();
    if (!comp) return 'Sem comp activa.';

    var layer = comp.layer(parseInt(layerIdx));
    if (!layer) return 'Layer não encontrado (idx=' + layerIdx + ').';
    if (!(layer instanceof AVLayer)) return 'O layer não é de vídeo/audio.';

    var times  = JSON.parse(timesJSON);   // array de números (segundos)
    var p      = JSON.parse(paramsJSON);  // { slowPct, fastPct, slowDur, influence }

    if (!times.length) return 'Nenhum ponto marcado.';

    times.sort(function(a, b) { return a - b; });

    var slowF  = p.slowPct / 100;  // ex: 0.20
    var fastF  = p.fastPct / 100;  // ex: 1.00
    var hSlow  = p.slowDur / 2;    // metade da duração da zona slow
    var infl   = p.influence;      // 10–90

    var layerIn  = layer.inPoint;
    var layerOut = layer.outPoint;
    var srcDur   = (layer.source && layer.source.duration)
                     ? layer.source.duration
                     : (layerOut - layerIn);

    // ── Construir zonas ───────────────────────────────────────
    // Cada zona: { start, end, speed }
    // Começamos por criar as zonas slow e preenchemos com fast.
    var rawZones = [];
    for (var i = 0; i < times.length; i++) {
      var s = Math.max(layerIn, times[i] - hSlow);
      var e = Math.min(layerOut, times[i] + hSlow);
      if (s < e) rawZones.push({ start: s, end: e });
    }

    // Fundir zonas que se sobrepõem
    rawZones.sort(function(a, b) { return a.start - b.start; });
    var merged = [];
    for (var j = 0; j < rawZones.length; j++) {
      var cur = rawZones[j];
      if (merged.length && cur.start <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, cur.end);
      } else {
        merged.push({ start: cur.start, end: cur.end });
      }
    }

    // Construir sequência final de segmentos
    var segments = [];
    var cursor   = layerIn;
    for (var k = 0; k < merged.length; k++) {
      var zone = merged[k];
      if (cursor < zone.start) {
        segments.push({ start: cursor, end: zone.start, speed: fastF });
      }
      segments.push({ start: zone.start, end: zone.end, speed: slowF });
      cursor = zone.end;
    }
    if (cursor < layerOut) {
      segments.push({ start: cursor, end: layerOut, speed: fastF });
    }

    // ── Calcular source times em cada boundary ────────────────
    // kfPoints: { compT, srcT, speedIn, speedOut }
    var kfPoints = [];
    var srcAccum = 0;

    // Primeiro ponto
    kfPoints.push({
      compT:    layerIn,
      srcT:     0,
      speedIn:  segments[0].speed,
      speedOut: segments[0].speed
    });

    for (var s2 = 0; s2 < segments.length; s2++) {
      var seg = segments[s2];
      var dt  = seg.end - seg.start;
      srcAccum += dt * seg.speed;

      // Velocidade depois deste ponto
      var nextSpeed = (s2 + 1 < segments.length) ? segments[s2 + 1].speed : seg.speed;

      kfPoints.push({
        compT:    seg.end,
        srcT:     Math.min(srcAccum, srcDur),
        speedIn:  seg.speed,
        speedOut: nextSpeed
      });
    }

    // ── Aplicar Time Remapping ────────────────────────────────
    app.beginUndoGroup('VS Media Speed Ramps');

    layer.timeRemapEnabled = true;
    var tr = layer.property('ADBE Time Remapping');

    // Apagar keyframes existentes
    while (tr.numKeys > 0) {
      tr.removeKey(1);
    }

    // Criar novos keyframes
    for (var n = 0; n < kfPoints.length; n++) {
      var kf  = kfPoints[n];
      var idx = tr.addKey(kf.compT);
      tr.setValueAtKey(idx, kf.srcT);

      // Interpolação bezier
      tr.setInterpolationTypeAtKey(
        idx,
        KeyframeInterpolationType.BEZIER,
        KeyframeInterpolationType.BEZIER
      );

      // Ease: speed = velocidade local (src units/sec), influence = tensão bezier
      var eIn  = [new KeyframeEase(kf.speedIn,  infl)];
      var eOut = [new KeyframeEase(kf.speedOut, infl)];
      tr.setTemporalEaseAtKey(idx, eIn, eOut);
    }

    app.endUndoGroup();
    return 'ok';

  } catch (e) {
    try { app.endUndoGroup(); } catch(_) {}
    return 'Erro: ' + e.message;
  }
}
