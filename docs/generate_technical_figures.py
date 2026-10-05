"""Generate the seven technical figures used by the competition document.

The diagrams are intentionally drawn with Pillow rather than office chart
defaults so their typography, colour and spacing remain consistent with the
website.  Logical pixels are rendered at 3x and tagged as 300 DPI.
"""

from __future__ import annotations

import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from figures import (  # noqa: E402
    Canvas,
    CLAY,
    CLAY_BG,
    CREAM,
    INK,
    LINE,
    MUTED,
    PAPER,
    SAGE,
    SAGE_BG,
    YELLOW,
    YELLOW_BG,
)


BASE = os.path.dirname(os.path.abspath(__file__))
FIG_DIR = os.path.join(BASE, "figures")
BUILD_DIR = os.path.join(BASE, "build")
os.makedirs(FIG_DIR, exist_ok=True)
os.makedirs(BUILD_DIR, exist_ok=True)


def save(c: Canvas, filename: str) -> str:
    path = c.save(os.path.join(FIG_DIR, filename))
    shutil.copy2(path, os.path.join(BUILD_DIR, filename))
    return path


def lane_label(c: Canvas, x: int, y: int, text: str, color=SAGE) -> None:
    c.box(x, y, 126, 34, text, fill=PAPER, border=color, radius=17, bold_first=True)


def figure_1_architecture() -> str:
    c = Canvas(1060, 650)
    c.title(34, 24, "整体系统架构")
    c.caption(34, 54, "浏览器经 CloudBase 网关访问两条相互独立的链路；AI 异常不会阻断业务请求。")

    c.box(350, 84, 360, 68, ["浏览器", "原生 JavaScript + CSS · 无构建步骤"], CREAM, LINE, bold_first=True)
    c.arrow(530, 152, 530, 190, SAGE)
    c.box(350, 190, 360, 58, ["CloudBase 网关", "统一入口与鉴权边界"], SAGE_BG, SAGE, bold_first=True)

    # Split after the gateway and keep the two tracks visually separate.
    c.arrow(530, 248, 280, 292, SAGE)
    c.arrow(530, 248, 780, 292, CLAY)
    lane_label(c, 80, 278, "业务链路", SAGE)
    lane_label(c, 854, 278, "AI 链路", CLAY)

    c.box(90, 330, 380, 74, ["云函数 yard-api", "Event · 申请 / 档案 / 后台业务"], SAGE_BG, SAGE, bold_first=True)
    c.arrow(280, 404, 280, 448, SAGE)
    c.box(90, 448, 380, 74, ["PostgreSQL", "业务数据 · RLS 策略"], CREAM, SAGE, bold_first=True)

    c.box(590, 330, 380, 74, ["云函数 ai-stream", "HTTP · SSE 流式输出"], CLAY_BG, CLAY, bold_first=True)
    c.arrow(780, 404, 780, 448, CLAY)
    c.box(590, 448, 380, 96, ["模型服务", "对话模型 · 向量模型 · 视觉模型"], CREAM, CLAY, bold_first=True)

    c.box(224, 566, 300, 54, ["PostgreSQL + pgvector", "结构化数据与向量索引"], CREAM, LINE, bold_first=True)
    c.box(536, 566, 300, 54, ["对象存储", "宠物照片与站点素材"], CREAM, LINE, bold_first=True)
    c.arrow(280, 522, 374, 566, SAGE)
    c.arrow(780, 544, 686, 566, CLAY)
    c.label(530, 635, "两条链路分别部署、分别降级", 12, INK, bold=True, anchor="ma")
    return save(c, "fig1-architecture.png")


