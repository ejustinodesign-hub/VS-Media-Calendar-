/* ============================================================
   VS Media Real Estate — After Effects ExtendScript
   Funções chamadas pelo painel HTML via CSInterface.evalScript
   ============================================================ */

// ── Utilidades ───────────────────────────────────────────────

/** Devolve a comp activa */
function getActiveComp() {
  return app.project.activeItem instanceof CompItem ? app.project.activeItem : null;
}

/** Devolve os layers seleccionados na comp activa */
function getSelectedLayers() {
  var comp = getActiveComp();
  if (!comp) return [];
  var sel = [];
  for (var i = 1; i <= comp.numLayers; i++) {
    if (comp.layer(i).selected) sel.push(comp.layer(i));
  }
  return sel;
}

// ── 1. Aplicar LUT no After Effects ──────────────────────────

/**
 * Aplica LUT via efeito "Apply Color LUT" ao layer seleccionado.
 * @param {string} lutPath  Caminho absoluto ao .cube
 */
function applyLutAE(lutPath) {
  try {
    var layers = getSelectedLayers();
    if (!layers.length) return 'Nenhum layer seleccionado.';

    var count = 0;
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      if (!(layer instanceof AVLayer)) continue;

      var fx = layer.property('ADBE Effect Parade');

      // Adiciona "Apply Color LUT" (ADBE Apply Color LUT2)
      var lutEffect = fx.addProperty('ADBE Apply Color LUT2');
      if (lutEffect) {
        // Define o caminho do LUT
        var lutParam = lutEffect.property('ADBE Apply Color LUT2-0001');
        if (lutParam) {
          lutParam.setValue(lutPath);
        }
        count++;
      }
    }
    return String(count);
  } catch (e) {
    return 'Erro: ' + e.message;
  }
}

// ── 2. Aplicar Color Grade no AE ─────────────────────────────

/**
 * Aplica grade clean via Lumetri Color (efeito nativo AE 2022+)
 * ou via Curves/Hue-Saturation se Lumetri não estiver disponível.
 * @param {Object|string} params
 */
function applyGradeAE(params) {
  try {
    if (typeof params === 'string') params = JSON.parse(params);

    var layers = getSelectedLayers();
    if (!layers.length) return 'Nenhum layer seleccionado.';

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      if (!(layer instanceof AVLayer)) continue;

      var fx = layer.property('ADBE Effect Parade');

      // ── Lumetri Color (AE 2022+) ──────────────────────────
      try {
        var lumetri = fx.addProperty('ADBE Lumetri Color');
        if (lumetri) {
          // Temperature
          var temp = lumetri.property('ADBE Lumetri Color-0001');
          if (temp) temp.setValue(params.temp);
          // Contrast
          var contrast = lumetri.property('ADBE Lumetri Color-0003');
          if (contrast) contrast.setValue(params.contrast);
          // Highlights
          var hl = lumetri.property('ADBE Lumetri Color-0004');
          if (hl) hl.setValue(params.highlights);
          // Shadows
          var sh = lumetri.property('ADBE Lumetri Color-0005');
          if (sh) sh.setValue(params.shadows);
          // Saturation
          var sat = lumetri.property('ADBE Lumetri Color-0012');
          if (sat) sat.setValue(params.saturation);
          continue;
        }
      } catch (lumetriErr) { /* Lumetri não disponível, usa fallback */ }

      // ── Fallback: Hue/Saturation ───────────────────────────
      var hueSat = fx.addProperty('ADBE HUE SATURATION');
      if (hueSat) {
        var masterSat = hueSat.property('ADBE HUE SATURATION-0003');
        if (masterSat) masterSat.setValue(params.saturation - 100);
      }

      // ── Fallback: Brightness & Contrast ───────────────────
      var bc = fx.addProperty('ADBE Brighten');
      if (bc) {
        var cont = bc.property('ADBE Brighten-0002');
        if (cont) cont.setValue(params.contrast);
      }
    }
    return 'ok';
  } catch (e) {
    return 'Erro: ' + e.message;
  }
}

// ── 3. Speed Ramp ────────────────────────────────────────────

/**
 * Aplica speed ramp ao layer seleccionado usando Time Remapping.
 *
 * Para clips WIDE ANGLE / DRONE:
 *   - Começa normal (100%)
 *   - Acelera até peakSpeed% no meio
 *   - Volta a normal (100%) no final
 *   Curvas Easy Ease para transição suave.
 *
 * @param {string} rampType   "wide" ou "drone"
 * @param {number} peakSpeed  Multiplicador de velocidade (ex: 4 = 400%)
 * @param {number} rampIn     Duração do ramp in em segundos
 * @param {number} rampOut    Duração do ramp out em segundos
 */
