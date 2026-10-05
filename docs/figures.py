"""技术文档配图生成模块。

没有 matplotlib，所有图都用 Pillow 手绘。好处是颜色、字距、留白可以
和文档本身的设计语言完全对齐，不会出现"图表是另一种风格"的割裂感。

统一约定：
  · 逻辑坐标画图，最后按 SCALE 倍放大输出 —— 保证印刷清晰度（等效 300 DPI 以上）
  · 中文用微软雅黑，代码用 Consolas
  · 配色沿用站点：暖白纸底、鼠尾草绿、陶土红、暖黄
"""
import os
from PIL import Image, ImageDraw, ImageFont

FONT_CN = r'C:\Windows\Fonts\msyh.ttc'
FONT_CN_BOLD = r'C:\Windows\Fonts\msyhbd.ttc'
FONT_MONO = r'C:\Windows\Fonts\consola.ttf'

# 站点设计变量
INK = (46, 42, 38)
MUTED = (128, 120, 112)
LINE = (196, 188, 178)
PAPER = (253, 251, 247)
CREAM = (247, 243, 234)
SAGE = (106, 132, 108)
SAGE_BG = (236, 242, 236)
CLAY = (192, 110, 82)
CLAY_BG = (251, 240, 235)
YELLOW = (244, 201, 107)
YELLOW_BG = (253, 246, 226)

SCALE = 3  # 放大倍数，保证印刷清晰


def font(size, bold=False, mono=False):
    path = FONT_MONO if mono else (FONT_CN_BOLD if bold else FONT_CN)
    return ImageFont.truetype(path, size * SCALE)


class Canvas:
    """按逻辑坐标绘制，输出时统一放大。"""

    def __init__(self, width, height, background=PAPER):
        self.w, self.h = width, height
        self.img = Image.new('RGB', (width * SCALE, height * SCALE), background)
        self.draw = ImageDraw.Draw(self.img)

    def _s(self, value):
        # Pillow 的线宽、圆角半径等参数要求整数，统一在这里取整，
        # 避免"float 不能解释为整数"这类报错
        return int(round(value * SCALE))

    def box(self, x, y, w, h, lines, fill=CREAM, border=LINE, radius=8, bold_first=False, mono=False):
        self.draw.rounded_rectangle(
            [self._s(x), self._s(y), self._s(x + w), self._s(y + h)],
            radius=self._s(radius), fill=fill, outline=border, width=self._s(1.2))
        self._text_block(x, y, w, h, lines, bold_first=bold_first, mono=mono)

    def _text_block(self, x, y, w, h, lines, bold_first=False, mono=False):
        if isinstance(lines, str):
            lines = lines.split('\n')
        sizes = [14 if (i == 0 and bold_first) else 12.5 for i in range(len(lines))]
        line_h = [s * 1.65 for s in sizes]
        total = sum(line_h)
        cursor = self._s(y) + (self._s(h) - self._s(total)) / 2
        for i, line in enumerate(lines):
            f = font(int(sizes[i]), bold=(i == 0 and bold_first), mono=mono)
            bbox = self.draw.textbbox((0, 0), line, font=f)
            self.draw.text((self._s(x + w / 2) - (bbox[2] - bbox[0]) / 2, cursor), line, font=f, fill=INK)
            cursor += self._s(line_h[i])

    def label(self, x, y, text, size=12.5, color=MUTED, bold=False, mono=False, anchor='la'):
        self.draw.text((self._s(x), self._s(y)), text, font=font(int(size), bold=bold, mono=mono), fill=color, anchor=anchor)

    def title(self, x, y, text, size=19):
        self.draw.text((self._s(x), self._s(y)), text, font=font(size, bold=True), fill=INK)

    def caption(self, x, y, text, size=11.5):
        self.draw.text((self._s(x), self._s(y)), text, font=font(size), fill=MUTED)

    def arrow(self, x1, y1, x2, y2, color=LINE, width=1.4, dash=None, head=True):
        import math
        points = [(x1, y1), (x2, y2)]
        if dash:
            # 虚线：按段落绘制
            dx, dy = x2 - x1, y2 - y1
            length = math.hypot(dx, dy)
            step = dash
            pos = 0.0
            while pos < length:
                end = min(pos + step * 0.6, length)
                self.draw.line(
                    [self._s(x1 + dx * pos / length), self._s(y1 + dy * pos / length),
                     self._s(x1 + dx * end / length), self._s(y1 + dy * end / length)],
                    fill=color, width=self._s(width))
                pos += step
        else:
            self.draw.line([self._s(x1), self._s(y1), self._s(x2), self._s(y2)], fill=color, width=self._s(width))
        if head:
            angle = math.atan2(y2 - y1, x2 - x1)
            # Draw both sides of the head behind the endpoint.  The previous
            # implementation used angles around 2.7 radians directly and put
            # the two strokes beyond the target, which looked like a detached
            # chevron instead of an arrowhead.
            for delta in (-0.5, 0.5):
                self.draw.line(
                    [self._s(x2), self._s(y2),
                     self._s(x2 - 9 * math.cos(angle + delta)), self._s(y2 - 9 * math.sin(angle + delta))],
                    fill=color, width=self._s(width))

    def bar_chart(self, x, y, w, h, items, max_value=None, highlight=None):
        """items: [(标签, 数值)]，highlight 为需要强调的标签集合。"""
        max_value = max_value or max(v for _, v in items) * 1.18
        base = y + h
        self.draw.line([self._s(x), self._s(base), self._s(x + w), self._s(base)], fill=LINE, width=self._s(1.2))
        gap = w / len(items)
        bar_w = gap * 0.46
        for i, (name, value) in enumerate(items):
            cx = x + gap * (i + 0.5)
            bar_h = h * value / max_value
            color = CLAY if (highlight and name in highlight) else SAGE
            self.draw.rounded_rectangle(
                [self._s(cx - bar_w / 2), self._s(base - bar_h), self._s(cx + bar_w / 2), self._s(base)],
                radius=self._s(4), fill=color)
            self.draw.text((self._s(cx), self._s(base - bar_h - 20)), f'{value:.4f}',
                           font=font(11.5, bold=True), fill=INK, anchor='ma')
            self.draw.text((self._s(cx), self._s(base + 9)), name, font=font(11.5), fill=MUTED, anchor='ma')

    def save(self, path):
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        self.img.save(path, dpi=(300, 300))
        return path
