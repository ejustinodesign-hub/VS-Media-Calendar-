/* ============================================================
   VS Media — Speed Ramp Tool · aftereffects.jsx

   Lógica:
   - Secções entre pontos marcados: vídeo avança a fastPct%
     com curvas bezier na entrada/saída de cada zona
   - Nas zonas marcadas (~1s): keyframes HOLD a 12fps
     (cada frame de source fica visível por 1/12 segundo —
      cria o efeito "choppy" característico)
   - Transições: KeyframeEase com influence configurável
   ============================================================ */

function getActiveComp() {
  var item = app.project.activeItem;
  return (item instanceof CompItem) ? item : null;
}

function getFirstSelectedLayer(comp) {
  for (var i = 1; i <= comp.numLayers; i++) {
    if (comp.layer(i).selected) return comp.layer(i);
  }
  return null;
}

// ── getLayerInfo ─────────────────────────────────────────────
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
function getCurrentTime() {
  var comp = getActiveComp();
  if (!comp) return 'null';
  return String(comp.time);
}

// ── applySpeedRamps ───────────────────────────────────────────
/**
 * Aplica speed ramps a um layer:
 *   - Secções rápidas entre zonas: avança a fastPct% com bezier
 *   - Zonas marcadas: HOLD keyframes a 12fps (choppy)
 *   - Bezier nas transições rápido ↔ 12fps
 *
 * @param {number} layerIdx    Índice do layer (1-based)
 * @param {string} timesJSON   JSON array de comp times (segundos)
 * @param {string} paramsJSON  JSON { fastPct, zoneDur, influence }
 */
function applySpeedRamps(layerIdx, timesJSON, paramsJSON) {
  try {
    var comp = getActiveComp();
    if (!comp) return 'Sem comp activa.';

    var layer = comp.layer(parseInt(layerIdx));
    if (!layer) return 'Layer não encontrado.';
    if (!(layer instanceof AVLayer)) return 'O layer não é de vídeo.';

    var markTimes = JSON.parse(timesJSON);
    var p         = JSON.parse(paramsJSON);

    if (!markTimes.length) return 'Nenhum ponto marcado.';

    markTimes.sort(function(a, b) { return a - b; });

    var fastF  = p.fastPct  / 100;  // ex: 2.0 para 200%
    var fps12  = 12;
    var step   = 1 / fps12;         // 0.0833s por frame a 12fps
    var hZone  = p.zoneDur  / 2;    // meia duração da zona
    var infl   = p.influence;

    var layerIn  = layer.inPoint;
    var layerOut = layer.outPoint;
    var srcDur   = (layer.source && layer.source.duration)
                     ? layer.source.duration
                     : (layerOut - layerIn);

    // ── 1. Construir e fundir zonas 12fps ─────────────────────
    var rawZones = [];
    for (var i = 0; i < markTimes.length; i++) {
      var zs = Math.max(layerIn,  markTimes[i] - hZone);
      var ze = Math.min(layerOut, markTimes[i] + hZone);
      if (zs < ze) rawZones.push({ start: zs, end: ze });
    }
    rawZones.sort(function(a, b) { return a.start - b.start; });

    var zones = [];
    for (var j = 0; j < rawZones.length; j++) {
      var z = rawZones[j];
      if (zones.length && z.start <= zones[zones.length - 1].end) {
        zones[zones.length - 1].end = Math.max(zones[zones.length - 1].end, z.end);
      } else {
        zones.push({ start: z.start, end: z.end });
      }
    }

    // ── 2. Activar Time Remapping e limpar keyframes ───────────
    app.beginUndoGroup('VS Media Speed Ramps');
    layer.timeRemapEnabled = true;
    var tr = layer.property('ADBE Time Remapping');
    while (tr.numKeys > 0) tr.removeKey(1);

    // ── 3. Construir lista de keyframes ───────────────────────
    // Cada entrada: { compT, srcT, interp:'bezier'|'hold', speedIn, speedOut }
    var kfs = [];
    var srcAccum = 0;
    var cursor   = layerIn;

    function pushBezier(compT, srcT, speedIn, speedOut) {
      kfs.push({
        compT:    compT,
        srcT:     Math.min(srcT, srcDur),
        interp:   'bezier',
        speedIn:  speedIn,
        speedOut: speedOut
      });
    }
    function pushHold(compT, srcT) {
      kfs.push({ compT: compT, srcT: Math.min(srcT, srcDur), interp: 'hold' });
    }

    // Keyframe inicial
    var openSpeed = (zones.length && zones[0].start === layerIn) ? 1.0 : fastF;
    pushBezier(layerIn, 0, openSpeed, openSpeed);

    for (var k = 0; k < zones.length; k++) {
      var zone = zones[k];

      // Secção rápida antes da zona
      if (cursor < zone.start) {
        srcAccum += (zone.start - cursor) * fastF;
        pushBezier(zone.start, srcAccum, fastF, 1.0);
        cursor = zone.start;
      }

      // Zona 12fps: HOLD keyframes a cada 1/12s
      var t = cursor;
      while (t + step <= zone.end) {
        t        += step;
        srcAccum += step;
        pushHold(t, srcAccum);
      }
      // Resto fraccionário até zone.end (se não cai exactamente em múltiplo de 1/12)
      if (t < zone.end) {
        srcAccum += (zone.end - t);
      }

      // Bezier de saída da zona
      var nextSpeed = (k + 1 < zones.length || zone.end < layerOut) ? fastF : 1.0;
      pushBezier(zone.end, srcAccum, 1.0, nextSpeed);
      cursor = zone.end;
    }

    // Secção rápida final (se houver)
    if (cursor < layerOut) {
      srcAccum += (layerOut - cursor) * fastF;
      pushBezier(layerOut, srcAccum, fastF, fastF);
    }

    // ── 4. Aplicar keyframes no AE ────────────────────────────
    for (var n = 0; n < kfs.length; n++) {
      var kf  = kfs[n];
      var idx = tr.addKey(kf.compT);
      tr.setValueAtKey(idx, kf.srcT);

      if (kf.interp === 'bezier') {
        tr.setInterpolationTypeAtKey(
          idx,
          KeyframeInterpolationType.BEZIER,
          KeyframeInterpolationType.BEZIER
        );
        tr.setTemporalEaseAtKey(
          idx,
          [new KeyframeEase(kf.speedIn,  infl)],
          [new KeyframeEase(kf.speedOut, infl)]
        );
      } else {
        // HOLD: frame congelado até ao próximo keyframe
        tr.setInterpolationTypeAtKey(
          idx,
          KeyframeInterpolationType.HOLD,
          KeyframeInterpolationType.HOLD
        );
      }
    }

    app.endUndoGroup();
    return 'ok';

  } catch (e) {
    try { app.endUndoGroup(); } catch (_) {}
    return 'Erro: ' + e.message;
  }
}
