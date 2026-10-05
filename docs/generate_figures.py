"""Generate the seven original technical figures for the competition document.

All drawings use the site's warm paper / sage / clay palette and render at
2400 px wide with 300-DPI metadata.  Text is drawn with Microsoft YaHei and
technical identifiers with Consolas.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "figures"
BUILD = ROOT / "build"

S = 2
W = 1200

PAPER = "#FDFBF7"
CREAM = "#F7F3EA"
SAGE = "#6A846C"
SAGE_BG = "#ECF2EC"
CLAY = "#C06E52"
CLAY_BG = "#FBF0EB"
YELLOW = "#F4C96B"
YELLOW_BG = "#FDF6E2"
INK = "#2E2A26"
MUTED = "#807870"
LINE = "#C4BCB2"
WHITE = "#FFFFFF"

FONT_CN = Path(r"C:\Windows\Fonts\msyh.ttc")
FONT_CN_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_MONO = Path(r"C:\Windows\Fonts\consola.ttf")


def F(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_MONO if mono else (FONT_CN_BOLD if bold else FONT_CN)
    return ImageFont.truetype(str(path), size * S)


class D:
    def __init__(self, height: int):
        self.w, self.h = W, height
        self.im = Image.new("RGB", (W * S, height * S), PAPER)
        self.d = ImageDraw.Draw(self.im)

    @staticmethod
    def q(v: float) -> int:
        return round(v * S)

    def rect(self, x, y, w, h, fill=WHITE, outline=LINE, radius=10, width=1.5):
        self.d.rounded_rectangle(
            (self.q(x), self.q(y), self.q(x + w), self.q(y + h)),
            radius=self.q(radius), fill=fill, outline=outline, width=max(1, self.q(width))
        )

    def line(self, pts, fill=LINE, width=1.5):
        self.d.line([(self.q(x), self.q(y)) for x, y in pts], fill=fill, width=max(1, self.q(width)), joint="curve")

    def arrow(self, x1, y1, x2, y2, fill=SAGE, width=2, head=9, dashed=False):
        if dashed:
            dx, dy = x2 - x1, y2 - y1
            length = max(1.0, math.hypot(dx, dy))
            p = 0.0
            while p < length - head:
                e = min(p + 9, length - head)
                self.line([(x1 + dx * p / length, y1 + dy * p / length),
                           (x1 + dx * e / length, y1 + dy * e / length)], fill, width)
                p += 15
        else:
            self.line([(x1, y1), (x2, y2)], fill, width)
        a = math.atan2(y2 - y1, x2 - x1)
        p1 = (x2 - head * math.cos(a - 0.55), y2 - head * math.sin(a - 0.55))
        p2 = (x2 - head * math.cos(a + 0.55), y2 - head * math.sin(a + 0.55))
        self.d.polygon([(self.q(x2), self.q(y2)), (self.q(*p1)[0] if False else self.q(p1[0]), self.q(p1[1])),
                        (self.q(p2[0]), self.q(p2[1]))], fill=fill)

    def text(self, x, y, text, size=19, fill=INK, bold=False, mono=False, anchor="la"):
        self.d.text((self.q(x), self.q(y)), text, font=F(size, bold, mono), fill=fill, anchor=anchor)

    def wrap(self, text: str, width: int, size: int, bold=False, mono=False) -> list[str]:
        font = F(size, bold, mono)
        lines: list[str] = []
        for paragraph in text.split("\n"):
            current = ""
            for char in paragraph:
                candidate = current + char
                if current and self.d.textlength(candidate, font=font) > self.q(width):
                    lines.append(current)
                    current = char
                else:
                    current = candidate
            lines.append(current)
        return lines

    def block(self, x, y, w, h, title, body="", fill=WHITE, outline=LINE,
              title_fill=INK, badge=None, mono_body=False, align="center"):
        self.rect(x, y, w, h, fill, outline)
        if badge:
            self.rect(x + 14, y + 12, 42, 26, badge[1], badge[1], 13, 0)
            self.text(x + 35, y + 25, badge[0], 12, badge[2], True, anchor="mm")
        tx = x + w / 2 if align == "center" else x + 20
        anchor = "ma" if align == "center" else "la"
        ty = y + (h / 2 - 12 if body else h / 2)
        self.text(tx, ty, title, 20, title_fill, True, anchor=anchor)
        if body:
            lines = self.wrap(body, w - 38, 15, mono=mono_body)
            start = ty + 25
            for i, line in enumerate(lines[:4]):
                self.text(tx, start + i * 22, line, 15, MUTED, mono=mono_body, anchor=anchor)

    def chip(self, x, y, text, fill=SAGE_BG, color=SAGE, mono=False, w=None):
        font = F(14, True, mono)
        if w is None:
            w = self.d.textlength(text, font=font) / S + 28
        self.rect(x, y, w, 31, fill, fill, 15, 0)
        self.text(x + w / 2, y + 15.5, text, 14, color, True, mono, "mm")
        return w

    def title(self, title, subtitle):
        self.text(54, 42, title, 30, INK, True)
        self.text(54, 84, subtitle, 15, MUTED)
        self.line([(54, 117), (1146, 117)], LINE, 1)

    def save(self, name):
        OUT.mkdir(parents=True, exist_ok=True)
        BUILD.mkdir(parents=True, exist_ok=True)
        for folder in (OUT, BUILD):
            self.im.save(folder / name, dpi=(300, 300), optimize=True)


def fig1():
    c = D(850)
    c.title("整体系统架构", "业务请求与 AI 请求由网关后分流；AI 异常不会阻断核心业务")
    c.block(250, 145, 700, 86, "浏览器", "原生 JavaScript + CSS · 静态托管 · 无构建步骤", SAGE_BG, SAGE)
    c.arrow(600, 231, 600, 275)
    c.block(345, 275, 510, 70, "CloudBase 网关", "统一入口 / 身份上下文 / 请求分流", YELLOW_BG, YELLOW)
    c.line([(600, 345), (600, 380), (300, 380), (300, 410)], SAGE, 2)
    c.arrow(600, 380, 900, 380, CLAY, 2)
    c.text(285, 395, "业务链路", 15, SAGE, True, anchor="ms")
    c.text(915, 395, "AI 链路", 15, CLAY, True, anchor="ms")
    c.block(90, 415, 420, 96, "yard-api", "Event 云函数 · 申请 / 档案 / 后台设置", SAGE_BG, SAGE)
    c.block(690, 415, 420, 96, "ai-stream", "HTTP 云函数 · SSE 流式 · Agent / RAG", CLAY_BG, CLAY)
    c.arrow(300, 511, 300, 570, SAGE)
    c.arrow(900, 511, 900, 570, CLAY)
    c.block(90, 570, 420, 105, "PostgreSQL + pgvector", "业务数据 · RLS · 1024 维向量 · HNSW", WHITE, SAGE)
    c.block(690, 570, 420, 105, "模型服务", "对话模型 · 向量模型 · 视觉模型", WHITE, CLAY)
    c.arrow(690, 630, 540, 630, CLAY, dashed=True)
    c.text(612, 614, "检索", 13, CLAY, True, anchor="ms")
    c.block(400, 718, 400, 70, "对象存储", "宠物影像 · 稳定存储路径", CREAM, LINE)
    c.arrow(300, 675, 480, 718, SAGE, dashed=True)
    c.arrow(900, 675, 720, 718, CLAY, dashed=True)
    c.chip(418, 360, "链路相互独立", YELLOW_BG, INK, w=164)
    c.chip(600, 360, "AI 异常不影响业务请求", SAGE_BG, SAGE, w=238)
    c.save("fig1-architecture.png")


def fig2():
    c = D(940)
    c.title("AI 请求链路与降级路径", "有 Key 进入工具循环；能力缺失与调用失败均有明确出口")
    c.block(420, 145, 360, 64, "访客提问", fill=WHITE, outline=SAGE)
    c.arrow(600, 209, 600, 250)
    c.block(420, 250, 360, 72, "解析模型 Key", "每次请求重新读取配置", YELLOW_BG, YELLOW)
    c.line([(420, 286), (250, 286), (250, 350)], YELLOW, 2)
    c.arrow(780, 286, 950, 286, SAGE, 2)
    c.text(325, 268, "无 Key", 14, CLAY, True, anchor="ms")
    c.text(858, 268, "有 Key", 14, SAGE, True, anchor="ms")
    c.block(75, 350, 350, 92, "演示模式", "返回内置示例回复 · 明确标注未调用模型", YELLOW_BG, YELLOW)
    c.arrow(950, 286, 950, 350, SAGE)
    c.block(775, 350, 350, 92, "工具循环（最多三轮）", "最后一轮不再提供工具", SAGE_BG, SAGE)
    c.arrow(950, 442, 950, 500, SAGE)
    c.block(775, 500, 350, 92, "模型作答", "SSE 逐字流式下发", WHITE, SAGE)
    c.line([(775, 396), (600, 396), (600, 500)], CLAY, 2)
    c.arrow(600, 500, 600, 548, CLAY)
    c.text(675, 376, "不支持工具调用", 14, CLAY, True, anchor="ms")
    c.block(425, 548, 350, 92, "档案注入模式", "一次性注入档案 · 不再调用工具", CLAY_BG, CLAY)
    c.line([(775, 546), (730, 546), (730, 685), (600, 685)], CLAY, 2)
    c.text(720, 665, "模型调用失败", 14, CLAY, True, anchor="rs")
    c.arrow(600, 640, 600, 720, CLAY)
    c.block(425, 720, 350, 76, "降级提示", "如实说明暂不可用 · 核心业务继续", YELLOW_BG, YELLOW)
    c.line([(250, 442), (250, 845), (600, 845), (600, 796)], YELLOW, 2)
    c.line([(950, 592), (950, 845), (600, 845)], SAGE, 2)
    c.chip(475, 823, "统一响应出口", CREAM, INK, w=250)
    c.save("fig2-ai-paths.png")


def fig3():
    c = D(1080)
    c.title("Agent 工具调用时序", "一次真实调用返回 4 个 tool_calls；三轮为上限")
    lanes = [(145, "访客", SAGE_BG, SAGE), (425, "ai-stream", CLAY_BG, CLAY),
             (745, "对话模型", YELLOW_BG, YELLOW), (1040, "数据库", CREAM, LINE)]
    for x, name, bg, col in lanes:
        c.block(x - 105, 145, 210, 58, name, fill=bg, outline=col)
        c.line([(x, 203), (x, 820)], LINE, 1.5)
    rows = [
        (145, 425, "1  提问", SAGE),
        (425, 745, "2  携带工具清单请求", CLAY),
        (745, 425, "3  返回 4 个 tool_calls", YELLOW),
        (425, 1040, "4  经特权通道执行查询", CLAY),
        (1040, 425, "5  返回检索结果", SAGE),
        (425, 745, "6  带上工具结果再次请求", CLAY),
        (745, 425, "7  生成最终回答", YELLOW),
        (425, 145, "8  SSE 流式下发", SAGE),
    ]
    y = 250
    for a, b, label, col in rows:
        c.arrow(a, y, b, y, col, 2)
        c.text((a + b) / 2, y - 15, label, 15, INK, True, anchor="ms")
        y += 68
    c.rect(45, 860, 1110, 155, CREAM, LINE, 12)
    c.text(68, 884, "实测工具顺序", 16, INK, True)
    tools = ["search_pets", "check_requirement_gaps", "get_pet_profile", "get_adoption_policy"]
    x = 68
    for i, tool in enumerate(tools):
        w = c.chip(x, 922, tool, SAGE_BG if i % 2 == 0 else CLAY_BG,
                   SAGE if i % 2 == 0 else CLAY, True)
        x += w + 28
        if i < len(tools) - 1:
            c.text(x - 14, 937, "→", 18, MUTED, True, anchor="mm")
    c.text(68, 982, "三轮为上限；最后一轮不再向模型提供工具。", 15, MUTED)
    c.save("fig3-agent-sequence.png")


def fig4():
    c = D(980)
    c.title("数据访问的两条通道", "前端受 RLS 约束；云函数通过 ExecutePGSql 以表属主身份运行")
    c.text(70, 155, "通道一 · 匿名/普通访问", 20, SAGE, True)
    c.block(70, 205, 260, 78, "前端", "CloudBase JS SDK", SAGE_BG, SAGE, mono_body=True)
    c.arrow(330, 244, 465, 244, SAGE)
    c.block(465, 205, 270, 78, "CloudBase 网关", "携带匿名身份", WHITE, SAGE)
    c.arrow(735, 244, 870, 244, SAGE)
    c.block(870, 205, 260, 78, "PostgreSQL", "RLS 策略约束", WHITE, SAGE)
    c.chip(865, 300, "只能访问公开范围", SAGE_BG, SAGE, w=270)

    c.line([(55, 365), (1145, 365)], LINE, 1)
    c.text(70, 405, "通道二 · 服务端特权访问", 20, CLAY, True)
    c.block(70, 455, 260, 78, "云函数", "yard-api / ai-stream", CLAY_BG, CLAY, mono_body=True)
    c.arrow(330, 494, 465, 494, CLAY)
    c.block(465, 455, 270, 78, "腾讯云 OpenAPI", "ExecutePGSql", WHITE, CLAY, mono_body=True)
    c.arrow(735, 494, 870, 494, CLAY)
    c.block(870, 455, 260, 78, "PostgreSQL", "表属主身份 · 绕过 RLS", WHITE, CLAY)
    c.rect(70, 590, 1060, 165, CREAM, LINE, 12)
    c.text(92, 615, "仅允许通道二访问的表", 17, INK, True)
    names = ["applications", "yard_administrators", "yard_settings", "knowledge_chunks", "pet_photo_vectors"]
    x, y = 92, 660
    for name in names:
        w = c.chip(x, y, name, CLAY_BG, CLAY, True)
        if x + w > 1090:
            x, y = 92, y + 45
            w = c.chip(x, y, name, CLAY_BG, CLAY, True)
        x += w + 16
    c.rect(70, 805, 1060, 108, YELLOW_BG, YELLOW, 12)
    c.text(92, 828, "真实缺陷", 17, CLAY, True)
    c.text(92, 861, "云函数内部曾误用匿名身份数据库客户端 → 受 RLS 拒绝 → 后台多个功能长期不可用", 17, INK, True)
    c.text(92, 892, "修复：服务端受限数据统一改走 ExecutePGSql 特权通道。", 15, MUTED)
    c.save("fig4-data-channels.png")


def fig5():
    c = D(1020)
    c.title("RAG 检索与按需重建索引", "写入流、查询流与“索引是否落后”检查在同一知识层协同")
    c.text(60, 155, "写入流", 20, SAGE, True)
    sources = "宠物档案 / 领养要求\n领养政策 / 回访记录"
    c.block(60, 205, 250, 92, "领域语料", sources, SAGE_BG, SAGE)
    c.arrow(310, 251, 390, 251, SAGE)
    c.block(390, 205, 190, 92, "按字段切块", "保留来源标签", WHITE, SAGE)
    c.arrow(580, 251, 660, 251, SAGE)
    c.block(660, 205, 190, 92, "批量向量化", "1024 维", WHITE, SAGE)
    c.arrow(850, 251, 930, 251, SAGE)
    c.block(930, 195, 220, 112, "knowledge_chunks", "halfvec(1024)\nHNSW 余弦索引", CREAM, SAGE)

    c.line([(50, 365), (1150, 365)], LINE, 1)
    c.text(60, 405, "查询流", 20, CLAY, True)
    c.block(60, 455, 180, 82, "访客提问", fill=CLAY_BG, outline=CLAY)
    c.arrow(240, 496, 310, 496, CLAY)
    c.block(310, 455, 165, 82, "向量化", "同一模型", WHITE, CLAY)
    c.arrow(475, 496, 545, 496, CLAY)
    c.block(545, 445, 220, 102, "pgvector 检索", "余弦距离 · Top-K", WHITE, CLAY)
    c.arrow(765, 496, 835, 496, CLAY)
    c.block(835, 445, 150, 102, "阈值过滤", "≥ 0.3", YELLOW_BG, YELLOW)
    c.arrow(985, 496, 1040, 496, CLAY)
    c.block(1025, 445, 125, 102, "交给模型", "片段 / 来源", WHITE, CLAY)

    c.rect(210, 645, 780, 265, CREAM, LINE, 14)
    c.text(235, 672, "检索前旁支 · 按需重建", 19, INK, True)
    c.block(245, 725, 230, 76, "比较更新时间", "索引 vs. 档案", WHITE, LINE)
    c.arrow(475, 763, 585, 763, YELLOW)
    c.block(585, 715, 210, 96, "索引落后？", "否 → 直接检索", YELLOW_BG, YELLOW)
    c.arrow(795, 763, 930, 763, SAGE)
    c.text(852, 742, "是", 14, CLAY, True, anchor="ms")
    c.block(730, 835, 230, 56, "重建后再检索", fill=SAGE_BG, outline=SAGE)
    c.arrow(835, 811, 835, 835, CLAY)
    c.text(235, 860, "无需人工按钮或定时任务，不使用陈旧索引。", 15, MUTED)
    c.save("fig5-rag-index.png")


def fig6():
    c = D(980)
    c.title("数据模型与权限边界", "按正文当前清单绘制 10 张表；权限分为匿名可读、仅管理员、仅特权通道")
    c.text(60, 155, "业务表 · 7 张", 20, INK, True)
    business = [
        ("pets", "匿名可读", SAGE_BG, SAGE), ("pet_media", "匿名可读", SAGE_BG, SAGE),
        ("pet_updates", "匿名可读", SAGE_BG, SAGE), ("applications", "仅特权通道", CLAY_BG, CLAY),
        ("application_events", "仅管理员", YELLOW_BG, INK), ("yard_administrators", "仅特权通道", CLAY_BG, CLAY),
        ("yard_settings", "仅特权通道", CLAY_BG, CLAY),
    ]
    positions = [(60, 205), (345, 205), (630, 205), (915, 205), (202, 335), (487, 335), (772, 335)]
    for (name, perm, bg, col), (x, y) in zip(business, positions):
        c.rect(x, y, 225, 96, WHITE, LINE, 10)
        c.text(x + 18, y + 26, name, 16, INK, True, True)
        c.chip(x + 18, y + 52, perm, bg, col, w=145)

    c.line([(50, 470), (1150, 470)], LINE, 1)
    c.text(60, 505, "限频表 · 1 张", 20, INK, True)
    c.rect(60, 555, 330, 96, WHITE, LINE, 10)
    c.text(80, 582, "rate_limit_events", 16, INK, True, True)
    c.chip(80, 607, "仅特权通道", CLAY_BG, CLAY, w=145)

    c.text(470, 505, "向量表 · 2 张", 20, INK, True)
    for i, name in enumerate(("knowledge_chunks", "pet_photo_vectors")):
        x = 470 + i * 340
        c.rect(x, 555, 300, 96, WHITE, LINE, 10)
        c.text(x + 20, 582, name, 16, INK, True, True)
        c.chip(x + 20, 607, "仅特权通道", CLAY_BG, CLAY, w=145)

    c.rect(60, 720, 1080, 150, CREAM, LINE, 12)
    c.text(85, 747, "权限图例", 17, INK, True)
    c.chip(85, 792, "匿名可读", SAGE_BG, SAGE, w=155)
    c.chip(265, 792, "仅管理员", YELLOW_BG, INK, w=155)
    c.chip(445, 792, "仅特权通道", CLAY_BG, CLAY, w=175)
    c.text(650, 807, "写入与敏感读取由服务端二次鉴权。", 16, MUTED, anchor="lm")
    c.text(60, 925, "注：任务规格称“11 张表”，但列出的分组为 7 + 1 + 2 = 10 张；本图不臆造缺失表。", 15, CLAY)
    c.save("fig6-data-permissions.png")


def fig7():
    c = D(760)
    c.title("向量模型语义方向实测", "相关句对的余弦相似度高于无关句对，检索方向符合预期")
    c.rect(70, 160, 1060, 410, WHITE, LINE, 14)
    c.text(105, 192, "余弦相似度", 16, MUTED, True)
    base_y, chart_h = 510, 260
    c.line([(140, base_y), (1060, base_y)], LINE, 1.5)
    for value in (0.0, 0.1, 0.2, 0.3, 0.4, 0.5):
        y = base_y - chart_h * value / 0.5
        c.line([(140, y), (1060, y)], "#E5DFD6", 1)
        c.text(122, y, f"{value:.1f}", 13, MUTED, anchor="rm")
    bars = [(360, 0.4447, "领养相关 与 领养相关", SAGE), (760, 0.2566, "领养相关 与 无关句", CLAY)]
    for x, val, label, color in bars:
        top = base_y - chart_h * val / 0.5
        c.rect(x - 95, top, 190, base_y - top, color, color, 8, 0)
        c.text(x, top - 18, f"{val:.4f}", 25, color, True, anchor="ms")
        c.text(x, base_y + 26, label, 16, INK, True, anchor="ma")
    c.rect(70, 615, 1060, 90, CREAM, LINE, 12)
    c.chip(95, 645, "kinfra-text-embedding-0.6b", SAGE_BG, SAGE, True)
    c.chip(455, 645, "1024 维", YELLOW_BG, INK, False, w=145)
    c.chip(625, 645, "单次约 350 ms", CLAY_BG, CLAY, False, w=210)
    c.text(875, 661, "方向验证通过", 17, SAGE, True, anchor="lm")
    c.save("fig7-embedding-test.png")


def main():
    for fn in (fig1, fig2, fig3, fig4, fig5, fig6, fig7):
        fn()
    print(f"Generated 7 figures in {OUT}")


if __name__ == "__main__":
    main()
