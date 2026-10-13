const fallbackPosts = [
  { slug: "sqlfinder-notes", title: "SQLFINDER：从一句话到一条查询", date: "2026-10-12", excerpt: "记录我第一次把自然语言、SQL 生成和结果展示串成一个可运行工具的过程。", tags: ["项目拆解", "Java"] }
];

const fallbackBodies = {
  "sqlfinder-notes": `# SQLFINDER：从一句话到一条查询

SQLFINDER 是我最近在做的一个小工具：用户输入自然语言问题，系统生成 SQL，执行查询，再把结果展示出来。这个项目让我第一次把后端接口、数据库和一个具体的用户问题放在同一条链路里思考。

## 为什么从问数开始

数据库里的信息很多，但“知道应该怎么查”本身就需要经验。SQLFINDER 想先把这段经验变成可以被观察、被修改的中间结果：生成的 SQL 会直接展示出来，查询结果也会保留原始表格结构。

## 目前的链路

- 接收用户的自然语言问题
- 根据表结构生成 SQL
- 执行查询并返回结果
- 在页面中同时展示 SQL 和数据

## 下一步

我会继续补齐错误提示、查询安全和更细的结果解释。先让每一条查询都能被看懂，再让它变得更快。`
};

const postList = document.querySelector("#post-list");
const postCount = document.querySelector("#post-count");
const pageSections = [...document.querySelectorAll("main > section")];

function escapeHtml(value) {
  return value.replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.replaceAll("\r", "").split("\n");
  const html = [];
  let paragraph = [];
  let list = false;
  let code = false;
  let codeLines = [];

  const flushParagraph = () => {
    if (paragraph.length) { html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`); paragraph = []; }
  };
  const closeList = () => { if (list) { html.push("</ul>"); list = false; } };
  const closeCode = () => { if (code) { html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`); code = false; codeLines = []; } };

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) { flushParagraph(); closeList(); if (code) closeCode(); else code = true; return; }
    if (code) { codeLines.push(line); return; }
    if (!line.trim()) { flushParagraph(); closeList(); return; }
    if (line.startsWith("## ")) { flushParagraph(); closeList(); html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`); return; }
    if (line.startsWith("### ")) { flushParagraph(); closeList(); html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`); return; }
    if (line.startsWith("# ")) { flushParagraph(); closeList(); html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`); return; }
    if (line.startsWith("- ")) { flushParagraph(); if (!list) { html.push("<ul>"); list = true; } html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`); return; }
    paragraph.push(line.trim());
  });
  flushParagraph(); closeList(); closeCode();
  return html.join("\n");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${value}T00:00:00`)).replaceAll("/", ".");
}

function renderList(posts) {
  postCount.textContent = String(posts.length).padStart(2, "0");
  if (!posts.length) { postList.innerHTML = '<p class="empty-state">还没有文章，第一篇正在路上。</p>'; return; }
  postList.innerHTML = posts.map((post) => `<a class="post-item" href="?post=${encodeURIComponent(post.slug)}"><span class="post-date">${formatDate(post.date)}</span><span><strong class="post-title">${escapeHtml(post.title)}</strong><span class="post-excerpt">${escapeHtml(post.excerpt)}</span><span class="post-tags">${post.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</span></span><span class="post-arrow" aria-hidden="true">↗</span></a>`).join("");
}

async function getPosts() {
  try { const response = await fetch("posts/index.json"); if (!response.ok) throw new Error("index unavailable"); return await response.json(); }
  catch { return fallbackPosts; }
}

async function getBody(slug) {
  try { const response = await fetch(`posts/${encodeURIComponent(slug)}.md`); if (!response.ok) throw new Error("post unavailable"); return await response.text(); }
  catch { return fallbackBodies[slug] || "# 文章还在整理中\n\n这篇文章暂时还没有内容。"; }
}

async function showArticle(slug, posts) {
  const post = posts.find((item) => item.slug === slug);
  if (!post) return;
  const body = await getBody(slug);
  document.querySelector("main").innerHTML = `<article class="article-view page-wrap"><a class="article-back" href="./">← 返回首页</a><p class="section-index">BLOG / ${formatDate(post.date)}</p><h1>${escapeHtml(post.title)}</h1><p class="article-meta">${post.tags.map((tag) => `#${escapeHtml(tag)}`).join("  ")}</p><div class="article-body">${markdownToHtml(body)}</div></article>`;
  document.title = `${post.title} — abigmelon`;
  window.scrollTo(0, 0);
}

(async function init() {
  const posts = await getPosts();
  const slug = new URLSearchParams(window.location.search).get("post");
  if (slug) await showArticle(slug, posts); else renderList(posts);
})();
