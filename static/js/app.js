let player = null;
let ytAPILoaded = false;

let currentSort = { key:"date", order:"desc" };
let filteredList = videos.slice();

/* Lazy YouTube Loader */
function ensureYouTubeAPI(cb){
  if(ytAPILoaded){ cb(); return; }
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  document.body.appendChild(tag);
  window.onYouTubeIframeAPIReady = () => {
    ytAPILoaded = true;
    cb();
  };
}

function createOrLoadPlayer(id, start){
  if(!player){
    ensureYouTubeAPI(()=>{
      player = new YT.Player("player",{
        height:"360",
        width:"640",
        videoId:id,
        playerVars:{playsinline:1,start},
        events:{
          onReady:()=>{
            document.getElementById("playerWrap").style.display="block";
            document.getElementById("playerPlaceholder").style.display="none";
          }
        }
      });
    });
  } else {
    player.loadVideoById({ videoId:id, startSeconds:start });
    document.getElementById("playerWrap").style.display="block";
    document.getElementById("playerPlaceholder").style.display="none";
  }
}

const tooltip = document.getElementById("tooltip");

/* テキスト省略されているか判定 */
function isTruncated(el) {
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}

function attachTruncateTooltip(el) {
  const tooltip = document.getElementById("tooltip");
  let isTouch = window.matchMedia("(max-width: 768px)").matches;

  // PC：マウス操作
  if (!isTouch) {
    el.addEventListener("mouseenter", () => showTooltip(el));
    el.addEventListener("mouseleave", () => hideTooltip());
  }

  // スマホ：タップで表示
  if (isTouch) {
    el.addEventListener("click", () => {
      showTooltip(el); // 省略されてる時だけ出る（isTruncatedで弾かれる）
    });

    document.addEventListener("click", () => hideTooltip());
  }
}

function showTooltip(el) {
  const tooltip = document.getElementById("tooltip");
  if (!isTruncated(el)) return;

  tooltip.textContent = el.textContent;
  tooltip.style.display = "block";

  const rect = el.getBoundingClientRect();
  const ttRect = tooltip.getBoundingClientRect();

  let top, left;

  // ------ ① 右に表示
  left = rect.right + 8;
  top = rect.top;

  if (left + ttRect.width > window.innerWidth) {
    // ------ ② 右がダメ → 左に表示
    left = rect.left - ttRect.width - 8;
  }

  if (left < 0) {
    // ------ ③ 左もダメ → 上に表示
    left = rect.left;
    top = rect.top - ttRect.height - 6;
  }

  // 上もダメなら最終的に下
  if (top < 0) {
    top = rect.bottom + 6;
  }

  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}

function hideTooltip() {
  const tooltip = document.getElementById("tooltip");
  tooltip.style.display = "none";
}

// 省略されている(…になる)か判定
function isTruncated(el) {
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}


function showTooltip(el) {
  const tooltip = document.getElementById("tooltip");
  if (!isTruncated(el)) return;

  tooltip.textContent = el.textContent;
  tooltip.style.display = "block";

  const rect = el.getBoundingClientRect();
  const ttRect = tooltip.getBoundingClientRect();

  let top, left;

  // ------ ① 右に表示
  left = rect.right + 8;
  top = rect.top;

  if (left + ttRect.width > window.innerWidth) {
    // ------ ② 右がダメ → 左に表示
    left = rect.left - ttRect.width - 8;
  }

  if (left < 0) {
    // ------ ③ 左もダメ → 上に表示
    left = rect.left;
    top = rect.top - ttRect.height - 6;
  }

  // 上もダメなら最終的に下
  if (top < 0) {
    top = rect.bottom + 6;
  }

  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}

function hideTooltip() {
  const tooltip = document.getElementById("tooltip");
  tooltip.style.display = "none";
}

// 省略されている(…になる)か判定
function isTruncated(el) {
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}



/* Render Rows */
function renderList(list){
  const box = document.getElementById("videoList");
  box.innerHTML="";

  list.forEach(v=>{
    const row = document.createElement("div");
    row.className = "videoItem";

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

    // テキスト列のクラス対応表
    const colClassMap = {
      song: "col-song",
      singer: "col-singer",
      artist: "col-artist",
      composer: "col-composer",
      title: "col-title"
    };

    // テキスト列を生成
    ["song","singer","artist","composer"].forEach(key => {
      const c = document.createElement("div");
      c.className = `col ${colClassMap[key]}`;  // ←個別クラスを追加！
      c.textContent = v[key] || "";
      attachTruncateTooltip(c);
      row.appendChild(c);
    });


    // 引用（リンク or 文字）
    const tcol = document.createElement("div");
    tcol.className = `col ${colClassMap.title}`;
    if(v.id){
      const a = document.createElement("a");
      a.href = "https://www.youtube.com/watch?v=" + v.id;
      a.target = "_blank";
      a.textContent = v.title;
      a.addEventListener("click", e=>e.stopPropagation());
      tcol.appendChild(a);
    } else {
      tcol.classList.add("nolink");
      tcol.textContent = v.title;
    }
    attachTruncateTooltip(tcol);
    row.appendChild(tcol);

    // click → 再生（id が無いものでもクリック可能）
    row.addEventListener("click",()=>{
      if(v.id){
        createOrLoadPlayer(v.id, v.start);
      }
    });

    box.appendChild(row);
  });

  document.getElementById("countNumber").textContent = list.length;
}

