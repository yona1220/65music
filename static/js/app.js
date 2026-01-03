'use strict';

/* =========================================================
   100億% 落ちない完全版 app.js
   - videos が無い/壊れてても落ちない
   - スマホ: “…の時だけ”タップで黒い箱（リンクはリンク優先）
   - PC: hover + drag中でも黒箱
   - スマホ: Spotify風 下の再生バー + 再生/停止
   - 下バー文字は1行、はみ出す時だけ左右にゆっくり移動
   - スマホ時のみヘッダー右の「？」→モーダル表示
   ========================================================= */

let player = null;
let ytAPILoaded = false;

let currentSort = { key: "date", order: "desc" };
const VIDEOS = (typeof videos !== "undefined" && Array.isArray(videos)) ? videos : [];
let filteredList = VIDEOS.slice();

let playingRowEl = null;
let currentPlayingId = null;
let currentPlayingStart = 0;

let hasUserGesture = false;

/* -------------------- utils -------------------- */
function buildWatchUrl(id, start) {
  const s = Number(start) || 0;
  const vid = encodeURIComponent(id || "");
  return s > 0
    ? `https://www.youtube.com/watch?v=${vid}&t=${s}s`
    : `https://www.youtube.com/watch?v=${vid}`;
}

function isMobileView() {
  return window.matchMedia("(max-width: 1000px)").matches;
}

function parseDateSafe(s) {
  if (!s) return 0;
  const m = String(s).match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (!m) return Date.parse(s) || 0;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return new Date(y, mo - 1, d).getTime();
}

/* -------------------- YouTube Loader -------------------- */
function ensureYouTubeAPI(cb) {
  if (window.YT && YT.Player) {
    ytAPILoaded = true;
    cb();
    return;
  }
  if (ytAPILoaded) { cb(); return; }

  if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  }

  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    ytAPILoaded = true;
    if (typeof prev === "function") prev();
    cb();
  };
}

function createOrLoadPlayer(id, start = 0) {
  if (!id) return;

  // ★ iOS対策：ユーザー操作前は生成しない
  if (isMobileView() && !hasUserGesture) return;

  currentPlayingId = id;
  currentPlayingStart = start || 0;

  if (!player) {
    ensureYouTubeAPI(() => {
      if (!window.YT || !YT.Player) return;

      player = new YT.Player("player", {
        height: "360",
        width: "640",
        videoId: id,
        playerVars: { playsinline: 1, start: start || 0 },
        events: {
          onReady: () => {
            try { player.playVideo(); } catch (_) {}
            updatePlayPauseUI();
          },
          onStateChange: () => updatePlayPauseUI()
        }
      });
    });
  } else {
    try {
      player.loadVideoById({ videoId: id, startSeconds: start || 0 });
    } catch (_) {}
    updatePlayPauseUI();
  }
}

