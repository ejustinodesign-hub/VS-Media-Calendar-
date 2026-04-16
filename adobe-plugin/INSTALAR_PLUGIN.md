# VS Media Real Estate — Instalação do Plugin Adobe

## Requisitos
- Adobe Premiere Pro 2022 ou superior (versão 22+)
- Adobe After Effects 2022 ou superior (versão 22+)
- Windows 10/11 ou macOS 11+

---

## Passo 1 — Copiar o plugin

### Windows
Copia a pasta `adobe-plugin` completa para:
```
C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\VSMediaRealEstate
```

### macOS
Copia a pasta `adobe-plugin` completa para:
```
/Library/Application Support/Adobe/CEP/extensions/VSMediaRealEstate
```

> O nome da pasta de destino deve ser exatamente `VSMediaRealEstate`.

---

## Passo 2 — Activar extensões não assinadas (desenvolvimento)

### Windows
Abre o **Registo do Windows** (`regedit`) e navega até:
```
HKEY_CURRENT_USER\Software\Adobe\CSXS.11
```
Cria (ou edita) o valor:
- Nome: `PlayerDebugMode`
- Tipo: `String (REG_SZ)`
- Valor: `1`

### macOS
Abre o Terminal e corre:
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

---

## Passo 3 — Instalar o LUT

Segue as instruções em `luts/INSTALAR_LUT.txt`.

---

## Passo 4 — Copiar CSInterface.js

O plugin precisa do ficheiro oficial Adobe `CSInterface.js`:

1. Vai a: https://github.com/Adobe-CEP/CSInterface/blob/master/src/CSInterface.js
2. Faz download do ficheiro raw
3. Coloca-o em: `VSMediaRealEstate/js/CSInterface.js`

---

## Passo 5 — Abrir o painel

1. Abre o Premiere Pro ou After Effects
2. Menu: **Janela (Window) → Extensões → VS Media Real Estate**
3. O painel abre na barra lateral

---

## Utilização rápida

| Passo | Onde | O que fazer |
|-------|------|-------------|
| 1 | Premiere / AE | Selecciona clips S-Log3 → clica **Aplicar LUT** |
| 2 | Premiere / AE | Selecciona clips → clica **Aplicar Color Grade** |
| 3 | After Effects | Selecciona layer wide/drone → clica **Aplicar Speed Ramp** |
| 4 | Premiere | Selecciona clip do consultor → carrega .mogrt → clica **Aplicar Template de Legendas** |
| 5 | Premiere | Clica **Exportar H.264 4K** |

---

## Problemas comuns

**O painel não aparece no menu Extensões**
- Confirma que copiaste para a pasta correcta
- Confirma que activaste `PlayerDebugMode = 1`
- Reinicia o Adobe

**"EvalScript error" no status bar**
- Confirma que o LUT está na pasta `luts/` ou selecciona-o manualmente
- Confirma que tens um clip/layer seleccionado

**Speed Ramp não aparece (Premiere)**
- Speed Ramp só funciona no After Effects — o botão fica inactivo no Premiere
