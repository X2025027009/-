"""把指令与正文合成一份自包含的交付文件。

用途：Codex 若读不到仓库，仅传这一份即可完成全部工作。
指令部分不含「交接状态」（那是给委托方看的），正文全文附在后面。

正文或指令若后续改动，重新运行本脚本即可重新生成：

    python docs/build_handoff.py
"""
import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))
INSTRUCTION = os.path.join(BASE, '给Codex的指令.md')
CONTENT = os.path.join(BASE, '技术文档-正文.md')
OUT = os.path.join(BASE, '交给Codex-完整指令.md')

instruction = open(INSTRUCTION, encoding='utf-8').read()
content = open(CONTENT, encoding='utf-8').read()

# 去掉给委托方看的交接状态一节
instruction = re.sub(
    r'## 交接状态（委托方阅读，不必复制给 Codex）.*?\n---\n\n',
    '', instruction, flags=re.S)
# 去掉面向委托方的使用说明
instruction = re.sub(r'^> \*\*使用方法.*?\n> 「交接状态」.*?\n', '', instruction,
                     flags=re.S | re.M)
instruction = instruction.replace('# 技术文档配图与排版 · 工作指令', '').strip()

HEADER = """# 技术文档配图与排版 · 完整工作指令

这两部分合起来就是完整任务：**第一部分是指令，第二部分是文档正文**。
正文全文附在指令之后，因此这一份文件可以直接交给 Codex，无需再传别的文本。

两份需另行提供的素材（图片无法写在文本里，请作为附件一并给出）：

- `docs/screenshots/fig9-review.png` —— 图 9 的截图，已由委托方提供
- `assets/team-photo.jpg` —— 封面顶部要用的小院合影

---

# 第一部分　工作指令

"""

MID = """

---

# 第二部分　文档正文

> 以下为技术文档全文。文中的 `> **【插入图 N】标题**` 标记图片位置，
> `> 图注：...` 给出图注，Markdown 表格排版时转为三线表。

"""

output = HEADER + instruction + MID + content
open(OUT, 'w', encoding='utf-8').write(output)

print('指令部分 %d 字符' % len(instruction))
print('正文部分 %d 字符' % len(content))
print('合计 %d 字符（约 %.0f KB）' % (len(output), len(output.encode('utf-8')) / 1024))
