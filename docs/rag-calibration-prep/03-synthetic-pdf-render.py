#!/usr/bin/env python3
"""
Gera o PDF sintético B (Manual Tecnico dos Farois Zylanticos) a partir do
conteúdo textual em `02-synthetic-pdf-content.md`.

USO (você executa localmente, se optar por esta via):
    python3 03-synthetic-pdf-render.py

Saída:
    ./Manual_Tecnico_dos_Farois_Zylanticos_Volume_I.pdf

Depois de gerar, calcule o SHA-256 e guarde:
    sha256sum Manual_Tecnico_dos_Farois_Zylanticos_Volume_I.pdf

Requisitos:
    pip install reportlab
    (fonte DejaVu Sans normalmente já vem instalada; se faltar acento,
     ajuste o caminho FONT_PATH abaixo)
"""

import subprocess
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
)

CONTENT_FILE = Path(__file__).parent / "02-synthetic-pdf-content.md"
OUT_FILE = Path(__file__).parent / "Manual_Tecnico_dos_Farois_Zylanticos_Volume_I.pdf"


def register_dejavu() -> str:
    try:
        font_path = subprocess.check_output(
            ["fc-match", "-f", "%{file}", "DejaVu Sans"], text=True
        ).strip()
    except Exception:
        # fallback: caminho padrão no Debian/Ubuntu
        font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    pdfmetrics.registerFont(TTFont("DejaVuSans", font_path))
    return "DejaVuSans"


def parse_content(text: str):
    """Retorna lista de (tipo, texto). tipo in {'h1','h2','p'}. Ignora '---'."""
    blocks = []
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            blocks.append(("blank", ""))
            continue
        if line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
        elif line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
        elif line.strip() == "---":
            blocks.append(("pagebreak", ""))
        else:
            blocks.append(("p", line.strip()))
    # colapsar parágrafos multi-linha (aqui cada linha já é um parágrafo)
    return blocks


def build_pdf():
    font = register_dejavu()
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
        if kind == "pagebreak":
            story.append(PageBreak())
        elif kind == "h1":
            story.append(Paragraph(val, styles["h1"]))
        elif kind == "h2":
            # cada capítulo (h2) em nova página, exceto o primeiro que vem
            # logo após o subtítulo do manual
            if prev is not None and prev != "h1":
                story.append(PageBreak())
            story.append(Paragraph(val, styles["h2"]))
        elif kind == "p":
            story.append(Paragraph(val, styles["p"]))
        elif kind == "blank":
            story.append(Spacer(1, 4))
        prev = kind if kind != "blank" else prev

    doc.build(story)
    print(f"OK -> {OUT_FILE}")
    print("Rode agora: sha256sum " + OUT_FILE.name)


if __name__ == "__main__":
    build_pdf()
