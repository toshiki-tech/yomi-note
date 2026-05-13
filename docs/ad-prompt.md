# YomiNote 广告图 — ChatGPT / DALL·E / Midjourney 提示词

把下面整段复制给 ChatGPT（或任意支持图像生成的模型），就能产出一张 YomiNote 的产品广告图。先讲思路，再给主提示词，最后是不同尺寸 / 用途的变体。

---

## 一、核心思路（先把这 4 件事告诉模型）

1. **产品是什么** — 日本語学習者向け Markdown 桌面编辑器
2. **核心卖点** — 漢字に振り仮名 + 外来語カタカナに英訳，实时预览
3. **视觉调性** — 和風 / Zen / 极简 / 暖白 + 墨黑 + 一抹和风朱色
4. **构图与字数** — 少字，强 logo / slogan 一句话

把这 4 条塞进 prompt，结果会稳得多。

---

## 二、主提示词（横版广告图 · 直接复制可用）

```
请帮我画一张 YomiNote 的产品广告图。

【产品】
YomiNote 是一款桌面端 Markdown 编辑器，专为日语阅读 / 学习场景设计，主打：
- 漢字に自動でふりがな (kanji → hiragana 注音)
- カタカナ外来語に英訳ヒント (loanword → English gloss)
- 左右分栏的实时 Markdown 预览
- 安静、专注的禅意写作氛围

【一句话标语 (任选其一放在画面上)】
1) 日本語を、もっと読みやすく。
2) Read Japanese, beautifully.
3) Markdown × ふりがな × 学習

【风格】
- 现代日式极简 / Zen，不要传统浮世绘风
- 主色:暖白底 (#FBF9F4) + 墨黑文字 + 一抹朱色点缀 (#C0392B 系)
- 留白多,呼吸感强,类似 Notion / iA Writer / 苹果发布会海报的克制
- 字体氛围:细衬线 + 等宽 Mono 混排
- 不要花哨光效、不要 3D 渲染、不要炫酷渐变

【画面构成】
中央或右侧:一台笔记本电脑 / 平板的简化几何示意,屏幕里是 YomiNote 编辑界面 ——
- 左半是 Markdown 源码 (看得到 # 标题、列表、`{漢字|かんじ}` 这样的标记)
- 右半是预览:日语段落,漢字上方有小号 ふりがな ruby 注音;某个カタカナ词上方
  用细线带出英文译注 (例如 「カメラ → camera」)

左侧或下方:留白区域放标语 + 一个简洁的 "YomiNote" 文字 logo。

【尺寸】
横版 16:9,适合官网首屏 / X (Twitter) 头图。

【避免】
- 不要加任何乱码假日文 (字符要么真实存在要么用占位线条,不要瞎拼)
- 不要塞太多按钮 / 工具栏细节
- 不要写错别字,关键词 "YomiNote" 务必拼写正确
```

---

## 三、不同场景的变体

只需把主提示词最后两段（**画面构成 / 尺寸**）换成下面对应版本即可。

### 1. 应用商店主图 / Product Hunt 头图（方形 1:1）

```
【尺寸】1:1 方形。
【画面构成】
居中是 YomiNote 的应用图标 (一个柔和的暖白圆角方块,里面是一笔写就的
「読」字或一个抽象的笔尖 + ruby 小点)。下方一行 slogan,再下方一行小字
「Markdown · ふりがな · 英訳」。背景纯净,仅有极淡的米色网格暗示稿纸。
```

### 2. 社媒封面（X / 小红书 · 竖版 4:5）

```
【尺寸】竖版 4:5。
【画面构成】
上 1/3 是大留白 + slogan;
中 1/3 是编辑器界面的特写 —— 只截取一段日文,漢字上密密麻麻的振り仮名
清晰可读,一个カタカナ词被高亮,旁边浮出英文气泡 "camera";
下 1/3 是 YomiNote logo + 一行功能罗列。
```

### 3. 高保真 UI mockup（更"真实"的产品截图风）

```
风格改为:高保真 UI mockup,像真实截图但更干净。
等宽字体显示 Markdown 源码,右侧预览里的 ruby 注音必须是真实可读的日文
(例: 漢字 (かんじ) / 学習 (がくしゅう) / カメラ (camera))。
配色保持暖白 + 墨黑 + 朱红强调色,深色模式也可以做一版作为对比。
```

---

## 四、几个小技巧

- **生成出来的日文大概率会乱码**。让模型先画占位字符,再用 Figma / Photoshop 把真字贴上去更稳。
- 一次出图不满意时,回它一句 **「保留构图,把屏幕里的 ふりがな 改得更清晰可读,并把朱色点缀减少到一处」**,这种局部修改指令比"重画一张"快很多。
- 想要"高级感"就强调 **留白 + 衬线 + 一处强对比色**,不要让模型加太多元素。
- 模型容易把 "YomiNote" 拼成 "YomiMote" / "Yominate" 等,出图后务必检查 logo 文字。

---

## 五、英文版主提示词（投 Product Hunt / 海外社媒时用）

```
Please design a product ad image for YomiNote.

【Product】
YomiNote is a desktop Markdown editor designed for Japanese reading
and learning. Key features:
- Automatic furigana (kanji -> hiragana) reading aids
- English glosses for katakana loanwords
- Live side-by-side Markdown preview
- A calm, zen writing atmosphere

【Tagline (pick one for the image)】
1) Read Japanese, beautifully.
2) Markdown × Furigana × Learning
3) 日本語を、もっと読みやすく。

【Style】
- Modern Japanese minimalism / Zen — NOT traditional ukiyo-e
- Warm off-white (#FBF9F4) + ink black + a single accent of vermilion (#C0392B)
- Generous whitespace, restrained like Notion / iA Writer / Apple keynote posters
- Mix of fine serif + monospace typography
- No flashy effects, no 3D, no rainbow gradients

【Composition】
On one side, a stylized laptop or tablet showing the YomiNote interface:
- Left pane: Markdown source with headings, lists, and ruby syntax like
  `{漢字|かんじ}`
- Right pane: rendered preview with small furigana above kanji, and one
  katakana word ("カメラ") with an English gloss ("camera") floating beside it
On the other side: whitespace with the tagline and a clean "YomiNote"
wordmark.

【Format】
16:9 landscape, suitable for a website hero and X/Twitter banner.

【Avoid】
- Do NOT invent fake Japanese characters — keep text either real or
  abstract placeholder lines
- Do NOT crowd the UI with too many buttons
- Spell "YomiNote" exactly as written
```

---

> 把你拿到的图发我，我可以再给你建议下一轮怎么调。
