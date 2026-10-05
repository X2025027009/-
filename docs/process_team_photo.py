"""处理小院合照，使其与站点配色协调。

为什么要处理：这张合照是户外阴天拍摄，整体偏灰冷；而站点主色调是暖黄
（#F4C96B / #FDF6E2 一带）。直接把原图放进暖色卡片里会"贴"上去，显得生硬。

处理三件事：
  1. 轻微暖化并压低一点对比度，让冷灰调向暖调靠拢，但不改变照片本身的样子
  2. 缩到 1400px 宽并压缩——网页用不到 2500px，原图 1MB 拖慢加载
  3. 保留原始宽高比

不做的事：不加滤镜特效、不磨皮、不动人物。照片是真实记录，不能修成"宣传照"。
"""
import os
import sys
from PIL import Image, ImageEnhance

SRC = sys.argv[1]
DST = sys.argv[2]
TARGET_WIDTH = 1400


def warm_and_soften(img):
    """向站点暖色调靠拢：轻微暖化 + 稍降对比与饱和。"""
    # 1) 轻微暖化：拉高红通道、轻微压低蓝通道
    r, g, b = img.split()
    r = r.point(lambda v: min(255, int(v * 1.045 + 4)))
    b = b.point(lambda v: int(v * 0.965))
    img = Image.merge('RGB', (r, g, b))
    # 2) 降一点对比，让画面更柔和，不至于在暖底上显得"跳"
    img = ImageEnhance.Contrast(img).enhance(0.94)
    # 3) 轻微降饱和，靠近站点的低饱和配色
    img = ImageEnhance.Color(img).enhance(0.92)
    # 4) 提一点亮度，避免在浅色卡片里发闷
    img = ImageEnhance.Brightness(img).enhance(1.02)
    return img


def main():
    img = Image.open(SRC)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    original = img.size

    if img.width > TARGET_WIDTH:
        height = round(img.height * TARGET_WIDTH / img.width)
        img = img.resize((TARGET_WIDTH, height), Image.LANCZOS)

    img = warm_and_soften(img)

    os.makedirs(os.path.dirname(os.path.abspath(DST)), exist_ok=True)
    img.save(DST, 'JPEG', quality=84, optimize=True, progressive=True)

    src_kb = os.path.getsize(SRC) / 1024
    dst_kb = os.path.getsize(DST) / 1024
    print(f'原图 {original[0]}x{original[1]}  {src_kb:.0f}KB')
    print(f'输出 {img.width}x{img.height}  {dst_kb:.0f}KB  -> {DST}')


if __name__ == '__main__':
    main()
