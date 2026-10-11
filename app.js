(function () {
  var ALL_PRODUCTS = window.PRODUCTS || [];

  // ===== 不喜欢的商品（本地持久化，全局过滤） =====
  var DISLIKE_KEY = 'zhizhi_dislikes';
  function loadDislikes() {
    try { return JSON.parse(localStorage.getItem(DISLIKE_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveDislikes(arr) {
    try { localStorage.setItem(DISLIKE_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  var dislikedIds = loadDislikes();
  // PRODUCTS 始终排除被标记为不喜欢的商品
  var PRODUCTS = ALL_PRODUCTS.filter(function (p) { return dislikedIds.indexOf(p.id) < 0; });
  function isDisliked(id) { return dislikedIds.indexOf(id) >= 0; }
  function dislikeProduct(id) {
    if (dislikedIds.indexOf(id) < 0) { dislikedIds.push(id); saveDislikes(dislikedIds); }
    PRODUCTS = ALL_PRODUCTS.filter(function (p) { return dislikedIds.indexOf(p.id) < 0; });
  }

  // ===== 收藏（本地持久化） =====
  var FAV_KEY = 'zhizhi_favorites';
  function loadFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; }
    catch (e) { return []; }
  }
  var favIds = loadFavs();
  function isFavorited(id) { return favIds.indexOf(id) >= 0; }
  function saveFavs() { try { localStorage.setItem(FAV_KEY, JSON.stringify(favIds)); } catch (e) {} }
  function toggleFavorite(id) {
    var i = favIds.indexOf(id);
    if (i >= 0) favIds.splice(i, 1); else favIds.push(id);
    saveFavs();
  }

  var chat = document.getElementById('chat');
  var input = document.getElementById('input');
  var send = document.getElementById('send');
  var counter = document.getElementById('counter');

  function nowTime() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = String(iso).slice(0, 10).split('-');
    return d[0] + '.' + d[1] + '.' + d[2];
  }
  function skinOf(text) {
    var t = text || '';
    if (/大油皮|混油|油皮|油性|出油/.test(t)) return '油皮 / 混油皮';
    if (/混干|混合偏干/.test(t)) return '混干皮';
    if (/干皮|干性|沙漠皮|大干皮/.test(t)) return '干皮 / 中性皮';
    if (/敏|红血丝|屏障|泛红/.test(t)) return '敏感肌';
    return '中性 / 混合肌';
  }

  // 按名称检索产品（模糊匹配）
  function findProduct(q) {
    q = (q || '').trim();
    if (!q) return null;
    var best = null, bestScore = 0;
    var ql = q.toLowerCase();
    PRODUCTS.forEach(function (p) {
      var hay = (p.name + ' ' + p.raw_name + ' ' + p.brand + ' ' + p.l2 + ' ' + p.form).toLowerCase();
      var score = 0;
      if (hay.indexOf(ql) >= 0) score = 100 + ql.length;
      else {
        // 逐字匹配关键品牌/品名
        for (var i = 0; i < q.length; i++) { if (hay.indexOf(q[i]) >= 0) score += 1; }
        if (p.brand && q.indexOf(p.brand) >= 0) score += 30;
      }
      if (score > bestScore) { bestScore = score; best = p; }
    });
    return bestScore >= 3 ? best : null;
  }

  // 品类关键词 → 二级品类（L2）
  var CAT_ALIAS = [
    ['面膜', ['面膜']],
    ['面霜', ['面霜', '乳液']],
    ['乳液', ['乳液', '面霜']],
    ['洁面', ['洁面']],
    ['洗面奶', ['洁面']],
    ['卸妆', ['卸妆']],
    ['防晒', ['防晒']],
    ['精华', ['精华']],
    ['化妆水', ['化妆水']],
    ['爽肤水', ['化妆水']],
    ['眼霜', ['眼周护理']],
    ['眼膜', ['眼周护理']],
    ['眼部', ['眼周护理']],
    ['去角质', ['角质调理']],
    ['角质', ['角质调理']],
    ['身体乳', ['身体护理']],
    ['身体护理', ['身体护理']],
    ['身体清洁', ['身体清洁']],
    ['洗发', ['身体清洁']],
    ['护手霜', ['手部护理']],
    ['手部', ['手部护理']],
    ['唇膏', ['唇部护理']],
    ['唇部', ['唇部护理']],
    ['颈部', ['颈胸护理']],
    ['颈霜', ['颈胸护理']],
    ['局部', ['局部护理', '局部护理贴']],
    ['祛痘', ['局部护理', '局部护理贴']]
  ];

  // 判断输入是否指向某个品类，返回该品类下的产品（按数据丰富度排序）
  function matchCategory(q) {
    q = (q || '').trim();
    if (!q) return null;
    var l2s = null, label = null;
    // 先精确等于某个 L2 名称
    var direct = PRODUCTS.filter(function (p) { return p.l2 === q; });
    if (direct.length) return { label: q, l2: q, list: sortByRich(direct) };
    for (var i = 0; i < CAT_ALIAS.length; i++) {
      if (q.indexOf(CAT_ALIAS[i][0]) >= 0) { l2s = CAT_ALIAS[i][1]; label = CAT_ALIAS[i][0]; break; }
    }
    if (!l2s) return null;
    var list = PRODUCTS.filter(function (p) { return l2s.indexOf(p.l2) >= 0; });
    if (!list.length) return null;
    return { label: label, l2: l2s[0], list: sortByRich(list) };
  }
  function sortByRich(list) {
    return list.slice().sort(function (a, b) {
      return ((b.n_comments || 0) * 2 + (b.n_notes || 0)) - ((a.n_comments || 0) * 2 + (a.n_notes || 0));
    });
  }

  var state = { stage: 1, product: null, messages: [] };

  state.messages = [{
    role: 'assistant', html: true, time: nowTime(),
    content: '哈喽，我是<b>知知</b>。买护肤品前是不是总嫌各平台的评价太零碎？交给我，帮你把各个地方的真实评价凑在一起，给你个更全面的参考。<br>直接报<b>产品名</b>给我（比如「绿豆洗面奶」「修丽可AGE面霜」），或者点下面「全部品类」里的卡片也行～'
  }];

  // ===== 产品详情 HTML（聊天与弹窗共用） =====
  function detailHTML(p, query) {
    var qskin = skinOf(query);
    var h = '';
    var imgs = (p.images || []);
    if (p.identity) h += '<span class="demo-badge">' + esc(p.identity) + '</span>';
    var meta = [];
    if (p.l2) meta.push(esc(p.l2));
    if (p.form) meta.push(esc(p.form));
    if (p.capacity) meta.push(esc(p.capacity));
    if (p.price) meta.push('参考价 ' + esc(p.price));
    else meta.push('参考价未知');
    h += '<p style="color:#9E7070;font-size:13px">' + meta.join(' · ') + '</p>';
    if (imgs.length) {
      h += '<div class="thumb-strip">' + imgs.map(function (u) {
        return '<img src="' + esc(u) + '" alt="' + esc(p.name) + '" loading="lazy">';
      }).join('') + '</div>';
    }
    var rows = [];
    if (p.texture) rows.push(['质地', p.texture]);
    if (p.scent) rows.push(['香味', p.scent]);
    if (p.absorption) rows.push(['吸收', p.absorption]);
    if (p.stickiness) rows.push(['黏腻', p.stickiness]);
    if (p.pilling) rows.push(['搓泥', p.pilling]);
    if (rows.length) {
      h += '<div class="kv">' + rows.map(function (r) {
        return '<div class="kv-row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
      }).join('') + '</div>';
    }
    if (p.pos || p.neg) {
      h += '<div class="rec-box"><p><b>用户自述体验</b></p>';
      if (p.pos) h += '<p>👍 <b class="good">正面</b>：' + esc(p.pos) + '</p>';
      if (p.neg) h += '<p>👎 <b class="bad">负面</b>：' + esc(p.neg) + '</p>';
      if (p.skin) h += '<p>自述肤质：' + esc(p.skin) + '</p>';
      h += '</div>';
    }
    var cs = (p.comments || []).filter(function (x) { return x.text; });
    h += '<hr><p><b>真实评论样本</b> · 共 ' + (p.n_comments || cs.length) + ' 条</p>';
    if (cs.length) {
      h += '<div class="reviews">' + cs.slice(0, 4).map(function (x) {
        var head = '小红书评论';
        if (x.skin) head += ' · ' + esc(x.skin);
        if (x.duration) head += ' · ' + esc(x.duration);
        if (x.time) head += ' · ' + fmtDate(x.time);
        return '<div class="review"><div class="rv-head">' + head + '</div>' +
          '<div class="rv-body">' + esc(x.text) + '</div>' +
          (x.pos ? '<div class="rv-pos">正面：' + esc(x.pos) + '</div>' : '') +
          (x.neg ? '<div class="rv-neg">负面：' + esc(x.neg) + '</div>' : '') + '</div>';
      }).join('') + '</div>';
      if (cs.length > 4) h += '<p style="color:#9E7070;font-size:13px">…还有 ' + (cs.length - 4) + ' 条同类评论</p>';
    } else {
      h += '<p style="color:#9E7070">这款暂未采集到可用的真实评论样本。</p>';
    }
    if (p.notes && p.notes.length) {
      h += '<p style="margin-top:10px"><b>相关笔记来源</b></p><div class="notes">';
      h += p.notes.map(function (n) {
        var like = n.likes ? ' · ' + esc(n.likes) + ' 赞' : '';
        return '<a class="note-item" href="' + esc(n.url) + '" target="_blank" rel="noopener">' +
          '<span class="note-title">' + esc(n.title) + '</span>' +
          '<span class="note-meta">' + esc(fmtDate(n.published)) + like + '</span></a>';
      }).join('') + '</div>';
    }
    h += '<div class="rec-box"><p><b>匹配你的肤质：</b>' + esc(qskin) + '</p>' +
      '<p>' + (p.pos ? '综合真实反馈，' + esc(p.pos) : '综合真实反馈，多数使用者对这款的体验偏中性。') +
      ' 结合你的肤质，建议先看上面的负面反馈是否命中你的雷点。</p></div>';
    return h;
  }

  // ===== 品类列表：一个品类 → 多款产品供选择 =====
  function categoryHTML(cat) {
    var list = cat.list;
    var h = '<h3>「' + esc(cat.label) + '」相关的 ' + list.length + ' 款</h3>';
    h += '<p class="cat-hint">这里是库里收录的该品类产品，点任意一款查看真实口碑详情。</p>';
    h += '<div class="cat-list">';
    list.forEach(function (p) {
      var img = (p.images && p.images.length)
        ? '<img class="cl-img" src="' + esc(p.images[0]) + '" alt="' + esc(p.name) + '" loading="lazy">'
        : '<div class="cl-img"></div>';
      var meta = [p.l2, p.form].filter(Boolean).join(' · ');
      var priceTxt = p.price ? ('参考价 ' + esc(p.price)) : '参考价未知';
      var why = p.pos ? String(p.pos).slice(0, 64) : (p.texture ? '质地：' + p.texture : '综合反馈中性');
      var cnt = '评论 ' + (p.n_comments || 0) + ' · 笔记 ' + (p.n_notes || 0);
      h += '<div class="cat-item" data-pid="' + esc(p.id) + '">' + img + '<div class="ci-body">' +
        '<h4>' + esc(p.name) + '</h4>' +
        '<div class="ci-meta">' + esc(meta) + ' · ' + priceTxt + ' · ' + cnt + '</div>' +
        '<div class="ci-why">' + esc(why) + '</div>' +
        '<div class="ci-more">点击查看详情 →</div>' +
        '</div></div>';
    });
    h += '</div>';
    return h;
  }

  // ===== 阶段一：真实数据汇报（初试印象 + 真实评论 + 肤质匹配） =====
  function stage1(p, query) {
    if (!p) {
      return '<h3>没找到这款产品</h3>' +
        '<p>我的库里暂时没有匹配到「' + esc(query) + '」。目前收录啦 <b>' + PRODUCTS.length + '</b> 款产品，涵盖洁面 / 卸妆 / 面霜 / 精华 / 防晒 / 面膜 / 眼周护理等品类。</p>' +
        '<p>你可以换个更常见的名字试试，或者直接点下方「全部品类」里的卡片～</p>' +
        '<div class="rec-box"><p><b>提示：</b>库里产品名多来自笔记里的常用叫法，直接用俗称可能更容易命中。</p></div>';
    }
    var h = '<h3>' + esc(p.name) + '</h3>' + detailHTML(p, query);
    h += '<p class="hook">想深挖 <b>成分 / 为什么闷痘 / 长期反应</b>？直接接着问我～</p>';
    return h;
  }

  // ===== 阶段二：知知成分与长期口碑小档案 =====
  function stage2(p, query) {
    if (!p) return stage1(p, query);
    var h = '<h3>知知小档案 · ' + esc(p.name) + '</h3>';
    h += '<div class="dossier">';
    h += '<div class="dossier-sec"><div class="ds-h">适合谁 / 不适合谁</div><p>';
    var likes = [], bads = [];
    if (p.skin) likes.push('自述' + esc(p.skin) + '的使用者');
    if (p.pos) likes.push('认可「' + esc(p.pos) + '」的人群');
    if (p.neg) bads.push('对「' + esc(p.neg) + '」较敏感的人');
    h += (likes.length ? '较适合：' + likes.join('；') + '。' : '') +
         (bads.length ? '<br>需谨慎：' + bads.join('；') + '。' : '') +
         (!likes.length && !bads.length ? '数据库中对这款的肤质/体验记录仍偏少，建议结合更多来源判断。' : '');
    h += '</p></div>';

    if (p.ingredients || p.full_ing) {
      h += '<div class="dossier-sec"><div class="ds-h">关键成分</div><p>' +
        esc(p.ingredients || p.full_ing) + '</p></div>';
    }
    if (p.usage || p.seasons) {
      h += '<div class="dossier-sec"><div class="ds-h">使用方法 / 场景</div><p>' +
        esc([p.usage, p.seasons].filter(Boolean).join('；')) + '</p></div>';
    }
    if (p.adverse) {
      h += '<div class="dossier-sec"><div class="ds-h">不良体验记录</div><p>' + esc(p.adverse) + '</p></div>';
    }
    // 负面评论汇总
    var negs = (p.comments || []).filter(function (x) { return x.neg || (x.text && /(痒|刺|闷|闭口|痘|干|红|过敏|不好|踩雷|失望)/.test(x.text)); });
    if (negs.length) {
      h += '<div class="dossier-sec"><div class="ds-h">长期口碑里的负面信号（' + negs.length + ' 条）</div><p>' +
        negs.slice(0, 3).map(function (x) { return '· ' + esc((x.neg || x.text).slice(0, 80)); }).join('<br>') + '</p></div>';
    }
    h += '</div>';
    h += '<div class="rec-box"><p><b>购买建议：</b>先对照上面的「不适合谁」和负面信号，看是否命中你的雷点；条件允许先入小样试一周。</p></div>';
    return h;
  }

  function isFollowUp(t) {
    return /(为什么|怎么|成分|闷痘|闭口|致痘|反差|两周|一个月|长期|怎么回事|原因|小档案|详细|展开|说说|解释|适合|推荐|哪个好)/.test(t || '');
  }

  function render() {
    chat.innerHTML = '';
    state.messages.forEach(function (m) {
      var wrap = document.createElement('div');
      wrap.className = 'msg ' + m.role;
      var av = document.createElement('div');
      av.className = 'avatar';
      var im = document.createElement('img');
      im.src = m.role === 'user' ? 'user.jpg' : 'avatar.jpg';
      im.alt = m.role === 'user' ? '我' : '知知';
      av.appendChild(im);
      var col = document.createElement('div');
      col.className = 'col';
      var b = document.createElement('div');
      b.className = 'bubble';
      b.innerHTML = m.html ? m.content : esc(m.content);
      col.appendChild(b);
      if (m.time) {
        var t = document.createElement('div');
        t.className = 'time'; t.textContent = m.time; col.appendChild(t);
      }
      wrap.appendChild(av); wrap.appendChild(col); chat.appendChild(wrap);
    });
    chat.scrollTop = chat.scrollHeight;
  }

  var busy = false;
  function submit(text) {
    text = (typeof text === 'string' ? text : input.value).trim();
    if (!text || busy) return;
    input.value = ''; updateCounter();
    state.messages.push({ role: 'user', html: false, time: nowTime(), content: text });
    render();
    var idx = state.messages.length;
    state.messages.push({ role: 'assistant', html: true, content:
      '<span class="typing">正在把各平台的口碑拼在一起<span class="dot"></span><span class="dot"></span><span class="dot"></span></span>' });
    render();
    busy = true; send.disabled = true;
    setTimeout(function () {
      var cat = matchCategory(text);
      var isPureCategory = cat && (text === cat.label || PRODUCTS.some(function (x) { return x.l2 === text; }));
      var p = isPureCategory ? null : findProduct(text);
      var html, useStage2 = false;
      if (isPureCategory) {
        html = categoryHTML(cat);
        updateCmpBtn(cat.list);
        state.product = null; state.stage = 1;
      } else if (p) {
        state.product = p;
        updateCmpBtn(null);
        useStage2 = (state.stage === 1 && isFollowUp(text) && p);
        html = useStage2 ? stage2(p, text) : stage1(p, text);
        if (useStage2) state.stage = 2;
      } else if (cat) {
        html = categoryHTML(cat);
        updateCmpBtn(cat.list);
        state.product = null; state.stage = 1;
      } else {
        var t2 = state.product;
        useStage2 = (state.stage === 1 && isFollowUp(text) && t2);
        html = useStage2 ? stage2(t2, text) : stage1(null, text);
        if (useStage2) state.stage = 2;
      }
      state.messages[idx] = { role: 'assistant', html: true, time: nowTime(), content: html };
      busy = false; send.disabled = false;
      render();
    }, 1100);
  }

  function updateCounter() {
    counter.textContent = (input.value || '').length + ' / 1200 字符';
  }
  send.addEventListener('click', function () { submit(); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  input.addEventListener('input', updateCounter);
  updateCounter();

  // 聊天里点品类卡片 → 就地展开产品详情页（复用底部详情面板）
  chat.addEventListener('click', function (e) {
    var item = e.target.closest('.cat-item');
    if (!item) return;
    var pid = item.getAttribute('data-pid');
    var p = PRODUCTS.filter(function (x) { return x.id === pid; })[0];
    if (p) showDetail(p, '', 'chat');
  });

  // 通用详情页：隐藏其它面板，展示详情 + 返回按钮
  var detailPanel = document.getElementById('detailPanel');
  var detailBody = document.getElementById('detailBody');
  var detailBack = document.getElementById('detailBack');
  var detailFrom = 'need';
  function showDetail(p, query, from) {
    detailFrom = from || 'need';
    detailBody.innerHTML = '<h3>' + esc(p.name) + '</h3>' + detailHTML(p, query || '');
    detailBack.textContent = detailFrom === 'chat' ? '← 返回对话' : '← 返回匹配列表';
    if (detailFrom === 'chat') {
      needPanel.hidden = true; compare.hidden = true; chatCard.hidden = true;
    } else {
      document.querySelector('.need-head').hidden = true;
      document.querySelector('.need-form').hidden = true;
      needResults.hidden = true;
    }
    detailPanel.hidden = false;
    detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  detailBack.addEventListener('click', function () {
    detailPanel.hidden = true;
    detailBody.innerHTML = '';
    if (detailFrom === 'chat') {
      chatCard.hidden = false;
      chat.scrollTop = chat.scrollHeight;
    } else {
      document.querySelector('.need-head').hidden = false;
      document.querySelector('.need-form').hidden = false;
      needResults.hidden = false;
      needPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ===== 全部品类 =====
  var catgrid = document.getElementById('catgrid');
  var catTabsEl = document.getElementById('catTabs');
  document.getElementById('prodCount').textContent = PRODUCTS.length;

  var order = ['全部'];
  var current = '全部';

  function buildTabs() {
    // 每次重建，确保被不喜欢过滤后品类也同步
    order = ['全部'];
    PRODUCTS.forEach(function (p) { if (p.l2 && order.indexOf(p.l2) < 0) order.push(p.l2); });
    if (order.indexOf(current) < 0) current = '全部';
    catTabsEl.innerHTML = '';
    order.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'ctab' + (c === current ? ' active' : '');
      b.textContent = c;
      b.addEventListener('click', function () {
        current = c; buildTabs(); buildGrid();
      });
      catTabsEl.appendChild(b);
    });
  }

  function buildGrid() {
    var list = PRODUCTS.filter(function (p) { return current === '全部' || p.l2 === current; });
    // 优先展示有图的
    list = list.slice().sort(function (a, b) { return (b.images.length ? 1 : 0) - (a.images.length ? 1 : 0); });
    catgrid.innerHTML = '';
    var grads = [
      'linear-gradient(135deg,#FBE3E7,#F6CBD6)', 'linear-gradient(135deg,#FCEAE0,#F7D3C4)',
      'linear-gradient(135deg,#F3E7F5,#E4D3F0)', 'linear-gradient(135deg,#E6F0EA,#CBE3D6)',
      'linear-gradient(135deg,#F7E9E2,#EFC9BF)', 'linear-gradient(135deg,#E9EEF7,#CBD9F0)'
    ];
    list.slice(0, 60).forEach(function (p, i) {
      var card = document.createElement('div');
      card.className = 'pcard';
      var thumb = p.images.length
        ? '<div class="thumb img" style="background-image:url(\'' + esc(p.images[0]) + '\')"></div>'
        : '<div class="thumb" style="background:' + grads[i % grads.length] + '"></div>';
      var tags = [p.brand, p.l2, p.form].filter(Boolean).slice(0, 3)
        .map(function (t) { return '<span class="ptag">#' + esc(t) + '</span>'; }).join('');
      var desc = p.pos || p.texture || (p.n_comments ? (p.n_comments + ' 条真实评论') : '暂无更多描述');
      card.innerHTML = thumb +
        '<div class="body"><h3>' + esc(p.name) + '</h3>' +
        '<div class="ptags">' + tags + '</div>' +
        '<div class="desc">' + esc(String(desc).slice(0, 42)) + '</div></div>' +
        '<button class="pcard-heart" title="不喜欢" aria-label="不喜欢">' +
        '<span class="heart-tip">不喜欢</span>' +
        '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/><path class="crack" d="M12 3.7 L10.1 7.2 L12.6 9.1 L9.6 12 L12.2 14.2 L9.9 17.2 L11.4 19.6" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        '<button class="pcard-star" title="收藏" aria-label="收藏">' +
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.06 6.6.8-4.85 4.53 1.27 6.55L12 17.9l-5.92 2.54 1.27-6.55L2.5 9.36l6.6-.8L12 2.5z"/></svg>' +
        '</button>';
      card.addEventListener('click', function () {
        switchTab('chat');
        submit(p.name);
      });
      var heart = card.querySelector('.pcard-heart');
      heart.addEventListener('click', function (e) {
        e.stopPropagation();
        dislikeProduct(p.id);
        card.classList.add('dismissing');
        setTimeout(function () {
          document.getElementById('prodCount').textContent = PRODUCTS.length;
          buildTabs();
          buildGrid();
          showDislikeToast('已标记不喜欢，不再展示「' + p.name + '」');
        }, 260);
      });
      var star = card.querySelector('.pcard-star');
      if (isFavorited(p.id)) star.classList.add('on');
      star.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleFavorite(p.id);
        var on = isFavorited(p.id);
        star.classList.toggle('on', on);
        updateFavBadge();
        showDislikeToast(on ? '已收藏「' + p.name + '」' : '已取消收藏「' + p.name + '」');
      });
      catgrid.appendChild(card);
    });
    if (!list.length) catgrid.innerHTML = '<p style="color:#9E7070">该品类暂无产品。</p>';
  }
  buildTabs(); buildGrid();

  // ===== 我的收藏 / 不喜欢 页面 =====
  var favPage = document.getElementById('favPage');
  var favEntry = document.getElementById('favEntry');
  var favBadge = document.getElementById('favBadge');
  var favClose = document.getElementById('favClose');
  var favCatBar = document.getElementById('favCatBar');
  var favBody = document.getElementById('favBody');
  var favTab = 'fav';          // 'fav' | 'dis'
  var favCatFilter = '全部';    // 当前品类过滤

  function updateFavBadge() {
    var n = favIds.length;
    favBadge.textContent = n;
    favBadge.hidden = (n === 0);
  }

  function favList() {
    var ids = favTab === 'fav' ? favIds : dislikedIds;
    return ALL_PRODUCTS.filter(function (p) { return ids.indexOf(p.id) >= 0; });
  }

  function renderFavPage() {
    document.getElementById('favCount').textContent = favIds.length;
    document.getElementById('disCount').textContent = dislikedIds.length;
    var list = favList();

    // 品类栏
    var cats = ['全部'];
    list.forEach(function (p) { if (p.l2 && cats.indexOf(p.l2) < 0) cats.push(p.l2); });
    if (cats.indexOf(favCatFilter) < 0) favCatFilter = '全部';
    favCatBar.innerHTML = cats.map(function (c) {
      var n = c === '全部' ? list.length : list.filter(function (p) { return p.l2 === c; }).length;
      return '<button class="fav-ctab' + (c === favCatFilter ? ' active' : '') + '" data-fcat="' + esc(c) + '">' +
        esc(c) + ' <span>' + n + '</span></button>';
    }).join('');

    var show = list.filter(function (p) { return favCatFilter === '全部' || p.l2 === favCatFilter; });
    if (!show.length) {
      favBody.innerHTML = '<p class="fav-empty">' + (favTab === 'fav' ? '还没有收藏任何产品，去全部品类里点右下角的 ☆ 试试～' : '还没有标记不喜欢的产品。') + '</p>';
      return;
    }
    favBody.innerHTML = '<div class="grid">' + show.map(function (p) {
      var img = p.images && p.images[0]
        ? '<div class="thumb img" style="background-image:url(\'' + esc(p.images[0]) + '\')"></div>'
        : '<div class="thumb" style="background:#F7ECEE"></div>';
      var action = favTab === 'fav'
        ? '<button class="fav-remove" data-rm="fav" data-pid="' + esc(p.id) + '">取消收藏</button>'
        : '<button class="fav-remove" data-rm="dis" data-pid="' + esc(p.id) + '">取消不喜欢</button>';
      return '<div class="fav-card">' + img +
        '<div class="fav-card-body"><h3>' + esc(p.name) + '</h3>' +
        '<div class="fav-card-meta">' + esc([p.brand, p.l2].filter(Boolean).join(' · ') || '—') + '</div>' +
        action + '</div></div>';
    }).join('') + '</div>';
  }

  function openFavPage(tab) {
    favTab = tab || 'fav';
    favCatFilter = '全部';
    favPage.hidden = false;
    document.querySelector('.chat-card').hidden = true;
    compare.hidden = true;
    needPanel.hidden = true;
    detailPanel.hidden = true;
    document.querySelectorAll('.fav-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-favtab') === favTab);
    });
    renderFavPage();
    favPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeFavPage() {
    favPage.hidden = true;
    switchTab('chat');
  }

  favEntry.addEventListener('click', function () { openFavPage('fav'); });
  favClose.addEventListener('click', closeFavPage);
  document.querySelectorAll('.fav-tab').forEach(function (t) {
    t.addEventListener('click', function () {
      favTab = t.getAttribute('data-favtab');
      favCatFilter = '全部';
      document.querySelectorAll('.fav-tab').forEach(function (x) { x.classList.toggle('active', x === t); });
      renderFavPage();
    });
  });
  favCatBar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fcat]');
    if (!b) return;
    favCatFilter = b.getAttribute('data-fcat');
    renderFavPage();
  });
  favBody.addEventListener('click', function (e) {
    var b = e.target.closest('.fav-remove');
    if (!b) return;
    var id = b.getAttribute('data-pid');
    if (b.getAttribute('data-rm') === 'fav') {
      var i = favIds.indexOf(id); if (i >= 0) favIds.splice(i, 1); saveFavs();
      showToast('已取消收藏');
    } else {
      dislikedIds = dislikedIds.filter(function (x) { return x !== id; });
      saveDislikes(dislikedIds);
      PRODUCTS = ALL_PRODUCTS.filter(function (p) { return dislikedIds.indexOf(p.id) < 0; });
      document.getElementById('prodCount').textContent = PRODUCTS.length;
      buildTabs(); buildGrid();
      showToast('已取消不喜欢，产品重新出现');
    }
    updateFavBadge();
    renderFavPage();
  });

  updateFavBadge();


  var compare = document.getElementById('compare');
  var chatCard = document.querySelector('.chat-card');
  var cmpBtn = document.getElementById('cmpBtn');
  var cmpInput = document.getElementById('cmpInput');
  var cmpHistory = document.getElementById('cmpHistory');
  var cmpHot = document.getElementById('cmpHot');
  var cmpPick = document.getElementById('cmpPick');
  var cmpPickGrid = document.getElementById('cmpPickGrid');
  var cmpPickCount = document.getElementById('cmpPickCount');
  var cmpTray = document.getElementById('cmpTray');
  var cmpTraySlots = document.getElementById('cmpTraySlots');
  var cmpGo = document.getElementById('cmpGo');
  var cmpResult = document.getElementById('cmpResult');

  var CMP_HIST_KEY = 'zhizhi_cmp_history';
  var cmpPicks = []; // 已选产品（最多 2）

  function scoreOf(p) {
    return Math.max(50, Math.min(95, 70 + p.n_comments + p.n_notes * 2 + (p.images.length ? 6 : 0)));
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(CMP_HIST_KEY)) || []; }
    catch (e) { return []; }
  }
  function pushHistory(q) {
    q = (q || '').trim();
    if (!q) return;
    var h = loadHistory().filter(function (x) { return x !== q; });
    h.unshift(q);
    h = h.slice(0, 8);
    try { localStorage.setItem(CMP_HIST_KEY, JSON.stringify(h)); } catch (e) {}
    renderHistory();
  }
  function renderHistory() {
    var h = loadHistory();
    cmpHistory.innerHTML = h.length
      ? h.map(function (q) { return '<button data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('')
      : '<span class="cmp-empty">还没有搜索记录</span>';
  }

  // 热门品类：取库里产品数最多的前 6 个 L2
  (function renderHot() {
    var counts = {};
    PRODUCTS.forEach(function (p) { if (p.l2) counts[p.l2] = (counts[p.l2] || 0) + 1; });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 6);
    cmpHot.innerHTML = top.map(function (c) { return '<button data-q="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
  })();

  // 输入品类/产品 → 列出候选产品卡片（带勾选）
  function cmpSearch(query) {
    query = (query || '').trim();
    if (!query) return;
    pushHistory(query);
    cmpResult.innerHTML = '';
    var cat = matchCategory(query);
    var list, title;
    if (cat && cat.list.length >= 2) {
      list = sortByRich(cat.list);
      title = '「' + query + '」相关产品';
    } else {
      var q = query.toLowerCase();
      list = PRODUCTS.filter(function (p) {
        return (p.name || '').toLowerCase().indexOf(q) >= 0 ||
               (p.brand || '').toLowerCase().indexOf(q) >= 0 ||
               (p.l2 || '').indexOf(query) >= 0;
      });
      if (!list.length && cat) list = sortByRich(cat.list);
      title = '「' + query + '」相关产品';
    }
    list = sortByRich(list);
    if (!list.length) {
      cmpPickGrid.innerHTML = '';
      cmpPickCount.textContent = '没找到相关产品，换个词试试～';
      cmpPick.hidden = false;
      cmpTray.hidden = true;
      cmpPick.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    cmpPicks = [];
    cmpPickCount.textContent = title + '（共 ' + list.length + ' 款）';
    cmpPickGrid.innerHTML = list.map(function (p) {
      var img = p.images && p.images[0]
        ? '<img class="cl-img" src="' + esc(p.images[0]) + '" alt="" loading="lazy">'
        : '<div class="cl-img cl-img-none">无图</div>';
      return '<div class="pick-card" data-pid="' + esc(p.id) + '">' +
        img +
        '<div class="pick-name">' + esc(p.name) + '</div>' +
        '<div class="pick-meta">' + esc([p.brand, p.l2].filter(Boolean).join(' · ') || '—') + '</div>' +
        '<div class="pick-check">✓</div></div>';
    }).join('');
    cmpPick.hidden = false;
    cmpTray.hidden = true;
    renderTray();
    cmpPick.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderTray() {
    var slots = [];
    for (var i = 0; i < 2; i++) {
      var p = cmpPicks[i];
      if (p) {
        slots.push('<div class="tray-slot filled" data-slot="' + i + '">' +
          '<span class="tray-name">' + esc(p.name) + '</span>' +
          '<span class="tray-x" data-slot="' + i + '">×</span></div>');
      } else {
        slots.push('<div class="tray-slot">选择第 ' + (i + 1) + ' 个</div>');
      }
    }
    cmpTraySlots.innerHTML = slots.join('');
    cmpGo.disabled = cmpPicks.length !== 2;
    cmpTray.hidden = cmpPick.hidden;
  }

  function findProduct(id) { return PRODUCTS.filter(function (x) { return x.id === id; })[0]; }

  cmpInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') cmpSearch(cmpInput.value); });
  document.getElementById('cmpSearch').addEventListener('click', function () { cmpSearch(cmpInput.value); });
  cmpHistory.addEventListener('click', function (e) { if (e.target.dataset.q) cmpSearch(e.target.dataset.q); });
  cmpHot.addEventListener('click', function (e) { if (e.target.dataset.q) { cmpInput.value = e.target.dataset.q; cmpSearch(e.target.dataset.q); } });

  cmpPickGrid.addEventListener('click', function (e) {
    var card = e.target.closest('.pick-card');
    if (!card) return;
    var id = card.dataset.pid;
    var idx = cmpPicks.findIndex(function (p) { return p.id === id; });
    if (idx >= 0) {
      cmpPicks.splice(idx, 1);
      card.classList.remove('picked');
    } else {
      if (cmpPicks.length >= 2) { showToast('最多选 2 个，先去掉一个吧'); return; }
      cmpPicks.push(findProduct(id));
      card.classList.add('picked');
    }
    renderTray();
  });

  cmpTraySlots.addEventListener('click', function (e) {
    if (e.target.classList.contains('tray-x')) {
      var p = cmpPicks[+e.target.dataset.slot];
      cmpPicks = cmpPicks.filter(function (x) { return x !== p; });
      var pcard = cmpPickGrid.querySelector('.pick-card[data-pid="' + p.id + '"]');
      if (pcard) pcard.classList.remove('picked');
      renderTray();
    }
  });

  function showToast(msg) {
    var t = document.getElementById('cmpToast');
    if (!t) { t = document.createElement('div'); t.id = 'cmpToast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }
  var showDislikeToast = showToast;

  // 两两对比表
  function twoCompare(a, b) {
    var rows = [
      ['参考评分', function (p) { return '<b class="score">' + scoreOf(p) + ' 分</b>'; }],
      ['品类形态', function (p) { return esc([p.l2, p.form].filter(Boolean).join(' / ') || '—'); }],
      ['参考价', function (p) { return esc(p.price || '—'); }],
      ['质地肤感', function (p) { return esc(p.texture || '—'); }],
      ['用户正面', function (p) { return esc((p.pos || '—').slice(0, 60)); }],
      ['用户负面', function (p) { return esc((p.neg || '—').slice(0, 60)); }],
      ['自述肤质', function (p) { return esc(p.skin || '—'); }],
      ['真实评论量', function (p) { return (p.n_comments || 0) + ' 条'; }]
    ];
    function col(p) {
      var img = p.images && p.images[0] ? '<img src="' + esc(p.images[0]) + '" alt="">' : '';
      return '<th><div class="cmp-col">' + img + '<span>' + esc(p.name) + '</span></div></th>';
    }
    var h = '<div class="compare-head"><h3>『' + esc(a.name) + '』 vs 『' + esc(b.name) + '』</h3>' +
      '<span class="demo-badge">数据来自本地研究库 · 评分为基于评论量/来源数的参考值</span></div>';
    h += '<div class="compare-scroll"><table class="cmp"><thead><tr><th>对比维度</th>' + col(a) + col(b) + '</tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr><th>' + r[0] + '</th><td>' + r[1](a) + '</td><td>' + r[1](b) + '</td></tr>'; });
    h += '</tbody></table></div>';
    return h;
  }

  cmpGo.addEventListener('click', function () {
    if (cmpPicks.length !== 2) return;
    cmpResult.innerHTML = twoCompare(cmpPicks[0], cmpPicks[1]);
    cmpResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // 旧的「多款产品对比」按钮（聊天里生成品类列表后点亮）
  function updateCmpBtn(list) {
    state.lastCatList = list || null;
    cmpBtn.hidden = !(list && list.length >= 2);
  }
  cmpBtn.addEventListener('click', function () {
    // 跳到「想做的比较」页，并用当前品类自动搜索
    var q = (state.lastCatList && state.lastCatList[0] && state.lastCatList[0].l2) || '';
    switchTab('compare');
    if (q) { cmpInput.value = q; cmpSearch(q); }
  });

  renderHistory();
  renderTray();

  // ===== 购买需求 =====
  var needPanel = document.getElementById('needPanel');
  var needResults = document.getElementById('needResults');
  var needScored = [];
  var needState = { min: null, max: null, skin: '', type: '', extra: '' };

  // 产品类型选项 = 库里真实二级品类
  var types = [];
  PRODUCTS.forEach(function (p) { if (p.l2 && types.indexOf(p.l2) < 0) types.push(p.l2); });
  var typeChips = document.getElementById('typeChips');
  types.forEach(function (t) {
    var b = document.createElement('button');
    b.textContent = t; b.setAttribute('data-v', t);
    typeChips.appendChild(b);
  });

  function bindChips(id, key, isRange) {
    var wrap = document.getElementById(id);
    if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      wrap.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      if (isRange) {
        needState.min = b.getAttribute('data-min') === '' ? null : Number(b.getAttribute('data-min'));
        needState.max = b.getAttribute('data-max') === '' ? null : Number(b.getAttribute('data-max'));
        document.getElementById('needMin').value = needState.min == null ? '' : needState.min;
        document.getElementById('needMax').value = needState.max == null ? '' : needState.max;
      } else {
        needState[key] = b.getAttribute('data-v');
      }
    });
  }
  bindChips('priceChips', null, true);
  bindChips('skinChips', 'skin', false);
  bindChips('typeChips', 'type', false);

  document.getElementById('needMin').addEventListener('input', function () {
    needState.min = this.value === '' ? null : Number(this.value);
  });
  document.getElementById('needMax').addEventListener('input', function () {
    needState.max = this.value === '' ? null : Number(this.value);
  });

  var SKIN_ALIAS = { '油皮': ['油', '混油'], '混干': ['混干'], '干皮': ['干', '混干'], '敏感': ['敏'], '中性': ['中性'] };

  function scoreNeed(p) {
    var s = 0, why = [];
    // 品类
    if (needState.type) {
      if (p.l2 === needState.type) { s += 40; why.push('品类匹配'); }
      else if ((needState.type.indexOf(p.l2) >= 0) || (p.l2 && needState.type.indexOf(p.l2) >= 0)) { s += 20; }
    }
    // 肤质
    if (needState.skin) {
      var aliases = SKIN_ALIAS[needState.skin] || [];
      var hay = (p.skin || '') + ' ' + (p.pos || '') + ' ' + (p.neg || '') + ' ' + (p.comments || []).map(function (c) { return c.skin + ' ' + c.text; }).join(' ');
      if (p.skin && aliases.some(function (a) { return p.skin.indexOf(a) >= 0; })) { s += 30; why.push('肤质吻合'); }
      else if (aliases.some(function (a) { return hay.indexOf(a) >= 0; })) { s += 20; why.push('肤质有提及'); }
    }
    // 预算
    var budgetKnown = false;
    if (p.price_cny != null) {
      budgetKnown = true;
      if ((needState.min == null || p.price_cny >= needState.min) && (needState.max == null || p.price_cny <= needState.max)) {
        s += 25; why.push('在预算内');
      } else { s -= 15; }
    } else if (needState.min != null || needState.max != null) {
      s += 3; // 价格未知，微弱加分排前
    }
    // 补充需求关键词
    if (needState.extra) {
      var ex = needState.extra;
      var text = (p.pos || '') + (p.neg || '') + (p.texture || '') + (p.ingredients || '') + (p.name || '');
      var hit = 0;
      ['清爽','不闷','保湿','控油','修护','屏障','舒缓','温和','美白','抗老','去角质','防晒','搓泥','敏感'].forEach(function (w) {
        if (ex.indexOf(w) >= 0 && text.indexOf(w) >= 0) hit++;
      });
      if (hit) { s += hit * 6; why.push('命中需求关键词'); }
    }
    // 数据丰富度兜底
    s += Math.min(10, (p.n_comments || 0) + (p.n_notes || 0));
    return { score: s, why: why, budgetKnown: budgetKnown };
  }

  function renderNeed() {
    var scored = PRODUCTS.map(function (p) { return { p: p, r: scoreNeed(p) }; })
      .sort(function (a, b) { return b.r.score - a.r.score; }).slice(0, 6);
    needScored = scored;
    if (!scored.length) { needResults.innerHTML = ''; return; }
    var h = '<div class="cat-kicker">TOP MATCHES</div><h3 style="margin:6px 0 4px;font-size:18px">为你匹配到 ' + scored.length + ' 款</h3>';
    scored.forEach(function (o, i) {
      var p = o.p;
      var img = p.images.length
        ? '<img class="rc-img" src="' + esc(p.images[0]) + '" alt="' + esc(p.name) + '" loading="lazy">'
        : '<div class="rc-img"></div>';
      var badges = o.r.why.slice(0, 3).map(function (w) {
        return '<span class="match-badge' + (w === '肤质吻合' || w === '在预算内' ? ' high' : '') + '">' + esc(w) + '</span>';
      }).join('');
      var priceTxt = p.price ? ('参考价 ' + esc(p.price)) : '参考价未知';
      var why = p.pos ? p.pos : (p.texture ? '质地：' + p.texture : '综合反馈中性');
      h += '<div class="result-card" data-idx="' + i + '">' + img + '<div class="rc-body">' +
        '<h4>' + esc(p.name) + '</h4>' +
        '<div class="rc-meta">' + esc([p.l2, p.form].filter(Boolean).join(' · ')) + ' · ' + priceTxt + '</div>' +
        '<div class="rc-why">' + badges + '<br>' + esc(String(why).slice(0, 70)) + '</div>' +
        '<div class="rc-more">点击查看详情 →</div>' +
        '</div></div>';
    });
    if (!PRODUCTS.some(function (p) { return p.price_cny != null; })) {
      h += '<p style="color:#9E7070;font-size:12.5px;margin-top:6px">注：库内带明确价格的产品还很少，预算主要用于排序参考，不代表实际售价。</p>';
    }
    needResults.innerHTML = h;
  }

  document.getElementById('needGo').addEventListener('click', function () {
    needState.extra = document.getElementById('needExtra').value.trim();
    detailPanel.hidden = true;
    needResults.hidden = false;
    document.querySelector('.need-form').hidden = false;
    document.querySelector('.need-head').hidden = false;
    renderNeed();
  });

  // 点击匹配卡片 → 就地展开产品详情页（不用弹窗）
  needResults.addEventListener('click', function (e) {
    var card = e.target.closest('.result-card');
    if (!card) return;
    var idx = Number(card.getAttribute('data-idx'));
    var o = needScored[idx];
    if (!o) return;
    showDetail(o.p, needState.type || needState.extra || '', 'need');
  });

  // ===== tabs =====
  var tabs = document.querySelectorAll('.tabs .tab');
  function switchTab(name) {
    tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-tab') === name); });
    favPage.hidden = true;
    compare.hidden = (name !== 'compare');
    needPanel.hidden = (name !== 'need');
    chatCard.hidden = (name !== 'chat');
    if (name !== 'chat') detailPanel.hidden = true;
    var target = name === 'need' ? needPanel : (name === 'compare' ? compare : null);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (name === 'compare') { cmpInput.focus(); }
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { switchTab(t.getAttribute('data-tab')); });
  });

  render();
})();
