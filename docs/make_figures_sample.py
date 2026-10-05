"""生成技术文档配图（样张）。

三张图覆盖三种类型，用来确认绘图风格是否可用：
  图 1  请求链路与降级路径（流程图，含分支）
  图 2  Agent 工具调用时序（时序图，四泳道）
  图 3  语义检索相似度实测（数据图，真实测量值）
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from figures import (Canvas, SAGE, SAGE_BG, CLAY, CLAY_BG, YELLOW, YELLOW_BG,
                     CREAM, LINE, MUTED, INK, PAPER)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build')
os.makedirs(OUT, exist_ok=True)


# ── 图 1：请求链路与降级路径 ────────────────────────────────
def figure_pipeline():
    c = Canvas(880, 470)
    c.title(30, 22, '图 1  AI 请求链路与降级路径')

    # 主链路居中成一列，分支一律向右，避免连线交叉
    main_x, main_w = 250, 200
    branch_x, branch_w = 580, 250

    c.box(main_x, 70, main_w, 54, '访客提问', CREAM)
    c.arrow(main_x + main_w / 2, 124, main_x + main_w / 2, 158)

    c.box(main_x, 158, main_w, 54, '解析模型 Key', SAGE_BG, SAGE)
    c.arrow(main_x + main_w / 2, 212, main_x + main_w / 2, 246)

    c.box(main_x, 246, main_w, 54, '工具循环（最多三轮）', SAGE_BG, SAGE)
    c.arrow(main_x + main_w / 2, 300, main_x + main_w / 2, 334)

    c.box(main_x, 334, main_w, 54, '模型作答（SSE 流式）', CREAM)

    # 分支一：没有 Key 时走演示模式
    c.arrow(main_x + main_w, 185, branch_x, 185, YELLOW)
    c.label((main_x + main_w + branch_x) / 2, 168, '无 Key', 11.5, (176, 138, 40), bold=True, anchor='ma')
    c.box(branch_x, 158, branch_w, 54, '演示模式：内置示例回复', YELLOW_BG, YELLOW)

    # 分支二：模型不支持工具调用时退回档案注入
    c.arrow(main_x + main_w, 273, branch_x, 273, CLAY)
    c.label((main_x + main_w + branch_x) / 2, 256, '工具不可用', 11.5, CLAY, bold=True, anchor='ma')
    c.box(branch_x, 246, branch_w, 54, '退回档案注入（不再调用工具）', CLAY_BG, CLAY)

    c.label(main_x, 250, '有 Key', 11.5, SAGE, bold=True, anchor='ra')
    c.label(main_x, 338, '正常路径', 11.5, MUTED, anchor='ra')

    c.caption(30, 415, '说明：前两个分支在每次请求时判定；第三个分支只在模型不支持工具调用时触发，')
    c.caption(30, 434, '目的是让 AI 匹配助手不会因为工具层故障而整体失效。')
    return c.save(os.path.join(OUT, 'fig1-pipeline.png'))


# ── 图 2：Agent 工具调用时序 ────────────────────────────────
def figure_sequence():
    c = Canvas(880, 470)
    c.title(30, 22, '图 2  Agent 工具调用时序（实测一次四工具调用）')

    lanes = [('访客', 92), ('ai-stream', 300), ('对话模型', 512), ('数据库', 742)]
    for name, x in lanes:
        c.box(x - 62, 70, 124, 34, name, CREAM)
        c.arrow(x, 106, x, 400, LINE, 1.0, dash=9, head=False)

    steps = [
        (92, 300, 138, '提问'),
        (300, 512, 172, '携带工具清单请求'),
        (512, 300, 206, '返回 4 个 tool_calls'),
        (300, 742, 240, '执行查询（特权通道）'),
        (742, 300, 274, '返回检索结果'),
        (300, 512, 308, '带上结果再次请求'),
        (512, 300, 342, '生成最终回答'),
        (300, 92, 376, 'SSE 流式下发'),
    ]
    for x1, x2, y, text in steps:
        c.arrow(x1, y, x2, y, SAGE if x2 > x1 else CLAY, 1.3)
        mid = (x1 + x2) / 2
        c.label(mid, y - 17, text, 11, MUTED, anchor='ma')

    c.label(92, 402, '实测工具：search_pets → check_requirement_gaps → get_pet_profile → get_adoption_policy', 11.5, INK)
    c.caption(92, 424, '三轮为上限，最后一轮不再提供工具，强制模型基于已有信息作答，避免反复查询消耗额度。')
    return c.save(os.path.join(OUT, 'fig2-sequence.png'))


# ── 图 3：语义检索相似度实测 ────────────────────────────────
def figure_similarity():
    c = Canvas(760, 400)
    c.title(30, 22, '图 3  向量模型的语义方向实测')

    c.bar_chart(70, 90, 620, 200,
                [('领养相关（两句之间）', 0.4447), ('领养相关 vs 无关句', 0.2566)],
                max_value=0.55, highlight={'领养相关 vs 无关句'})

    c.label(70, 320, '做法：取三句固定文本，两句属于领养场景、一句与领养无关，', 11.5, MUTED)
    c.label(70, 340, '分别向量化后比较余弦相似度。相关的高于无关的，说明检索方向正确。', 11.5, MUTED)
    c.label(70, 362, '模型 kinfra-text-embedding-0.6b，输出 1024 维，单次调用约 350 ms。', 11.5, MUTED)
    return c.save(os.path.join(OUT, 'fig3-similarity.png'))


if __name__ == '__main__':
    for path in (figure_pipeline(), figure_sequence(), figure_similarity()):
        print(path)