def figure_2_fallback() -> str:
    c = Canvas(1060, 620)
    c.title(34, 24, "AI 请求链路与降级路径")
    c.caption(34, 54, "分支在进入模型、工具协商与模型调用失败时分别触发，连线互不交叉。")

    x, w = 380, 300
    c.box(x, 86, w, 52, "访客提问", CREAM, LINE, bold_first=True)
    c.arrow(530, 138, 530, 174, SAGE)
    c.box(x, 174, w, 58, ["解析模型 Key", "决定真实调用或演示模式"], SAGE_BG, SAGE, bold_first=True)
    c.arrow(530, 232, 530, 278, SAGE)
    c.label(506, 252, "有 Key", 11, SAGE, bold=True, anchor="ra")
    c.box(x, 278, w, 62, ["工具循环", "最多三轮"], SAGE_BG, SAGE, bold_first=True)
    c.arrow(530, 340, 530, 386, SAGE)
    c.box(x, 386, w, 58, ["模型作答", "SSE 流式下发"], CREAM, SAGE, bold_first=True)
    c.arrow(530, 444, 530, 490, SAGE)
    c.box(x, 490, w, 52, "访客看到完整回答", CREAM, LINE, bold_first=True)

    c.arrow(380, 203, 176, 203, YELLOW)
    c.label(276, 184, "无 Key", 11, (164, 124, 26), bold=True, anchor="ma")
    c.box(34, 174, 286, 58, ["演示模式", "返回内置示例回复"], YELLOW_BG, YELLOW, bold_first=True)

    c.arrow(680, 309, 884, 309, CLAY)
    c.label(782, 290, "不支持工具调用", 11, CLAY, bold=True, anchor="ma")
    c.box(740, 278, 286, 62, ["档案注入模式", "不再调用工具"], CLAY_BG, CLAY, bold_first=True)

    c.arrow(680, 415, 884, 415, YELLOW)
    c.label(782, 396, "模型调用失败", 11, (164, 124, 26), bold=True, anchor="ma")
    c.box(740, 386, 286, 58, ["降级回复", "保留核心业务可用"], YELLOW_BG, YELLOW, bold_first=True)

    c.label(530, 578, "业务提交与 AI 回答相互独立；任何降级都不修改申请或档案状态。", 12, MUTED, anchor="ma")
    return save(c, "fig2-fallback.png")


def figure_3_sequence() -> str:
    c = Canvas(1120, 650)
    c.title(34, 24, "Agent 工具调用时序")
    c.caption(34, 54, "一次真实调用的四泳道顺序；工具查询通过特权通道访问数据库。")
    lanes = [("访客", 110), ("ai-stream", 390), ("对话模型", 700), ("数据库", 1010)]
    for name, x in lanes:
        c.box(x - 70, 84, 140, 38, name, CREAM, LINE, bold_first=True)
        c.arrow(x, 124, x, 500, LINE, 1.0, dash=9, head=False)

    steps = [
        (110, 390, 156, "1  提问"),
        (390, 700, 198, "2  携带工具清单请求"),
        (700, 390, 240, "3  返回 4 个 tool_calls"),
        (390, 1010, 282, "4  执行查询（特权通道）"),
        (1010, 390, 324, "5  返回检索结果"),
        (390, 700, 366, "6  带上结果再次请求"),
        (700, 390, 408, "7  生成最终回答"),
        (390, 110, 450, "8  SSE 流式下发"),
    ]
    for x1, x2, y, label in steps:
        color = SAGE if x2 > x1 else CLAY
        c.arrow(x1, y, x2, y, color, 1.5)
        c.label((x1 + x2) / 2, y - 18, label, 11, INK, anchor="ma")

    c.box(54, 530, 1012, 64,
          ["search_pets  →  check_requirement_gaps  →  get_pet_profile  →  get_adoption_policy",
           "三轮为上限；最后一轮不再提供工具，模型必须基于已有结果作答。"],
          SAGE_BG, SAGE, bold_first=True)
    return save(c, "fig3-agent-sequence.png")


