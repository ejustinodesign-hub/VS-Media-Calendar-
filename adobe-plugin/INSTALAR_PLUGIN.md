# VS Media — Speed Ramp Tool · Instalação

## Requisitos
- After Effects 2022 ou superior (versão 22+)
- Windows 10/11 ou macOS 11+

---

## Passo 1 — Copiar o plugin

### Windows
```
C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\VSMediaSpeedRamp
```

### macOS
```
/Library/Application Support/Adobe/CEP/extensions/VSMediaSpeedRamp
```

O nome da pasta de destino deve ser `VSMediaSpeedRamp`.

---

## Passo 2 — Activar extensões não assinadas

### Windows — Registo (`regedit`)
```
HKEY_CURRENT_USER\Software\Adobe\CSXS.11
```
Criar valor: `PlayerDebugMode` → `String` → `1`

### macOS — Terminal
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

---

## Passo 3 — Copiar CSInterface.js

1. Ir a: https://github.com/Adobe-CEP/CSInterface
2. Download do ficheiro `src/CSInterface.js`
3. Colocar em: `VSMediaSpeedRamp/js/CSInterface.js`

---

## Passo 4 — Abrir o painel

1. Abre o After Effects
2. Menu: **Janela → Extensões → VS Media — Speed Ramp**

---

## Como usar

1. Abre uma comp com o teu clip longo
2. Selecciona o layer de vídeo
3. Clica **↺** no painel para detectar o layer
4. Ajusta as velocidades e a duração do slow
5. Scruba o CTI para um momento que queres slow → clica **+ Marcar tempo actual**
6. Repete para todos os pontos slow que quiseres
7. Clica **APLICAR SPEED RAMPS**

O plugin cria automaticamente Time Remapping com bezier nas transições.
