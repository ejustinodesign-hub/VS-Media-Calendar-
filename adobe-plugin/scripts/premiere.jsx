/* ============================================================
   VS Media Real Estate — Premiere Pro ExtendScript
   Funções chamadas pelo painel HTML via CSInterface.evalScript
   ============================================================ */

// ── Utilidades ───────────────────────────────────────────────

/** Devolve todos os clips seleccionados na timeline activa */
function getSelectedClips() {
  var seq = app.project.activeSequence;
  if (!seq) return [];
  return seq.getSelection();
}

/** Devolve o clip seleccionado mais a esquerda (para intro) */
function getFirstSelectedClip() {
  var clips = getSelectedClips();
  if (!clips || !clips.length) return null;
  clips.sort(function(a, b) { return a.start.ticks - b.start.ticks; });
  return clips[0];
}

// ── Lumetri Color helper ─────────────────────────────────────

/**
 * Devolve (ou cria) o efeito Lumetri Color num clip.
 * @param {TrackItem} clip
 * @returns {Component|null}
 */
function getLumetriEffect(clip) {
  var effects = clip.components;
  for (var i = 0; i < effects.numItems; i++) {
    if (effects[i].displayName === 'Lumetri Color') {
      return effects[i];
    }
  }
  // Adiciona o efeito
  return clip.addEffect('Lumetri Color') || null;
}

// ── 1. Aplicar LUT ───────────────────────────────────────────

/**
 * Aplica o LUT Sony S-Log3→Rec.709 aos clips seleccionados.
 * @param {string} lutPath  Caminho absoluto para o ficheiro .cube
 * @returns {string} Número de clips processados ou mensagem de erro
 */
function applyLutPremiere(lutPath) {
  try {
    var clips = getSelectedClips();
    if (!clips || !clips.length) return 'Nenhum clip seleccionado.';

    var count = 0;
    for (var i = 0; i < clips.length; i++) {
      var clip = clips[i];
      if (!clip || clip.type !== 1) continue; // tipo 1 = vídeo

      var lumetri = getLumetriEffect(clip);
      if (!lumetri) continue;

      // Input LUT (Basic Correction > Input LUT)
      var basicGroup = lumetri.properties.getParamForDisplayName('Basic Correction');
      if (basicGroup) {
        var inputLut = basicGroup.getParamForDisplayName('Input LUT');
        if (inputLut) {
          inputLut.setValue(lutPath, true);
        }
      }
      count++;
    }
    return String(count);
  } catch (e) {
    return 'Erro: ' + e.message;
  }
}

// ── 2. Aplicar Color Grade ───────────────────────────────────

/**
 * Aplica o color grade imobiliário (clean real estate look).
 * @param {Object} params  { temp, contrast, highlights, shadows, saturation }
 */
function applyGradePremiere(params) {
  try {
    if (typeof params === 'string') params = JSON.parse(params);

    var clips = getSelectedClips();
    if (!clips || !clips.length) return 'Nenhum clip seleccionado.';

    for (var i = 0; i < clips.length; i++) {
      var clip = clips[i];
      if (!clip || clip.type !== 1) continue;

      var lumetri = getLumetriEffect(clip);
      if (!lumetri) continue;

      var props = lumetri.properties;

      // ── Basic Correction ──────────────────────────────────
      var basic = props.getParamForDisplayName('Basic Correction');
      if (basic) {
        _setParam(basic, 'Temperature', params.temp);
        _setParam(basic, 'Contrast',    params.contrast);
        _setParam(basic, 'Highlights',  params.highlights);
        _setParam(basic, 'Shadows',     params.shadows);
        _setParam(basic, 'Saturation',  params.saturation);
      }

      // ── Creative — Vibrance ligeiro ────────────────────────
      var creative = props.getParamForDisplayName('Creative');
      if (creative) {
        _setParam(creative, 'Vibrance',    5);
        _setParam(creative, 'Saturation',  params.saturation);
      }
    }
    return 'ok';
  } catch (e) {
    return 'Erro: ' + e.message;
  }
}

/** Helper para definir valor de parâmetro Lumetri pelo nome */
function _setParam(group, name, value) {
  try {
    var p = group.getParamForDisplayName(name);
    if (p) p.setValue(value, true);
  } catch (e) { /* ignora parâmetros não encontrados */ }
}

// ── 3. Aplicar Template de Legendas ─────────────────────────

/**
 * Aplica o template MOGRT de legendas ao clip seleccionado
 * posicionando-o na linha de legendas (V2 por defeito).
 *
 * @param {string} mogrtPath  Caminho absoluto ao ficheiro .mogrt
 * @param {number} yPos       Posição vertical em percentagem (0-100)
 */
function applySubtitleTemplate(mogrtPath, yPos) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return 'Sem sequência activa.';

    var clip = getFirstSelectedClip();
    if (!clip) return 'Selecciona o clip do consultor.';

    // Importar o MOGRT como Motion Graphics clip
    var importResult = seq.importMGT(
      mogrtPath,
      clip.start.ticks,  // começa no mesmo tempo que o clip seleccionado
      1,                  // índice da video track (V2)
      false
    );

    if (!importResult) return 'Falha ao importar template.';

    return 'ok';
  } catch (e) {
    return 'Erro: ' + e.message;
  }
}

// ── 4. Export H.264 4K ───────────────────────────────────────

/**
 * Adiciona a sequência activa ao Adobe Media Encoder
 * com preset H.264 4K optimizado para redes sociais.
 *
 * @param {number} bitrate  VBR máximo em Mbps
 */
function exportH264_4K(bitrate) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return 'Sem sequência activa.';

    // Caminho de output: mesma pasta do projecto
    var projectDir = app.project.path.replace(/[^\/\\]*$/, '');
    var seqName    = seq.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    var outputPath = projectDir + seqName + '_4K_H264.mp4';

    // Preset H.264 4K nativo do AME
    // {D5C73B66-…} = GUID do preset "Match Source - Adaptive High Bitrate"
    // Usamos o preset "H.264" nativo e ajustamos via encoder preset
    var encoder = app.encoder;
    if (!encoder) return 'Adobe Media Encoder não encontrado.';

    encoder.launchEncoder();

    // Adiciona à fila do AME
    var job = encoder.encodeSequence(
      seq,
      outputPath,
      'H.264',             // format
      'Match Source - Adaptive High Bitrate', // preset
      app.encoder.ENCODE_IN_PARALLEL,
      true                 // removeOnCompletion = false
    );

    return job ? 'ok' : 'Falha ao criar job de exportação.';
  } catch (e) {
    return 'Erro: ' + e.message;
  }
}
