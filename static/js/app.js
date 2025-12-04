'use strict';

let player = null;
let ytAPILoaded = false;

let currentSort = { key: "date", order: "desc" };
const VIDEOS = (typeof videos !== "undefined" && Array.isArray(videos)) ? videos : [];
let filteredList = VIDEOS.slice();

let playingRowEl = null;
let currentPlayingId = null;

/* -------------------- utils -------------------- */
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

function showPlayerUI() {
  const wrap = document.getElementById("playerWrap");
  const ph = document.getElementById("playerPlaceholder");
  if (wrap) wrap.style.display = "block";
  if (ph) ph.style.display = "none";
}

function createOrLoadPlayer(id, start = 0) {
  if (!id) return;

  const onReadyCommon = () => showPlayerUI();

  if (!player) {
    ensureYouTubeAPI(() => {
      if (!window.YT || !YT.Player) return;
      player = new YT.Player("player", {
        height: "360",
        width: "640",
        videoId: id,
        playerVars: { playsinline: 1, start: start || 0 },
        events: { onReady: onReadyCommon }
      });
    });
  } else {
    player.loadVideoById({ videoId: id, startSeconds: start || 0 });
    onReadyCommon();
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
  const songEl = document.getElementById("npSong");
  const artistEl = document.getElementById("npArtist");
  if (songEl) songEl.textContent = stripKeyFromSong(v?.song || "") || "---";
  if (artistEl) artistEl.textContent = (v?.artist || "").trim() || "---";
}

function setPlayingRow(rowEl, v) {
  if (playingRowEl && playingRowEl !== rowEl) {
    playingRowEl.classList.remove("is-playing");
  }
  playingRowEl = rowEl;
  if (playingRowEl) playingRowEl.classList.add("is-playing");
  currentPlayingId = v?.id || null;
  setNowPlaying(v);
}

/* -------------------- Tooltip (黒い箱) -------------------- */
function getTooltipEl() {
  return document.getElementById("tooltip");
}

function hideTooltip() {
  const tooltip = getTooltipEl();
  if (!tooltip) return;
  tooltip.style.display = "none";
}

function isTruncated(el) {
  if (!el) return false;
  const sw = el.scrollWidth  - el.clientWidth;
  const sh = el.scrollHeight - el.clientHeight;
  return sw > 1 || sh > 1; // 横 or 縦で詰まってたら true
}

function showTooltipFor(el) {
  const tooltip = getTooltipEl();
  if (!tooltip || !el) return;
  if (!isTruncated(el)) return;

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
  tooltip.style.top = `${Math.max(6, top)}px`;
}

/* PC: hover / SP: “…の時だけ” tapで黒箱 */
function attachTip(el) {
  if (!el) return;

  if (isMobileView()) {
    el.classList.add("tapTip");

    let lastTouch = 0;

    el.addEventListener("touchend", (e) => {
      lastTouch = Date.now();
      if (!isTruncated(el)) return;          // …じゃないなら何もしない
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

  // ✅ PC drag でも黒箱を出す（ドラッグ中にカーソルが外れても window で追う）
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
    if (e.button !== 0) return; // 左クリックのみ
    md = true;

    if (isTruncated(el)) showTooltipFor(el);

    // captureで拾う（テキスト選択中でも取りこぼしにくい）
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
      // meta (artist + composer)
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

      // title (リンクで飛ぶ / …なら黒箱はnolink時のみ)
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
    };

    bindRowPlay(row, v, playRow);

    box.appendChild(row);
  });

  const cnt = document.getElementById("countNumber");
  if (cnt) cnt.textContent = String(list.length);
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

/* -------------------- Init -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // ✅ 黒箱を「別タップ / スクロール / 指移動」で消す（スマホ最優先）
  const listEl = document.getElementById("videoListContainer");
  const headEl = document.getElementById("listHeaderWrapper");

  // どこタップでも消える
  document.addEventListener("touchstart", hideTooltip, { passive: true });
  document.addEventListener("mousedown", hideTooltip, { passive: true });

  // 指が動いた瞬間に消える（スクロール開始で消える）
  document.addEventListener("touchmove", hideTooltip, { passive: true });

  // スクロールで消える（window + リスト + ヘッダ）
  window.addEventListener("scroll", hideTooltip, { passive: true });
  if (listEl) listEl.addEventListener("scroll", hideTooltip, { passive: true });
  if (headEl) headEl.addEventListener("scroll", hideTooltip, { passive: true });

  // headers
  document.querySelectorAll(".headerCol").forEach(h => {
    const key = h.dataset.key;
    h.addEventListener("click", () => headerClickHandler(key));
  });

  // inputs
  document.getElementById("searchInput")?.addEventListener("input", filterAndRender);
  document.getElementById("filterSelect")?.addEventListener("change", filterAndRender);
  document.getElementById("yearSelect")?.addEventListener("change", filterAndRender);

  updateHeaderIndicators();
  filterAndRender();
  syncHorizontalScroll();

  // 画面幅がPC↔スマホで切り替わったら再描画
  let lastMobile = isMobileView();
  window.addEventListener("resize", () => {
    const nowMobile = isMobileView();
    if (nowMobile !== lastMobile) {
      lastMobile = nowMobile;
      hideTooltip();
      renderList(filteredList);
    }
  }, { passive: true });

  // auto play first
  if (filteredList.length > 0 && filteredList[0].id) {
    currentPlayingId = filteredList[0].id;
    createOrLoadPlayer(filteredList[0].id, filteredList[0].start || 0);
    setNowPlaying(filteredList[0]);
    renderList(filteredList);
  }
});