/* -------------------- Now Playing -------------------- */
function stripKeyFromSong(song) {
  if (!song) return "";
  let s = String(song).trim();
  s = s.replace(/\s*[（(]\s*[#♭b+\-]?\d+\s*[）)]\s*$/u, "").trim();
  s = s.replace(/\s*(?:【|\[|［)\s*[#♭b+\-]?\d+\s*(?:】|\]|］)\s*$/u, "").trim();
  s = s.replace(/\s*(?:key[:：]?\s*)?[#♭b+\-]?\d+\s*$/iu, "").trim();
  return s;
}

function setNowPlaying(v) {
  const songText = stripKeyFromSong(v?.song || "") || "---";
  const artistText = (v?.artist || "").trim() || "---";

  // 上の再生中
  const songEl = document.getElementById("npSong");
  const artistEl = document.getElementById("npArtist");
  if (songEl) songEl.textContent = songText;
  if (artistEl) artistEl.textContent = artistText;

  // 下バー（スマホ）
  const lineEl = document.getElementById("spNpLine");
  if (lineEl) lineEl.textContent = `${songText} / ${artistText}`;

  showBottomBar(true);
  updateBottomBarMarquee();
}

/* 上の再生中：はみ出す時だけ動かす（必要ならCSS側と合わせて使う） */
function updateNowPlayingMarquee() {
  const now = document.getElementById("nowPlaying");
  const npText = now?.querySelector(".npText");
  if (!now || !npText) return;

  // 内容ラップ（任意：今は上の再生中は通常…だけで良いなら、ここは何もしなくてOK）
  // 今回は“下バー”がメインなので、上は静止で問題なし
}

/* -------------------- Bottom Bar (Spotify風) -------------------- */
function showBottomBar(visible) {
  const bar = document.getElementById("spNowPlayingBar");
  if (!bar) return;

  if (visible && isMobileView() && currentPlayingId) {
    bar.classList.add("is-visible");
    bar.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-spbar");
  } else {
    bar.classList.remove("is-visible");
    bar.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-spbar");
    bar.classList.remove("is-marquee");
  }
}

function updateBottomBarMarquee() {
  const bar = document.getElementById("spNowPlayingBar");
  const line = document.getElementById("spNpLine");
  if (!bar || !line) return;

  if (!isMobileView() || bar.getAttribute("aria-hidden") === "true") {
    bar.classList.remove("is-marquee");
    line.style.removeProperty("--sp-marquee-shift");
    line.style.removeProperty("--sp-marquee-duration");
    return;
  }

  // 中身をラップ（HTMLは変えずJSで対応）
  let inner = line.querySelector(".spnpMarquee");
  if (!inner) {
    inner = document.createElement("span");
    inner.className = "spnpMarquee";
    while (line.firstChild) inner.appendChild(line.firstChild);
    line.appendChild(inner);
  }

  // いったん解除
  bar.classList.remove("is-marquee");
  line.style.removeProperty("--sp-marquee-shift");
  line.style.removeProperty("--sp-marquee-duration");

  requestAnimationFrame(() => {
    const overflow = inner.scrollWidth - line.clientWidth;

    // 8px以上で発動
    if (overflow > 8) {
      line.style.setProperty("--sp-marquee-shift", `${overflow}px`);
      const dur = Math.min(18, Math.max(9, overflow / 35 + 9));
      line.style.setProperty("--sp-marquee-duration", `${dur.toFixed(2)}s`);
      bar.classList.add("is-marquee");
    }
  });
}

function getPlayerStateSafe() {
  try { return player?.getPlayerState?.(); } catch (_) { return null; }
}

function updatePlayPauseUI() {
  const btn = document.getElementById("spPlayPauseBtn");
  if (!btn) return;

  const st = getPlayerStateSafe();
  // YT.PlayerState: 1=PLAYING, 2=PAUSED
  const isPlaying = (st === 1);

  btn.textContent = isPlaying ? "❚❚" : "▶︎";
  btn.setAttribute("aria-label", isPlaying ? "停止" : "再生");
}

function togglePlayPause() {
  if (!isMobileView()) return;

  // player がまだ無いなら、今の曲を読み込む
  if (!player || !player.playVideo) {
    if (currentPlayingId) createOrLoadPlayer(currentPlayingId, currentPlayingStart || 0);
    return;
  }

  const st = getPlayerStateSafe();
  if (st === 1) {
    try { player.pauseVideo(); } catch (_) {}
  } else {
    try { player.playVideo(); } catch (_) {}
  }
  updatePlayPauseUI();
}

/* -------------------- Playing row highlight -------------------- */
function setPlayingRow(rowEl, v) {
  if (playingRowEl && playingRowEl !== rowEl) {
    playingRowEl.classList.remove("is-playing");
  }
  playingRowEl = rowEl;
  if (playingRowEl) playingRowEl.classList.add("is-playing");

  currentPlayingId = v?.id || null;
  currentPlayingStart = v?.start || 0;

  setNowPlaying(v);
  updatePlayPauseUI();
}

/* -------------------- Tooltip (黒い箱) -------------------- */
function getTooltipEl() {
  return document.getElementById("tooltip");
}

let lastTipTarget = null;

function hideTooltip() {
  const tooltip = getTooltipEl();
  if (!tooltip) return;
  tooltip.style.display = "none";
  lastTipTarget = null;
}

function isTruncated(el) {
  if (!el) return false;
  const sw = el.scrollWidth  - el.clientWidth;
  const sh = el.scrollHeight - el.clientHeight;
  return sw > 1 || sh > 1;
}

function showTooltipFor(el) {
  const tooltip = getTooltipEl();
  if (!tooltip || !el) return;
  if (!isTruncated(el)) return;

  // 同じ要素を連続タップなら閉じる（スマホで便利）
  if (lastTipTarget === el && tooltip.style.display === "block") {
    hideTooltip();
    return;
  }
  lastTipTarget = el;

  tooltip.textContent = el.textContent;
  tooltip.style.display = "block";

  const rect = el.getBoundingClientRect();
  const ttRect = tooltip.getBoundingClientRect();

  let left = rect.right + 8;
  let top = rect.top;

  if (left + ttRect.width > window.innerWidth) left = rect.left - ttRect.width - 8;
  if (left < 0) { left = rect.left; top = rect.top - ttRect.height - 6; }
  if (top < 0) top = rect.bottom + 6;

  tooltip.style.left = `${Math.max(6, left)}px`;
  tooltip.style.top  = `${Math.max(6, top)}px`;
}

/* PC: hover + drag / SP: “…の時だけ” tap */
function attachTip(el) {
  if (!el) return;

  if (isMobileView()) {
    el.classList.add("tapTip");

    let lastTouch = 0;

    el.addEventListener("touchend", (e) => {
      lastTouch = Date.now();
      if (!isTruncated(el)) return;
      e.preventDefault();
      e.stopPropagation();
      showTooltipFor(el);
    }, { passive: false });

    el.addEventListener("click", (e) => {
      if (Date.now() - lastTouch < 450) return;
      if (!isTruncated(el)) return;
      e.preventDefault();
      e.stopPropagation();
      showTooltipFor(el);
    });

    return;
  }

  // PC hover
  el.addEventListener("mouseenter", () => showTooltipFor(el));
  el.addEventListener("mouseleave", hideTooltip);

  // PC drag
  let md = false;

  const onWinMove = () => {
    if (!md) return;
    if (isTruncated(el)) showTooltipFor(el);
  };
  const onWinUp = () => {
    md = false;
    window.removeEventListener("mousemove", onWinMove, true);
    window.removeEventListener("mouseup", onWinUp, true);
  };

  el.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    md = true;
    if (isTruncated(el)) showTooltipFor(el);
    window.addEventListener("mousemove", onWinMove, true);
    window.addEventListener("mouseup", onWinUp, true);
  });
}

/* -------------------- Row play (scroll-safe) -------------------- */
function bindRowPlay(row, v, playRow) {
  const TH = 12;
  let sx = 0, sy = 0;
  let moved = false;
  let ignoreClickUntil = 0;

  row.addEventListener("click", (e) => {
    if (Date.now() < ignoreClickUntil) return;
    if (e.target.closest("a")) return; // 引用リンクは再生にしない
    playRow();
  });

  row.addEventListener("touchstart", (e) => {
    moved = false;
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY;
  }, { passive: true });

  row.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - sx);
    const dy = Math.abs(t.clientY - sy);
    if (dx > TH || dy > TH) moved = true;
  }, { passive: true });

  row.addEventListener("touchend", (e) => {
    if (e.target.closest("a")) return;
    if (!moved) {
      playRow();
      ignoreClickUntil = Date.now() + 450;
    }
  }, { passive: true });
}

/* -------------------- Render -------------------- */
function renderList(list) {
  const box = document.getElementById("videoList");
  if (!box) return;

  const container = document.getElementById("videoListContainer");
  const prevScrollTop = container ? container.scrollTop : 0;

  box.innerHTML = "";
  const mobile = isMobileView();

  list.forEach((v) => {
    const row = document.createElement("div");
    row.className = "videoItem";

    if (currentPlayingId && v.id === currentPlayingId) {
      row.classList.add("is-playing");
      playingRowEl = row;
    }

    // thumb
    const tw = document.createElement("div");
    tw.className = "thumbWrapper";

    const img = document.createElement("img");
    img.className = "thumb";
    img.src = v.thumbnail || "";
    tw.appendChild(img);

    const date = document.createElement("div");
    date.className = "date";
    date.textContent = v.date || "";
    tw.appendChild(date);

    row.appendChild(tw);

    // song
    {
      const c = document.createElement("div");
      c.className = "col col-song";
      c.textContent = v.song || "";
      attachTip(c);
      row.appendChild(c);
    }

    if (mobile) {
      // meta (artist + composer 横並び)
      {
        const meta = document.createElement("div");
        meta.className = "col col-meta";

        const metaRow = document.createElement("div");
        metaRow.className = "metaRow";

        const artist = document.createElement("div");
        artist.className = "metaItem metaArtist";
        artist.textContent = v.artist || "";
        attachTip(artist);

        const composer = document.createElement("div");
        composer.className = "metaItem metaComposer";
        composer.textContent = v.composer || "";
        attachTip(composer);

        if ((v.artist || "").trim()) metaRow.appendChild(artist);
        if ((v.composer || "").trim()) metaRow.appendChild(composer);

        meta.appendChild(metaRow);
        row.appendChild(meta);
      }

      // singer
      {
        const c = document.createElement("div");
        c.className = "col col-singer";
        c.textContent = v.singer || "";
        attachTip(c);
        row.appendChild(c);
      }

      // title（リンクはリンク優先）
      {
        const tcol = document.createElement("div");
        tcol.className = "col col-title";

        if (v.id) {
          const a = document.createElement("a");
          a.href = buildWatchUrl(v.id, v.start);

          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = v.title || "";
          a.addEventListener("click", (e) => e.stopPropagation());
          a.addEventListener("touchend", (e) => e.stopPropagation(), { passive: true });
          tcol.appendChild(a);
        } else {
          tcol.classList.add("nolink");
          tcol.textContent = v.title || "";
          attachTip(tcol);
        }

        row.appendChild(tcol);
      }
    } else {
      // desktop：表形式
      {
        const c = document.createElement("div");
        c.className = "col col-singer";
        c.textContent = v.singer || "";
        attachTip(c);
        row.appendChild(c);
      }
      {
        const c = document.createElement("div");
        c.className = "col col-artist";
        c.textContent = v.artist || "";
        attachTip(c);
        row.appendChild(c);
      }
      {
        const c = document.createElement("div");
        c.className = "col col-composer";
        c.textContent = v.composer || "";
        attachTip(c);
        row.appendChild(c);
      }
      {
        const tcol = document.createElement("div");
        tcol.className = "col col-title";

        if (v.id) {
          const a = document.createElement("a");
          a.href = "https://www.youtube.com/watch?v=" + v.id;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = v.title || "";
          a.addEventListener("click", (e) => e.stopPropagation());
          tcol.appendChild(a);
        } else {
          tcol.classList.add("nolink");
          tcol.textContent = v.title || "";
        }
        attachTip(tcol);
        row.appendChild(tcol);
      }
    }

    const playRow = () => {
      if (!v.id) return;
      createOrLoadPlayer(v.id, v.start || 0);
      setPlayingRow(row, v);
      showBottomBar(true);
      updateBottomBarMarquee();
    };

    bindRowPlay(row, v, playRow);
    box.appendChild(row);
  });

  const cnt = document.getElementById("countNumber");
  if (cnt) cnt.textContent = String(list.length);

  // 検索で0件になっても、スクロール位置の急ジャンプを抑える
  if (container) container.scrollTop = Math.min(prevScrollTop, container.scrollHeight);
}

/* -------------------- Filter/Search -------------------- */
function filterAndRender() {
  const kw = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const cat = document.getElementById("filterSelect")?.value || "";
  const year = document.getElementById("yearSelect")?.value || "";

  const src = (typeof videos !== "undefined" && Array.isArray(videos)) ? videos : [];

  filteredList = src.filter((v) => {
    const matchCat = !cat || v.category === cat;

    const matchKw = !kw || ["title", "song", "artist", "singer", "composer"]
      .some(k => (v[k] || "").toLowerCase().includes(kw));

    const vYear = (v.date || "").slice(0, 4);
    const matchYear = !year || vYear === year;

    return matchCat && matchKw && matchYear;
  });

  sortList();
  renderList(filteredList);
}

/* -------------------- Sort -------------------- */
function sortList() {
  const key = currentSort.key;
  const order = currentSort.order;

  if (key === "date") {
    filteredList.sort((a, b) => parseDateSafe(b.date) - parseDateSafe(a.date));
    return;
  }

  filteredList.sort((a, b) => {
    const a1 = (a[key] || "");
    const b1 = (b[key] || "");
    const cmp = a1.localeCompare(b1, "ja");
    return order === "asc" ? cmp : -cmp;
  });
}

function headerClickHandler(key) {
  if (currentSort.key === "date") {
    currentSort = { key, order: "asc" };
  } else if (currentSort.key === key && currentSort.order === "asc") {
    currentSort.order = "desc";
  } else if (currentSort.key === key && currentSort.order === "desc") {
    currentSort = { key: "date", order: "desc" };
  } else {
    currentSort = { key, order: "asc" };
  }
  updateHeaderIndicators();
  filterAndRender();
}

function updateHeaderIndicators() {
  document.querySelectorAll(".headerCol").forEach(h => {
    h.classList.remove("sort-default", "sort-asc", "sort-desc");
    const key = h.dataset.key;

    if (currentSort.key === "date") {
      h.classList.add("sort-default");
    } else if (currentSort.key === key) {
      h.classList.add(currentSort.order === "asc" ? "sort-asc" : "sort-desc");
    } else {
      h.classList.add("sort-default");
    }
  });
}

/* -------------------- Header/List scroll sync (desktop) -------------------- */
function syncHorizontalScroll() {
  const head = document.getElementById("listHeaderWrapper");
  const list = document.getElementById("videoListContainer");
  if (!head || !list) return;

  let lock = false;

  list.addEventListener("scroll", () => {
    if (lock) return;
    lock = true;
    head.scrollLeft = list.scrollLeft;
    lock = false;
  }, { passive: true });

  head.addEventListener("scroll", () => {
    if (lock) return;
    lock = true;
    list.scrollLeft = head.scrollLeft;
    lock = false;
  }, { passive: true });
}

/* -------------------- Modal (mobile only) -------------------- */
function setModalOpen(open) {
  const modal = document.getElementById("infoModal");
  if (!modal) return;

  if (open && isMobileView()) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  } else {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }
}

/* -------------------- Init -------------------- */
document.addEventListener("touchend", () => {
  hasUserGesture = true;
}, { once: true });

document.addEventListener("click", () => {
  hasUserGesture = true;
}, { once: true });


document.addEventListener("DOMContentLoaded", () => {
  // 黒箱を「別タップ / スクロール / 指移動」で消す
  const listEl = document.getElementById("videoListContainer");
  const headEl = document.getElementById("listHeaderWrapper");

  document.addEventListener("touchstart", hideTooltip, { passive: true });
  document.addEventListener("mousedown", hideTooltip, { passive: true });
  document.addEventListener("touchmove", hideTooltip, { passive: true });
  window.addEventListener("scroll", hideTooltip, { passive: true });
  if (listEl) listEl.addEventListener("scroll", hideTooltip, { passive: true });
  if (headEl) headEl.addEventListener("scroll", hideTooltip, { passive: true });

  // ヘッダー（ソート）
  document.querySelectorAll(".headerCol").forEach(h => {
    const key = h.dataset.key;
    h.addEventListener("click", () => headerClickHandler(key));
  });

  // 検索/フィルタ
  document.getElementById("searchInput")?.addEventListener("input", filterAndRender);
  document.getElementById("filterSelect")?.addEventListener("change", filterAndRender);
  document.getElementById("yearSelect")?.addEventListener("change", filterAndRender);

  // 下バー：再生/停止ボタン
  document.getElementById("spPlayPauseBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePlayPause();
  });

  // モーダル
  document.getElementById("infoBtn")?.addEventListener("click", () => setModalOpen(true));
  document.getElementById("modalClose")?.addEventListener("click", () => setModalOpen(false));
  document.querySelectorAll("[data-close='1']").forEach(el => {
    el.addEventListener("click", () => setModalOpen(false));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setModalOpen(false);
  });

  updateHeaderIndicators();
  filterAndRender();
  syncHorizontalScroll();

  // 画面幅がPC↔スマホで切り替わったら再描画 + 下バー調整
  let lastMobile = isMobileView();
  window.addEventListener("resize", () => {
    const nowMobile = isMobileView();
    if (nowMobile !== lastMobile) {
      lastMobile = nowMobile;
      hideTooltip();
      renderList(filteredList);
      setModalOpen(false);
    }
    // マーキー再計測
    updateBottomBarMarquee();
    // 下バーはスマホ以外なら閉じる
    if (!isMobileView()) showBottomBar(false);
  }, { passive: true });

  // 最初の動画を自動再生（存在するなら）
  if (filteredList.length > 0 && filteredList[0].id) {
    currentPlayingId = filteredList[0].id;
    currentPlayingStart = filteredList[0].start || 0;
    createOrLoadPlayer(filteredList[0].id, filteredList[0].start || 0);
    setNowPlaying(filteredList[0]);
    renderList(filteredList);
    updatePlayPauseUI();
  } else {
    showBottomBar(false);
  }
});