function applySpeedRamp(rampType, peakSpeed, rampIn, rampOut) {
  try {
    var layers = getSelectedLayers();
    if (!layers.length) return 'Nenhum layer seleccionado.';

    var layer = layers[0]; // processa o primeiro layer seleccionado
    if (!(layer instanceof AVLayer)) return 'Layer não é de vídeo.';

    var comp      = getActiveComp();
    var fps       = comp.frameRate;
    var layerIn   = layer.inPoint;
    var layerOut  = layer.outPoint;
    var duration  = layerOut - layerIn;

    // Ativa Time Remapping
    layer.timeRemapEnabled = true;
    var timeRemap = layer.property('ADBE Time Remapping');

    // Remove keyframes existentes gerados automaticamente
    while (timeRemap.numKeys > 0) {
      timeRemap.removeKey(1);
    }

    // ── Calcular pontos de keyframe ───────────────────────────
    // O Time Remap mapeia: tempo na comp → tempo na source
    //
    // Para criar speed ramp (normal → rápido → normal):
    //   kf1: t=layerIn,            sourceTime=0           (normal start)
    //   kf2: t=layerIn+rampIn,     sourceTime=rampIn      (fim slow/normal, início aceleração)
    //   kf3: t=midpoint,           sourceTime=midSrc      (pico velocidade)
    //   kf4: t=layerOut-rampOut,   sourceTime=layerOut-layerIn-rampOut
    //   kf5: t=layerOut,           sourceTime=layerOut-layerIn (fim normal)

    var srcDuration = layer.source.duration || duration;
    var mid         = layerIn + duration / 2;

    // Source times (o que a câmara gravou vs o que vemos)
    // No pico de velocidade, a source avança peakSpeed vezes mais rápido
    // por isso em 1 frame de comp, lemos peakSpeed frames de source

    var t0    = layerIn;
    var t1    = layerIn + rampIn;
    var tMid  = mid;
    var t2    = layerOut - rampOut;
    var t3    = layerOut;

    // Source times correspondentes
    var s0   = 0;
    var s1   = rampIn;                    // normal até ao ramp
    var sMid = s1 + (tMid - t1) * peakSpeed; // avança rápido no meio
    var s2   = sMid + (t2 - tMid) * peakSpeed; // continua rápido
    var s3   = s2 + rampOut;             // volta a normal

    // Garante que não excede a duração da source
    if (s3 > srcDuration) {
      var scale = srcDuration / s3;
      s1   *= scale; sMid *= scale; s2 *= scale; s3 *= scale;
    }

    // Adiciona keyframes
    var kf1 = timeRemap.addKey(t0);  timeRemap.setValueAtKey(kf1, s0);
    var kf2 = timeRemap.addKey(t1);  timeRemap.setValueAtKey(kf2, s1);
    var kf3 = timeRemap.addKey(tMid); timeRemap.setValueAtKey(kf3, sMid);
    var kf4 = timeRemap.addKey(t2);  timeRemap.setValueAtKey(kf4, s2);
    var kf5 = timeRemap.addKey(t3);  timeRemap.setValueAtKey(kf5, s3);

    // ── Aplicar Easy Ease nos keyframes de transição ──────────
    // kf2 e kf4 têm a curva de ease (entrada e saída do pico)
    timeRemap.setTemporalEaseAtKey(kf2,
      [new KeyframeEase(0, 33)],   // ease in
      [new KeyframeEase(0, 33)]    // ease out
    );
    timeRemap.setTemporalEaseAtKey(kf3,
      [new KeyframeEase(0, 66)],
      [new KeyframeEase(0, 66)]
    );
    timeRemap.setTemporalEaseAtKey(kf4,
      [new KeyframeEase(0, 33)],
      [new KeyframeEase(0, 33)]
    );

    // ── Para DRONE: ramp mais longo no início ─────────────────
    if (rampType === 'drone') {
      // Ajusta o kf1 para um ease in mais suave
      timeRemap.setTemporalEaseAtKey(kf1,
        [new KeyframeEase(0, 50)],
        [new KeyframeEase(0, 50)]
      );
    }

    return 'ok';
  } catch (e) {
    return 'Erro: ' + e.message;
  }
}