def figure_4_data_access() -> str:
    c = Canvas(1120, 650)
    c.title(34, 24, "数据访问的两条通道")
    c.caption(34, 54, "前端直连受 RLS 约束；受限表必须由云函数通过腾讯云 OpenAPI 访问。")

    lane_label(c, 78, 90, "通道一", SAGE)
    c.box(62, 148, 210, 62, ["前端", "匿名 / 登录身份"], SAGE_BG, SAGE, bold_first=True)
    c.arrow(272, 179, 340, 179, SAGE)
    c.box(340, 148, 220, 62, ["CloudBase 网关", "身份透传"], CREAM, SAGE, bold_first=True)
    c.arrow(560, 179, 630, 179, SAGE)
    c.box(630, 148, 220, 62, ["PostgreSQL", "RLS 策略约束"], CREAM, SAGE, bold_first=True)
    c.box(888, 140, 190, 78, ["公开数据", "按策略可读 / 可写"], PAPER, SAGE, bold_first=True)
    c.arrow(850, 179, 888, 179, SAGE)

    lane_label(c, 78, 274, "通道二", CLAY)
    c.box(62, 332, 210, 62, ["云函数", "服务端鉴权"], CLAY_BG, CLAY, bold_first=True)
    c.arrow(272, 363, 340, 363, CLAY)
    c.box(340, 332, 220, 62, ["腾讯云 OpenAPI", "ExecutePGSql"], CREAM, CLAY, bold_first=True)
    c.arrow(560, 363, 630, 363, CLAY)
    c.box(630, 332, 220, 62, ["PostgreSQL", "以表属主身份运行"], CREAM, CLAY, bold_first=True)
    c.box(888, 324, 190, 78, ["受限数据", "绕过 RLS · 仅服务端"], PAPER, CLAY, bold_first=True)
    c.arrow(850, 363, 888, 363, CLAY)

    c.box(62, 446, 1016, 76,
          ["仅允许通道二访问的表",
           "applications · yard_administrators · yard_settings · knowledge_chunks · pet_photo_vectors"],
          CREAM, LINE, bold_first=True)
    c.box(62, 548, 1016, 60,
          ["已发现并修复的真实缺陷", "云函数误用匿名数据库客户端 → 受 RLS 拒绝 → 后台多个功能长期不可用"],
          CLAY_BG, CLAY, bold_first=True)
    return save(c, "fig4-data-access.png")


def figure_5_rag() -> str:
    c = Canvas(1160, 710)
    c.title(34, 24, "RAG 检索与按需重建索引")
    c.caption(34, 54, "写入流形成向量语料，查询流检索 Top-K；检索前按更新时间检查并按需重建。")

    lane_label(c, 32, 92, "写入流", SAGE)
    sources = ["宠物档案", "领养要求", "领养政策", "回访记录"]
    for i, name in enumerate(sources):
        c.box(32 + i * 142, 150, 126, 48, name, CREAM, LINE, bold_first=True)
    c.arrow(600, 174, 672, 174, SAGE)
    c.box(672, 146, 150, 56, ["按字段切块", "保留来源标签"], SAGE_BG, SAGE, bold_first=True)
    c.arrow(822, 174, 876, 174, SAGE)
    c.box(876, 146, 128, 56, "批量向量化", SAGE_BG, SAGE, bold_first=True)
    c.arrow(1004, 174, 1050, 174, SAGE)
    c.box(1022, 218, 110, 92, ["knowledge_", "chunks", "1024 维"], CREAM, SAGE, bold_first=True)
    c.arrow(1077, 202, 1077, 218, SAGE)
    c.label(1077, 326, "HNSW 余弦索引", 10.5, MUTED, anchor="ma")

    lane_label(c, 32, 330, "查询流", CLAY)
    nodes = [
        (32, 396, 152, ["访客提问", "自然语言"]),
        (226, 396, 152, ["向量化", "1024 维"]),
        (420, 396, 184, ["pgvector 检索", "余弦距离 Top-K"]),
        (646, 396, 184, ["阈值过滤", "相似度 ≥ 0.3"]),
        (872, 396, 246, ["交给模型", "命中片段 + 来源标签"]),
    ]
    for x, y, w, lines in nodes:
        c.box(x, y, w, 64, lines, CLAY_BG if x in (226, 646) else CREAM, CLAY if x in (226, 646) else LINE, bold_first=True)
    for x1, x2 in [(184, 226), (378, 420), (604, 646), (830, 872)]:
        c.arrow(x1, 428, x2, 428, CLAY)

    c.box(380, 540, 400, 66, ["检索前检查", "索引最新时间  ≥  档案最新时间？"], YELLOW_BG, YELLOW, bold_first=True)
    c.arrow(580, 540, 580, 460, YELLOW)
    c.label(596, 500, "是：直接检索", 10.5, (164, 124, 26), bold=True)
    c.arrow(780, 573, 954, 573, YELLOW)
    c.box(954, 540, 164, 66, ["落后：重建", "再继续检索"], YELLOW_BG, YELLOW, bold_first=True)
    c.label(866, 552, "否", 10.5, (164, 124, 26), bold=True, anchor="ma")
    c.caption(32, 660, "按需重建避免人工操作遗漏，也不会在档案更新后继续使用陈旧索引。")
    return save(c, "fig5-rag.png")


