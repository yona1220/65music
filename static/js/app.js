let player = null;
let ytAPILoaded = false;

let currentSort = { key: "date", order: "desc" };
let filteredList = videos.slice();

let playingRowEl = null;
let currentPlayingId = null;

/* Lazy YouTube Loader */
function ensureYouTubeAPI(cb) {
  if (ytAPILoaded) { cb(); return; }
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.body.appendChild(tag);
  window.onYouTubeIframeAPIReady = () => {
    ytAPILoaded = true;
    cb();
  };
}

function createOrLoadPlayer(id, start) {
  if (!id) return;

  if (!player) {
    ensureYouTubeAPI(() => {
      player = new YT.Player("player", {
        height: "360",
        width: "640",
        videoId: id,
        playerVars: { playsinline: 1, start: start || 0 },
        events: {
          onReady: () => {
            const wrap = document.getElementById("playerWrap");
            const ph = document.getElementById("playerPlaceholder");
            if (wrap) wrap.style.display = "block";
            if (ph) ph.style.display = "none";
          }
        }
      });
    });
  } else {
    player.loadVideoById({ videoId: id, startSeconds: start || 0 });
    const wrap = document.getElementById("playerWrap");
    const ph = document.getElementById("playerPlaceholder");
    if (wrap) wrap.style.display = "block";
    if (ph) ph.style.display = "none";
  }
}

/* 再生中行ハイライト */
function setPlayingRow(rowEl, v) {
  if (playingRowEl && playingRowEl !== rowEl) {
    playingRowEl.classList.remove("is-playing");
  }
  playingRowEl = rowEl;
  if (playingRowEl) playingRowEl.classList.add("is-playing");
  currentPlayingId = v?.id || null;
}

/* --- Tooltip（PC: hover / SP: 長押し） --- */
function isTruncated(el) {
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}

function showTooltip(el) {
  const tooltip = document.getElementById("tooltip");
  if (!tooltip) return;
  if (!isTruncated(el)) return;

  tooltip.textContent = el.textContent;
  tooltip.style.display = "block";

  const rect = el.getBoundingClientRect();

  // いったん表示してから幅を取る
  const ttRect = tooltip.getBoundingClientRect();

  let left = rect.right + 8;
  let top = rect.top;

  if (left + ttRect.width > window.innerWidth) {
    left = rect.left - ttRect.width - 8;
  }
  if (left < 0) {
    left = rect.left;
    top = rect.top - ttRect.height - 6;
  }
  if (top < 0) {
    top = rect.bottom + 6;
  }

  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}

function hideTooltip() {
  const tooltip = document.getElementById("tooltip");
  if (!tooltip) return;
  tooltip.style.display = "none";
}

function attachTruncateTooltip(el) {
  const isTouch = window.matchMedia("(max-width: 768px)").matches;

  // PC：hover
  if (!isTouch) {
    el.addEventListener("mouseenter", () => showTooltip(el));
    el.addEventListener("mouseleave", hideTooltip);
    return;
  }

  // SP：長押しだけ
  let pressTimer = null;
  let openedByLongPress = false;

  el.addEventListener("touchstart", () => {
    openedByLongPress = false;
    pressTimer = setTimeout(() => {
      if (!isTruncated(el)) return;
      openedByLongPress = true;
      showTooltip(el);
    }, 350);
  }, { passive: true });

  el.addEventListener("touchend", (e) => {
    clearTimeout(pressTimer);
    if (openedByLongPress) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, { passive: false });

  document.addEventListener("touchstart", hideTooltip, { passive: true });
}

/* --- 行タップ＝再生（スクロール時は発火しない） --- */
function bindRowPlay(row, v) {
  const TH = 12; // 指ブレ許容(px)
  let sx = 0, sy = 0;
  let suppressClick = false;

  const play = () => {
    if (!v.id) return;
    createOrLoadPlayer(v.id, v.start);
    setPlayingRow(row, v);
  };

  // PC / 通常クリック
  row.addEventListener("click", (e) => {
    if (suppressClick) return;
    if (e.target.closest("a")) return; // 引用リンクは別
    play();
  });

  // iOS Safari：touchで “タップのみ” を判定
  row.addEventListener("touchstart", (e) => {
    if (e.target.closest("a")) return;
    const t = e.touches[0];
    sx = t.clientX;
    sy = t.clientY;
  }, { passive: true });

  row.addEventListener("touchend", (e) => {
    if (e.target.closest("a")) return;
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - sx);
    const dy = Math.abs(t.clientY - sy);

    // 動いてたらスクロール扱い（＝再生＆グレーにしない）
    if (dx >= TH || dy >= TH) return;

    suppressClick = true; // touch後に click が来る二重発火を潰す
    play();
    setTimeout(() => { suppressClick = false; }, 400);
  }, { passive: true });
}

