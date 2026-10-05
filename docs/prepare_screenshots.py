"""Prepare the four UI screenshots for document placement.

The browser captures intentionally target only the relevant panels.  Figure 11
combines the verified microphone listening state with the answer/read control,
as requested by the fallback instructions.
"""

from __future__ import annotations

import os
import shutil

from PIL import Image, ImageDraw, ImageFont


BASE = os.path.dirname(os.path.abspath(__file__))
SCREEN = os.path.join(BASE, "screenshots")
BUILD = os.path.join(BASE, "build")
FONT = r"C:\Windows\Fonts\msyhbd.ttc"
PAPER = (253, 251, 247)
INK = (46, 42, 38)
MUTED = (128, 120, 112)
LINE = (196, 188, 178)


def scale_to_width(image: Image.Image, width: int) -> Image.Image:
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def make_figure_11() -> str:
    listening = Image.open(os.path.join(SCREEN, "fig11-voice.png")).convert("RGB")
    answered = Image.open(os.path.join(SCREEN, "fig8-match.png")).convert("RGB")

    # The left side of figure 8 contains the generated answer and the read
    # control.  Cropping it avoids repeating the input and photo sections.
    answer_crop = answered.crop((0, 90, min(1050, answered.width), min(760, answered.height)))
    listening = scale_to_width(listening, 1500)
    answer_crop = scale_to_width(answer_crop, 1500)

    label_h = 58
    gap = 28
    margin = 48
    canvas_h = margin + label_h + listening.height + gap + label_h + answer_crop.height + margin
    canvas = Image.new("RGB", (1600, canvas_h), PAPER)
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(FONT, 30)
    note_font = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 22)

    y = margin
    draw.text((50, y), "语音输入 · 录音中", font=title_font, fill=INK)
    draw.text((355, y + 5), "按钮进入高亮状态，使用伪麦克风设备完成自动化验证", font=note_font, fill=MUTED)
    y += label_h
    canvas.paste(listening, (50, y))
    draw.rounded_rectangle((49, y - 1, 1551, y + listening.height + 1), radius=16, outline=LINE, width=2)

    y += listening.height + gap
    draw.text((50, y), "回答朗读入口", font=title_font, fill=INK)
    draw.text((300, y + 5), "回答生成后显示“朗读这段回答”", font=note_font, fill=MUTED)
    y += label_h
    canvas.paste(answer_crop, (50, y))
    draw.rounded_rectangle((49, y - 1, 1551, y + answer_crop.height + 1), radius=16, outline=LINE, width=2)

    path = os.path.join(SCREEN, "fig11-voice.png")
    canvas.save(path, dpi=(300, 300))
    return path


def copy_to_build() -> None:
    for name in ("fig8-match.png", "fig9-review.png", "fig10-photo.png", "fig11-voice.png"):
        shutil.copy2(os.path.join(SCREEN, name), os.path.join(BUILD, name))


if __name__ == "__main__":
    print(make_figure_11())
    copy_to_build()
    print("Screenshots copied to", BUILD)
