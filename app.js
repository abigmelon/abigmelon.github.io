const postList = document.querySelector("#post-list");
const postCount = document.querySelector("#post-count");

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function renderArticleMarkdown(markdown, fallbackTitle) {
  const tokens = marked.lexer(markdown, { gfm: true });
  const firstContentIndex = tokens.findIndex((token) => token.type !== "space");
  const firstContent = tokens[firstContentIndex];
  let title = fallbackTitle;

  // Use a leading Markdown H1 as the page title instead of showing two titles.
  if (firstContent?.type === "heading" && firstContent.depth === 1) {
    const titleElement = document.createElement("div");
    titleElement.innerHTML = DOMPurify.sanitize(marked.parseInline(firstContent.text));
    title = titleElement.textContent;
    tokens.splice(firstContentIndex, 1);
  }

  const headingIds = new Set();
  class ArticleRenderer extends marked.Renderer {
    heading(token) {
      const content = this.parser.parseInline(token.tokens);
      const textElement = document.createElement("div");
      textElement.innerHTML = DOMPurify.sanitize(content);
      // Match GitHub-style fragments used in hand-written contents lists.
      const base = textElement.textContent.trim().toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "").replace(/\s/g, "-") || "section";
      let id = base;
      let suffix = 0;
      while (headingIds.has(id)) id = `${base}-${++suffix}`;
      headingIds.add(id);
      const depth = Math.max(2, token.depth);
      return `<h${depth} id="${escapeHtml(id)}">${content}</h${depth}>\n`;
    }

    table(token) {
      return `<div class="article-table" role="region" aria-label="文章表格，可横向滚动" tabindex="0">${super.table(token)}</div>\n`;
    }
  }

  const html = marked.parser(tokens, { gfm: true, renderer: new ArticleRenderer() });
  return { title, html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) };
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
  const response = await fetch("posts/index.json");
  if (!response.ok) throw new Error("Article index unavailable");
  return await response.json();
}

async function getBody(slug) {
  const response = await fetch(`posts/${encodeURIComponent(slug)}.md`);
  if (!response.ok) throw new Error("Article unavailable");
  return await response.text();
}

function showArticleError(message) {
  document.querySelector("main").innerHTML = `<article class="article-view page-wrap"><a class="article-back" href="./">← 返回首页</a><h1>暂时无法打开文章</h1><p class="article-body">${escapeHtml(message)}</p></article>`;
}

async function showArticle(slug, posts) {
  const post = posts.find((item) => item.slug === slug);
  if (!post) { showArticleError("没有找到这篇文章，请返回首页选择其他文章。"); return; }
  const body = await getBody(slug);
  const article = renderArticleMarkdown(body, post.title);
  document.querySelector("main").innerHTML = `<article class="article-view page-wrap"><a class="article-back" href="./">← 返回首页</a><p class="section-index">BLOG / ${formatDate(post.date)}</p><h1>${escapeHtml(article.title)}</h1><p class="article-meta">${post.tags.map((tag) => `#${escapeHtml(tag)}`).join("  ")}</p><div class="article-body">${article.html}</div></article>`;
  document.title = `${article.title} — abigmelon`;
  document.querySelector(".brand").href = "./#top";
  document.querySelectorAll('.site-nav a[href^="#"]').forEach((link) => {
    link.setAttribute("href", `./${link.getAttribute("href")}`);
  });
  const fragment = window.location.hash.slice(1);
  let target;
  try { target = document.getElementById(decodeURIComponent(fragment)); } catch { /* Ignore malformed fragments. */ }
  if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
}

(async function init() {
  const slug = new URLSearchParams(window.location.search).get("post");
  try {
    const posts = await getPosts();
    if (slug) await showArticle(slug, posts); else renderList(posts);
  } catch {
    if (slug) showArticleError("文章加载失败，请刷新页面后重试。");
    else postList.innerHTML = '<p class="empty-state">文章列表加载失败，请刷新页面后重试。</p>';
  }
})();
