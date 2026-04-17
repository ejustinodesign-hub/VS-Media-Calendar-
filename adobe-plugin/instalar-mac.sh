#!/bin/bash
# VS Media — Speed Ramp Plugin · Instalador Mac
# Corre este script uma vez e o plugin fica instalado.

set -e

PLUGIN_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/VSMediaSpeedRamp"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   VS Media — Speed Ramp Installer   ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Copiar ficheiros do plugin ────────────────────────────
echo "→ A copiar plugin para Adobe CEP..."
mkdir -p "$PLUGIN_DIR/CSXS"
mkdir -p "$PLUGIN_DIR/css"
mkdir -p "$PLUGIN_DIR/js"
mkdir -p "$PLUGIN_DIR/scripts"

cp "$SCRIPT_DIR/CSXS/manifest.xml"          "$PLUGIN_DIR/CSXS/"
cp "$SCRIPT_DIR/index.html"                  "$PLUGIN_DIR/"
cp "$SCRIPT_DIR/css/style.css"               "$PLUGIN_DIR/css/"
cp "$SCRIPT_DIR/js/main.js"                  "$PLUGIN_DIR/js/"
cp "$SCRIPT_DIR/scripts/aftereffects.jsx"    "$PLUGIN_DIR/scripts/"

echo "   ✓ Ficheiros copiados para:"
echo "   $PLUGIN_DIR"
echo ""

# ── 2. Activar extensões não assinadas ───────────────────────
echo "→ A activar modo de desenvolvimento CEP..."
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.10 PlayerDebugMode 1
defaults write com.adobe.CSXS.9  PlayerDebugMode 1
echo "   ✓ PlayerDebugMode activado"
echo ""

# ── 3. Verificar CSInterface.js ──────────────────────────────
if [ -f "$SCRIPT_DIR/js/CSInterface.js" ]; then
    cp "$SCRIPT_DIR/js/CSInterface.js" "$PLUGIN_DIR/js/"
    echo "   ✓ CSInterface.js copiado"
elif [ -f "$PLUGIN_DIR/js/CSInterface.js" ]; then
    echo "   ✓ CSInterface.js já existe"
else
    echo "   ⚠ CSInterface.js não encontrado."
    echo ""
    echo "   Faz download em:"
    echo "   https://raw.githubusercontent.com/Adobe-CEP/CSInterface/master/src/CSInterface.js"
    echo ""
    echo "   Guarda o ficheiro em:"
    echo "   $PLUGIN_DIR/js/CSInterface.js"
    echo ""

    # Tenta descarregar automaticamente com curl
    echo "→ A tentar descarregar CSInterface.js automaticamente..."
    if curl -fsSL "https://raw.githubusercontent.com/Adobe-CEP/CSInterface/master/src/CSInterface.js" \
         -o "$PLUGIN_DIR/js/CSInterface.js" 2>/dev/null; then
        echo "   ✓ CSInterface.js descarregado automaticamente"
    else
        echo "   ✗ Sem acesso à internet. Instala manualmente (ver acima)."
    fi
fi

echo ""
echo "══════════════════════════════════════════"
echo " Instalação concluída!"
echo ""
echo " Próximos passos:"
echo " 1. Abre o After Effects"
echo " 2. Menu: Janela → Extensões → VS Media — Speed Ramp"
echo "══════════════════════════════════════════"
echo ""
