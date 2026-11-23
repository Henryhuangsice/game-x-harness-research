#!/usr/bin/env python3
"""Fetch public Bilibili stats for the videos cited in q4.md and render them as a table (data/bili-stats.html; render the PNG with shoot-html.mjs).

  python3 tools/bili-stats.py && node tools/shoot-html.mjs data/bili-stats.html ../../answers/media/q4/bili-stats.png
Data comes from the public endpoint api.bilibili.com/x/web-interface/view (no login). Numbers change over time.
"""
import datetime, html, json, urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'data'
VIDEOS = [  # (category, bvid)
    ('AI 玩游戏', 'BV1EDFezjEdY'), ('AI 玩游戏', 'BV1rAZkBeEWq'), ('AI 玩游戏', 'BV1ZKYw6QEhg'), ('AI 对抗赛', 'BV1JkWH64ESy'),
    ('AI 工具教程', 'BV1KjoxBoEQJ'), ('AI 工具教程', 'BV1NvRyBzEhq'),
    ('2023 年的课程，标题写着 Claude Code', 'BV1LY4y1d7cL'), ('2023 年的课程，标题写着 Claude Code', 'BV17P411m7Ma'),
]
rows = []
for cat, bv in VIDEOS:
    req = urllib.request.Request(f'https://api.bilibili.com/x/web-interface/view?bvid={bv}', headers={'User-Agent': 'Mozilla/5.0'})
    v = json.load(urllib.request.urlopen(req))['data']; s = v['stat']
    rows.append(dict(cat=cat, bv=bv, title=v['title'], up=v['owner']['name'], date=str(datetime.date.fromtimestamp(v['pubdate'])),
                     view=s['view'], dm=s['danmaku'], like=s['like'], coin=s['coin'], fav=s['favorite'], share=s['share'],
                     dm_per_10k=round(s['danmaku'] / s['view'] * 1e4, 1), fav_per_like=round(s['favorite'] / max(s['like'], 1), 2)))
(OUT / 'bili-stats.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1))

w = lambda n: f'{n/1e4:.1f}万' if n >= 1e4 else str(n)
trs = ''.join(
    f"<tr class='{'bad' if r['dm_per_10k'] < 1 else ''}'><td>{html.escape(r['cat'])}</td><td>{html.escape(r['title'][:34])}<br><small>{html.escape(r['up'])} · {r['date']} · {r['bv']}</small></td>"
    f"<td>{w(r['view'])}</td><td>{w(r['dm'])}</td><td><b>{r['dm_per_10k']}</b></td><td>{w(r['like'])}</td><td>{w(r['fav'])}</td><td><b>{r['fav_per_like']}</b></td></tr>"
    for r in rows)
(OUT / 'bili-stats.html').write_text(f"""<!doctype html><meta charset="utf-8"><style>
body{{margin:0;font:15px/1.4 -apple-system,'PingFang SC',sans-serif;background:#fff}} .win{{padding:22px 26px}}
h1{{font-size:19px;margin:0 0 6px}} p{{margin:0 0 14px;color:#666;font-size:13px}} table{{border-collapse:collapse;width:100%}}
th,td{{border-bottom:1px solid #e5e5e5;padding:8px 10px;text-align:right;vertical-align:top}} th:nth-child(-n+2),td:nth-child(-n+2){{text-align:left}}
th{{background:#f6f7f9;font-weight:600}} td:nth-child(n+3),th:nth-child(n+3){{white-space:nowrap}} td:first-child{{width:150px}} small{{color:#888}} tr.bad td{{background:#fff1f0}} .foot{{margin-top:10px;font-size:12px;color:#888}}
</style><div class="win"><h1>B 站同类视频：播放量会骗人，弹幕和收藏不会</h1>
<p>弹幕/万播 = 每一万次播放有多少条弹幕（看的人有没有在"参与"）；藏/赞 = 收藏数 ÷ 点赞数（大于 1 说明"有用、要回看"）。</p>
<table><tr><th>类型</th><th>视频</th><th>播放</th><th>弹幕</th><th>弹幕/万播</th><th>点赞</th><th>收藏</th><th>藏/赞</th></tr>{trs}</table>
<div class="foot">数据：B 站公开接口 api.bilibili.com/x/web-interface/view，{datetime.date.today()} 抓取，由 answers-v2/tools/bili-stats.py 生成</div></div>""")
print(json.dumps(rows, ensure_ascii=False)[:600])