/* 検索・フィルタ */
function filterAndRender(){
  const kw = document.getElementById("searchInput").value.toLowerCase();
  const cat = document.getElementById("filterSelect").value;

  filteredList = videos.filter(v=>{
    const matchCat = !cat || v.category === cat;
    const matchKw = !kw || ["title","song","artist","singer","composer"]
      .some(k => (v[k]||"").toLowerCase().includes(kw));
    return matchCat && matchKw;
  });

  sortList();
  renderList(filteredList);
}

/* ソート */
function sortList(){
  const key = currentSort.key;
  const order = currentSort.order;

  if(key === "date"){
    filteredList.sort((a,b)=> new Date(b.date) - new Date(a.date));
    return;
  }

  filteredList.sort((a,b)=>{
    const a1 = (a[key]||"");
    const b1 = (b[key]||"");
    const cmp = a1.localeCompare(b1, "ja");
    return order === "asc" ? cmp : -cmp;
  });
}

/* ヘッダークリック */
function headerClickHandler(key){
  if(currentSort.key==="date"){
    currentSort = { key, order:"asc" };
  } else if(currentSort.key===key && currentSort.order==="asc"){
    currentSort.order="desc";
  } else if(currentSort.key===key && currentSort.order==="desc"){
    currentSort = { key:"date", order:"desc" };
  } else {
    currentSort = { key, order:"asc" };
  }
  updateHeaderIndicators();
  filterAndRender();
}

function updateHeaderIndicators(){
  document.querySelectorAll(".headerCol").forEach(h=>{
    h.classList.remove("sort-default","sort-asc","sort-desc");
    const key = h.dataset.key;

    if(currentSort.key==="date"){
      h.classList.add("sort-default");
    } else if(currentSort.key===key){
      h.classList.add(currentSort.order==="asc" ? "sort-asc" : "sort-desc");
    } else {
      h.classList.add("sort-default");
    }
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".headerCol").forEach(h=>{
    const key = h.dataset.key;
    h.addEventListener("click",()=>headerClickHandler(key));
  });

  document.getElementById("searchInput").addEventListener("input", filterAndRender);
  document.getElementById("filterSelect").addEventListener("change", filterAndRender);

  filteredList = videos.slice();
  updateHeaderIndicators();
  filterAndRender();

  const head = document.getElementById("listHeaderWrapper");
  const list = document.getElementById("videoListContainer");
  list.addEventListener("scroll",()=> head.scrollLeft = list.scrollLeft);
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".headerCol").forEach(h=>{
    const key = h.dataset.key;
    h.addEventListener("click",()=>headerClickHandler(key));
  });

  document.getElementById("searchInput").addEventListener("input", filterAndRender);
  document.getElementById("filterSelect").addEventListener("change", filterAndRender);

  filteredList = videos.slice();
  updateHeaderIndicators();
  filterAndRender();

  const head = document.getElementById("listHeaderWrapper");
  const list = document.getElementById("videoListContainer");
  list.addEventListener("scroll",()=> head.scrollLeft = list.scrollLeft);

  /* ▼ 追加：サイト表示時に先頭動画を自動再生 ▼ */
  if (filteredList.length > 0 && filteredList[0].id) {
    createOrLoadPlayer(filteredList[0].id, filteredList[0].start);
  }
});

  // const colSong = document.createElement("div");
  // colSong.className = "col col-song";
  // colSong.textContent = v.song;
  // row.appendChild(colSong);

  // const colSinger = document.createElement("div");
  // colSinger.className = "col col-singer";
  // colSinger.textContent = v.singer;
  // row.appendChild(colSinger);

  // const colArtist = document.createElement("div");
  // colArtist.className = "col col-artist";
  // colArtist.textContent = v.artist;
  // row.appendChild(colArtist);

  // const colComposer = document.createElement("div");
  // colComposer.className = "col col-composer";
  // colComposer.textContent = v.composer;
  // row.appendChild(colComposer);

  // const colTitle = document.createElement("div");
  // colTitle.className = "col col-title";
  // colTitle.textContent = v.title;
  // row.appendChild(colTitle);
