#!/usr/bin/env python3
"""
v2 — correcoes aplicadas apos revisao do usuario:

1) Compatibilidade de fonte multiplataforma, sem download externo:
   - Linux/macOS: tenta `fc-match` para localizar "DejaVu Sans".
   - Windows:     tenta C:\\Windows\\Fonts\\arial.ttf (e variantes).
   - Fallback:    Helvetica embutido do ReportLab (pode nao ter todos os
                  acentos; um aviso e impresso).
   Toda a resolucao e loggada em stderr para auditoria.

2) Eliminacao das quebras duplas de pagina:
   - O separador Markdown `---` e IGNORADO (nao gera PageBreak).
   - A quebra de pagina vem exclusivamente da regra "cada h2 em nova pagina,
     exceto o primeiro apos o h1".

USO:
    python 03-synthetic-pdf-render.v2.py

SAIDA:
    ./Manual_Tecnico_dos_Farois_Zylanticos_Volume_I.pdf

Sem rede. Sem Supabase. Sem upload. Sem instalar fontes.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

CONTENT_FILE = Path(__file__).parent / "02-synthetic-pdf-content.md"
OUT_FILE = Path(__file__).parent / "Manual_Tecnico_dos_Farois_Zylanticos_Volume_I.pdf"


# --------------------------------------------------------------------------
# Fonte
# --------------------------------------------------------------------------

def _log(msg: str) -> None:
    print(f"[render] {msg}", file=sys.stderr)


def _try_fc_match() -> str | None:
    if not shutil.which("fc-match"):
        return None
    try:
        p = subprocess.check_output(
            ["fc-match", "-f", "%{file}", "DejaVu Sans"],
            text=True, stderr=subprocess.DEVNULL,
        ).strip()
        return p if p and Path(p).exists() else None
    except Exception:
        return None


def _try_windows_arial() -> str | None:
    # Verifica caminhos padrao do Windows. Nao baixa nada.
    candidates = [
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\Arial.ttf",
        r"C:\Windows\Fonts\ARIAL.TTF",
    ]
    # Se %WINDIR% estiver definido, tenta variante case-insensitive
    windir = os.environ.get("WINDIR") or os.environ.get("SystemRoot")
    if windir:
        candidates.append(str(Path(windir) / "Fonts" / "arial.ttf"))
    for c in candidates:
        if Path(c).exists():
            return c
    return None


def _try_linux_dejavu_default() -> str | None:
    for c in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/opt/homebrew/share/fonts/DejaVuSans.ttf",
    ):
        if Path(c).exists():
            return c
    return None


def resolve_font() -> str:
    """
    Retorna o nome do font registrado no pdfmetrics. Se registrar um TTF
    Unicode, devolve esse nome. Senao, cai para Helvetica (built-in) e
    imprime aviso.
    """
    # 1) fc-match (Linux/macOS com fontconfig)
    p = _try_fc_match()
    if p:
        _log(f"fonte via fc-match: {p}")
        pdfmetrics.registerFont(TTFont("DocFont", p))
        return "DocFont"

    # 2) Windows Arial local
    p = _try_windows_arial()
    if p:
        _log(f"fonte via Windows local: {p}")
        pdfmetrics.registerFont(TTFont("DocFont", p))
        return "DocFont"

    # 3) DejaVu em caminhos comuns
    p = _try_linux_dejavu_default()
    if p:
        _log(f"fonte via caminho padrao: {p}")
        pdfmetrics.registerFont(TTFont("DocFont", p))
        return "DocFont"

    # 4) Fallback embutido
    _log(
        "AVISO: nenhuma TTF Unicode encontrada. Usando Helvetica embutido; "
        "acentos podem ficar incorretos. Instale/aponte uma TTF para melhor "
        "fidelidade."
    )
    return "Helvetica"


# --------------------------------------------------------------------------
# Parser do Markdown
# --------------------------------------------------------------------------

def parse_content(text: str):
    """
    Retorna lista de (tipo, texto). tipo in {'h1','h2','p','blank'}.
    IMPORTANTE: `---` e IGNORADO (nao gera PageBreak). A unica fonte de
    quebra de pagina e a regra de h2 aplicada em build_pdf().
    """
    blocks = []
    for raw in text.splitlines():
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped:
            blocks.append(("blank", ""))
            continue
        if stripped == "---":
            # ignorado deliberadamente — evita quebra dupla
            continue
        if line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
        elif line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
        else:
            blocks.append(("p", stripped))
    return blocks


# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------

def build_pdf() -> None:
    font = resolve_font()
    styles = {
        "h1": ParagraphStyle(
            "h1", fontName=font, fontSize=18, leading=22,
            spaceAfter=12, spaceBefore=0,
        ),
        "h2": ParagraphStyle(
            "h2", fontName=font, fontSize=14, leading=18,
            spaceAfter=10, spaceBefore=6,
        ),
        "p": ParagraphStyle(
            "p", fontName=font, fontSize=11, leading=16,
            spaceAfter=8, alignment=4,  # justificado
        ),
    }

    doc = SimpleDocTemplate(
        str(OUT_FILE),
        pagesize=A4,
        leftMargin=25 * mm, rightMargin=25 * mm,
        topMargin=25 * mm, bottomMargin=25 * mm,
        title="Manual Tecnico dos Farois Zylanticos - Volume I",
        author="Corpus QA sintetico",
    )

    text = CONTENT_FILE.read_text(encoding="utf-8")
    blocks = parse_content(text)

    story = []
    prev = None
    for kind, val in blocks:
        if kind == "h1":
            story.append(Paragraph(val, styles["h1"]))
        elif kind == "h2":
            # cada capitulo em nova pagina, exceto o primeiro apos h1
            if prev is not None and prev != "h1":
                story.append(PageBreak())
            story.append(Paragraph(val, styles["h2"]))
        elif kind == "p":
            story.append(Paragraph(val, styles["p"]))
        elif kind == "blank":
            story.append(Spacer(1, 4))
        prev = kind if kind != "blank" else prev

    doc.build(story)
    _log(f"OK -> {OUT_FILE}")
    _log("proximo passo: sha256sum " + OUT_FILE.name)


if __name__ == "__main__":
    build_pdf()