/* Render Rows */
function renderList(list) {
  const box = document.getElementById("videoList");
  box.innerHTML = "";

  list.forEach(v => {
    const row = document.createElement("div");
    row.className = "videoItem";

    // いま再生中の動画がリストに残ってる場合、再描画でもハイライト維持
    if (currentPlayingId && v.id === currentPlayingId) {
      playingRowEl = row;
      row.classList.add("is-playing");
    }

    // サムネ
    const tw = document.createElement("div");
    tw.className = "thumbWrapper";

    const img = document.createElement("img");
    img.className = "thumb";
    img.src = v.thumbnail;
    tw.appendChild(img);

    const date = document.createElement("div");
    date.className = "date";
    date.textContent = v.date;
    tw.appendChild(date);

    row.appendChild(tw);

    const colClassMap = {
      song: "col-song",
      singer: "col-singer",
      artist: "col-artist",
      composer: "col-composer",
      title: "col-title"
    };

    ["song", "singer", "artist", "composer"].forEach(key => {
      const c = document.createElement("div");
      c.className = `col ${colClassMap[key]}`;
      c.textContent = v[key] || "";
      attachTruncateTooltip(c);
      row.appendChild(c);
    });

    // 引用（リンク or 文字）
    const tcol = document.createElement("div");
    tcol.className = `col ${colClassMap.title}`;

    if (v.id) {
      const a = document.createElement("a");
      a.href = "https://www.youtube.com/watch?v=" + v.id;
      a.target = "_blank";
      a.textContent = v.title;

      // リンク押しは行再生に波及させない
      a.addEventListener("click", (e) => e.stopPropagation());
      a.addEventListener("touchend", (e) => e.stopPropagation(), { passive: true });

      tcol.appendChild(a);
    } else {
      tcol.classList.add("nolink");
      tcol.textContent = v.title;
    }

    attachTruncateTooltip(tcol);
    row.appendChild(tcol);

    // ★行タップ再生（スクロール時は発火しない）
    bindRowPlay(row, v);

    box.appendChild(row);
  });

  document.getElementById("countNumber").textContent = list.length;
}

/* 検索・フィルタ */
function filterAndRender() {
  const kw = (document.getElementById("searchInput").value || "").toLowerCase();
  const cat = document.getElementById("filterSelect").value;
  const yearEl = document.getElementById("yearSelect");
  const year = yearEl ? yearEl.value : "";

  filteredList = videos.filter(v => {
    const matchCat = !cat || v.category === cat;
    const matchKw = !kw || ["title", "song", "artist", "singer", "composer"]
      .some(k => (v[k] || "").toLowerCase().includes(kw));

    // 年フィルタ（v.dateが "YYYY/MM/DD" 想定）
    const vYear = (v.date || "").slice(0, 4);
    const matchYear = !year || vYear === year;

    return matchCat && matchKw && matchYear;
  });

  sortList();
  renderList(filteredList);
}

/* ソート */
function sortList() {
  const key = currentSort.key;
  const order = currentSort.order;

  if (key === "date") {
    filteredList.sort((a, b) => new Date(b.date) - new Date(a.date));
    return;
  }

  filteredList.sort((a, b) => {
    const a1 = (a[key] || "");
    const b1 = (b[key] || "");
    const cmp = a1.localeCompare(b1, "ja");
    return order === "asc" ? cmp : -cmp;
  });
}

/* ヘッダークリック */
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

/* ヘッダーとリストの横スクロール同期（双方向） */
function syncHorizontalScroll() {
  const head = document.getElementById("listHeaderWrapper");
  const list = document.getElementById("videoListContainer");
  if (!head || !list) return;

  let lock = false;

  const clampHead = () => {
    const max = head.scrollWidth - head.clientWidth;
    head.scrollLeft = Math.min(head.scrollLeft, Math.max(0, max));
  };

  list.addEventListener("scroll", () => {
    if (lock) return;
    lock = true;
    head.scrollLeft = list.scrollLeft;
    clampHead();
    lock = false;
  }, { passive: true });

  head.addEventListener("scroll", () => {
    if (lock) return;
    lock = true;
    list.scrollLeft = head.scrollLeft;
    lock = false;
  }, { passive: true });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".headerCol").forEach(h => {
    const key = h.dataset.key;
    h.addEventListener("click", () => headerClickHandler(key));
  });

  document.getElementById("searchInput").addEventListener("input", filterAndRender);
  document.getElementById("filterSelect").addEventListener("change", filterAndRender);

  const yearEl = document.getElementById("yearSelect");
  if (yearEl) yearEl.addEventListener("change", filterAndRender);

  filteredList = videos.slice();
  updateHeaderIndicators();
  filterAndRender();
  syncHorizontalScroll();

  // 表示時に先頭動画を自動再生（ハイライトも付けたいなら first 行をタップする設計に変えるが、今回は再生のみ）
  if (filteredList.length > 0 && filteredList[0].id) {
    currentPlayingId = filteredList[0].id;
    createOrLoadPlayer(filteredList[0].id, filteredList[0].start);
    // 再描画で is-playing が付く（currentPlayingId を見てる）
    filterAndRender();
  }
});