def table_card(c: Canvas, x: int, y: int, w: int, title: str, items: list[tuple[str, str]], color) -> None:
    h = 56 + 42 * len(items)
    c.draw.rounded_rectangle(
        [c._s(x), c._s(y), c._s(x + w), c._s(y + h)],
        radius=c._s(8), fill=CREAM, outline=color, width=c._s(1.4)
    )
    c.draw.rectangle([c._s(x), c._s(y), c._s(x + w), c._s(y + 46)], fill=color)
    c.label(x + 18, y + 23, title, 13, PAPER, bold=True, anchor="lm")
    for i, (name, perm) in enumerate(items):
        yy = y + 66 + i * 42
        c.label(x + 18, yy, name, 10.5, INK, mono=True, anchor="lm")
        badge = SAGE if perm == "匿名可读" else (CLAY if perm == "仅管理员" else MUTED)
        c.label(x + w - 16, yy, perm, 10.5, badge, bold=True, anchor="rm")


def figure_6_data_model() -> str:
    c = Canvas(1160, 720)
    c.title(34, 24, "数据模型与权限边界")
    c.caption(34, 54, "正文逐项列出的 10 张表按业务、限频和向量用途分组；权限以最小开放原则划分。")

    business = [
        ("pets", "匿名可读"),
        ("pet_media", "匿名可读"),
        ("pet_updates", "匿名可读"),
        ("applications", "仅管理员"),
        ("application_events", "仅管理员"),
        ("yard_administrators", "仅特权通道"),
        ("yard_settings", "仅特权通道"),
    ]
    vectors = [("knowledge_chunks", "仅特权通道"), ("pet_photo_vectors", "仅特权通道")]
    table_card(c, 34, 96, 520, "业务表 · 7", business, SAGE)
    table_card(c, 590, 96, 536, "向量表 · 2", vectors, CLAY)
    table_card(c, 590, 284, 536, "限频表 · 1", [("rate_limit_events", "仅特权通道")], YELLOW)
    c.box(590, 430, 536, 112,
          ["权限说明", "匿名可读：公开展示数据", "仅管理员：经服务端校验", "仅特权通道：不向客户端开放"],
          PAPER, LINE, bold_first=True)
    c.box(590, 576, 536, 62,
          ["待核对", "正文写“11 张表”，但列出的三组共 10 张。"],
          YELLOW_BG, YELLOW, bold_first=True)
    c.caption(34, 690, "图中不补造未在正文或迁移文件中出现的表名；数量差异已列入交付报告。")
    return save(c, "fig6-data-model.png")


def figure_7_similarity() -> str:
    c = Canvas(960, 560)
    c.title(34, 24, "向量模型语义方向实测")
    c.caption(34, 54, "相关文本的余弦相似度明显高于无关文本，说明检索方向正确。")
    c.bar_chart(
        120,
        118,
        720,
        250,
        [("领养相关两句", 0.4447), ("领养相关 vs 无关句", 0.2566)],
        max_value=0.55,
        highlight={"领养相关 vs 无关句"},
    )
    c.box(90, 432, 780, 76,
          ["kinfra-text-embedding-0.6b", "输出 1024 维 · 单次调用约 350 ms · 余弦相似度越高表示语义越接近"],
          SAGE_BG, SAGE, bold_first=True)
    return save(c, "fig7-similarity.png")


if __name__ == "__main__":
    outputs = [
        figure_1_architecture(),
        figure_2_fallback(),
        figure_3_sequence(),
        figure_4_data_access(),
        figure_5_rag(),
        figure_6_data_model(),
        figure_7_similarity(),
    ]
    for output in outputs:
        print(output)
