from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import fitz  # PyMuPDF
from PIL import Image
import pytesseract


@dataclass(frozen=True)
class PageText:
  page_number: int
  text: str
  ocr_used: bool


def page_count(pdf_path: str) -> int:
  doc = fitz.open(pdf_path)
  try:
    return int(doc.page_count)
  finally:
    doc.close()


def extract_text_pages(
  pdf_path: str,
  *,
  ocr_enabled: bool,
  tesseract_lang: str,
  min_chars_for_digital: int = 80,
  ocr_dpi: int = 200
) -> Iterable[PageText]:
  """Extract per-page text with OCR fallback.

  - Digital-first: PyMuPDF `page.get_text('text')`.
  - OCR fallback: only when digital text is likely empty/garbled.
  """
  doc = fitz.open(pdf_path)
  try:
    for i in range(doc.page_count):
      page = doc.load_page(i)
      digital = (page.get_text("text") or "").strip()
      text = digital
      ocr_used = False

      if ocr_enabled and len(digital) < min_chars_for_digital:
        pix = page.get_pixmap(dpi=ocr_dpi, colorspace=fitz.csRGB)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        ocr = (pytesseract.image_to_string(img, lang=tesseract_lang) or "").strip()
        if len(ocr) > len(text):
          text = ocr
          ocr_used = True

      yield PageText(page_number=i + 1, text=text, ocr_used=ocr_used)
  finally:
    doc.close()
