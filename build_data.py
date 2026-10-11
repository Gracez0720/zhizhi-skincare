#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 skincare_database 生成 /workspace/data/products.js —— 图片与产品名严格对应。"""
import sqlite3, json, os, re, shutil, hashlib

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, 'upload/extracted/skincare_database/database.sqlite')
IMG_SRC = os.path.join(BASE, 'upload/extracted/skincare_database/images')
OUT_IMG = os.path.join(BASE, 'images')
os.makedirs(OUT_IMG, exist_ok=True)

c = sqlite3.connect(DB); c.row_factory = sqlite3.Row

def j(v):
    if v in (None, '', 'null'): return None
    try: return json.loads(v)
    except Exception: return None

def clean(s):
    if s is None: return ''
    s = str(s)
    s = re.sub(r'（[^）]*待核实[^）]*）|\([^)]*待核实[^)]*\)', '', s)
    s = re.sub(r'（版本未确认）|（笔记俗称）|（正式名待核实）', '', s)
    return s.strip()

L2_CN = {'洁面':'洁面','卸妆':'卸妆','身体护理':'身体护理','精华':'精华','面膜':'面膜',
         '唇部护理':'唇部护理','防晒':'防晒','身体清洁':'身体清洁','角质调理':'角质调理',
         '局部护理':'局部护理','眼周护理':'眼周护理','乳液':'乳液','面霜':'面霜',
         '化妆水':'化妆水','特定部位护理':'特定部位护理','颈胸护理':'颈胸护理',
         '手部护理':'手部护理','局部护理贴':'局部护理贴'}

# ---- 评论/笔记索引 ----
notes = {r['note_id']: r for r in c.execute('SELECT * FROM notes')}
comments_by_prod = {}
comments_by_note = {}
for r in c.execute('SELECT * FROM comments'):
    if r['product_id']:
        comments_by_prod.setdefault(r['product_id'], []).append(r)
    comments_by_note.setdefault(r['note_id'], []).append(r)

# 产品关联的全部 note_id（经 product_sources -> sources.note_id）
src_note = {r['source_id']: r['note_id'] for r in c.execute('SELECT source_id, note_id FROM sources')}
prod_notes = {}
for r in c.execute('SELECT product_id, source_id FROM product_sources'):
    nid = src_note.get(r['source_id'])
    if nid:
        prod_notes.setdefault(r['product_id'], set()).add(nid)

img_by_id = {r['image_id']: r for r in c.execute('SELECT * FROM images')}
imgs_by_prod = {}
for r in c.execute('SELECT * FROM images'):
    if r['product_id']:
        imgs_by_prod.setdefault(r['product_id'], []).append(r)

# 价格观测（CNY 优先）
prices_by_prod = {}
for r in c.execute('SELECT * FROM prices WHERE amount IS NOT NULL'):
    prices_by_prod.setdefault(r['product_id'], []).append(r)

products = []
for r in c.execute('SELECT * FROM products'):
    pid = r['product_id']
    name = clean(r['name_zh']) or clean(r['brand']) or '未命名产品'
    brand = clean(r['brand'])
    if brand and brand not in name and brand not in ('null',):
        display = brand + ' ' + name
    else:
        display = name
    ure = j(r['user_reported_effects']) or {}
    use = j(r['user_skin_experiences']) or {}
    adv = r['adverse_experiences']

    # 图片：优先 is_preferred / is_product_closeup，复制到 images/<pid>/
    imgs = sorted(imgs_by_prod.get(pid, []),
                  key=lambda x: (-(x['is_preferred'] or 0), -(x['is_product_closeup'] or 0)))
    rel_imgs = []
    for k, im in enumerate(imgs):
        src = os.path.join(os.path.dirname(IMG_SRC), im['path'])
        if not os.path.exists(src):
            src = os.path.join(BASE, 'upload/extracted/skincare_database', im['path'])
        if os.path.exists(src):
            ext = os.path.splitext(im['path'])[1] or '.webp'
            dst_dir = os.path.join(OUT_IMG, pid)
            os.makedirs(dst_dir, exist_ok=True)
            dst = os.path.join(dst_dir, 'img_%d%s' % (k, ext))
            shutil.copyfile(src, dst)
            rel_imgs.append('images/%s/img_%d%s' % (pid, k, ext))

    # 真实评论（含正/负反馈）
    real_comments = []
    for cm in comments_by_prod.get(pid, []):
        ex = cm['excerpt_or_summary']
        if not ex: continue
        real_comments.append({
            'skin': cm['skin_self_report'] or '',
            'duration': cm['duration'] or '',
            'pos': cm['positive_feedback'],
            'neg': cm['negative_feedback'],
            'text': ex,
            'status': cm['actual_user_status'] or '',
            'time': cm['visible_time'] or '',
        })

    # 关联笔记
    ns = []
    for nid in list(prod_notes.get(pid, set()))[:4]:
        n = notes.get(nid)
        if n:
            ns.append({'title': n['title'], 'url': n['url'], 'likes': n['likes'],
                       'summary': n['summary'], 'published': n['published_at']})

    # 价格：优先 CNY
    price = ''
    for pr in sorted(prices_by_prod.get(pid, []), key=lambda x: (x['currency'] != 'CNY')):
        if pr['currency'] == 'CNY':
            price = '%d 元' % int(pr['amount']); break
    if not price:
        for pr in prices_by_prod.get(pid, []):
            if pr['currency']:
                price = '%s %s' % (pr['currency'], int(pr['amount'])); break
    price_cny = None
    for pr in prices_by_prod.get(pid, []):
        if pr['currency'] == 'CNY':
            price_cny = float(pr['amount']); break

    products.append({
        'id': pid,
        'name': display,
        'raw_name': r['name_zh'],
        'brand': brand,
        'l1': r['category_l1'] or '',
        'l2': r['category_l2'] or '',
        'form': r['form'] or '',
        'capacity': ('%s%s' % (int(r['capacity_value']), r['capacity_unit'])) if r['capacity_value'] and r['capacity_unit'] else '',
        'texture': r['texture'] or '',
        'scent': r['scent'] or '',
        'absorption': r['absorption'] or '',
        'stickiness': r['stickiness'] or '',
        'pilling': r['pilling'] or '',
        'usage': r['usage'] or '',
        'seasons': r['seasons_scenes'] or '',
        'pos': (ure.get('positive') or ''),
        'neg': (ure.get('negative') or ''),
        'skin': (use.get('self_report') or ''),
        'adverse': adv or '',
        'ingredients': r['main_ingredients'] or '',
        'full_ing': r['full_ingredients'] or '',
        'identity': r['identity_status'] or '',
        'price': price,
        'price_cny': price_cny,
        'images': rel_imgs,
        'comments': real_comments,
        'notes': ns,
        'n_comments': len(real_comments),
        'n_notes': len(prod_notes.get(pid, set())),
    })

products.sort(key=lambda p: (-p['n_comments'], -p['n_notes'], -len(p['images'])))

out = 'window.PRODUCTS = ' + json.dumps(products, ensure_ascii=False) + ';\n'
with open(os.path.join(BASE, 'products.js'), 'w', encoding='utf-8') as f:
    f.write(out)

# 统计
withimg = sum(1 for p in products if p['images'])
withcm = sum(1 for p in products if p['comments'])
print('products:', len(products), '| with images:', withimg, '| with real comments:', withcm)
print('total images copied:', sum(len(p['images']) for p in products))
