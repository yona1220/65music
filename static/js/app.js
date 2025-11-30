let player;

function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "390",
    width: "640",
    videoId: videos[0].id || "",
    playerVars: { playsinline: 1 }
  });
}

/* リスト描画 */
function renderList(list) {
  const container = document.getElementById("videoList");
  container.innerHTML = "";

  list.forEach(v => {
    const div = document.createElement("div");
    div.className = "videoItem";
    if (!v.id) div.classList.add("disabled");

    // サムネ
    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = "thumbWrapper";
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = v.thumbnail;
    const dateDiv = document.createElement("div");
    dateDiv.className = "date";
    dateDiv.textContent = v.date;
    thumbWrapper.appendChild(img);
    thumbWrapper.appendChild(dateDiv);
    div.appendChild(thumbWrapper);

    // 他のカラム
    ["song", "singer", "artist", "composer", "title"].forEach(key => {
      const col = document.createElement("div");
      col.className = "col";
      col.textContent = v[key] || "";
      div.appendChild(col);
    });

    // クリックで再生
    if (v.id) {
      div.addEventListener("click", () => {
        player.loadVideoById({ videoId: v.id, startSeconds: v.start });
      });
    }

    container.appendChild(div);
  });
}

/* 検索・絞り込み */
function filterVideos() {
  const keyword = document.getElementById("searchInput").value.toLowerCase();
  const category = document.getElementById("filterSelect").value;

  const filtered = videos.filter(v => {
    const matchesKeyword =
      v.title.toLowerCase().includes(keyword) ||
      v.song.toLowerCase().includes(keyword) ||
      v.artist.toLowerCase().includes(keyword) ||
      v.singer.toLowerCase().includes(keyword) ||
      (v.composer && v.composer.toLowerCase().includes(keyword));
    const matchesCategory = category === "" || v.category === category;
    return matchesKeyword && matchesCategory;
  });

  renderList(filtered);
}

document.getElementById("searchInput").addEventListener("input", filterVideos);
document.getElementById("filterSelect").addEventListener("change", filterVideos);

/* 初期表示 */
renderList(videos);

/* ヘッダーとリスト横スクロール同期 */
const headerWrapper = document.getElementById("listHeaderWrapper");
const listContainer = document.getElementById("videoListContainer");
listContainer.addEventListener("scroll", () => {
  headerWrapper.scrollLeft = listContainer.scrollLeft;
});
