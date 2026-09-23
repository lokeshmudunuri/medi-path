"""Local image preprocessing for the prescription OCR pipeline.

Pure Pillow/numpy processing — no cloud, no external services. Steps:
grayscale, contrast stretch, adaptive sharpening, and optional deskew via
projection profile. The processed image is written to the app-managed model
tmp/case area and returned to the caller.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from app.utils.logging import get_logger

log = get_logger("ocr.preprocess")


class ImagePreprocessor:
    def __init__(self) -> None:
        pass

    def preprocess(self, image_path: str, output_path: str | None = None) -> str:
        image = Image.open(image_path).convert("L")
        # Auto-orient from EXIF and normalise dimensions for the OCR model.
        image = ImageOps.exif_transpose(image)
        image = self._contain(image, max_side=2000)
        image = ImageEnhance.Contrast(image).enhance(1.3)
        image = image.filter(ImageFilter.UnsharpMask(radius=2, percent=140, threshold=3))
        image = self._deskew(image)
        img_array = np.array(image)
        img_array[img_array < 90] = 0
        img_array[img_array > 200] = 255
        image = Image.fromarray(img_array)
        if output_path is None:
            output_path = str(image_path) + ".pre.png"
        image.save(output_path, "PNG")
        return output_path

    @staticmethod
    def _contain(image: Image.Image, max_side: int = 2000) -> Image.Image:
        width, height = image.size
        scale = min(1.0, max_side / max(width, height))
        if scale < 1.0:
            image = image.resize((int(width * scale), int(height * scale)))
        return image

    @staticmethod
    def _deskew(image: Image.Image) -> Image.Image:
        """Simple projection-profile deskew; returns image unchanged on
        failure so OCR never breaks because of the helper."""
        try:
            arr = np.array(image)
            if arr.size < 512 * 512:
                return image
            h, w = arr.shape
            crop = arr[h // 4 : 3 * h // 4, :]
            best_angle, best_score = 0.0, float("-inf")
            for angle in (-2, -1, 0, 1, 2):
                rotated = Image.fromarray(crop).rotate(angle, fillcolor=255)
                score = float(np.sum(np.array(rotated) < 128))
                if score > best_score:
                    best_score, best_angle = score, angle
            if best_angle == 0:
                return image
            return image.rotate(best_angle, fillcolor=255, expand=False)
        except Exception as exc:
            log.warning("deskew skipped: %s", exc)
            return image


preprocessor = ImagePreprocessor()