
g_search_map = {
  bing: "https://cn.bing.com/search?q=",
  baidu: "https://www.baidu.com/s?wd=",
  google: "https://www.google.com/search?q="
};

/** 搜索 */
function onSearchTypeChange(save = true) {
  const searchType = document.getElementById('searchType');
  searchType.setAttribute('type', searchType.value);
  save && localStorage.setItem('searchType', searchType.value);
}

function onSearch() {
  const searchType = document.getElementById('searchType');
  const searchText = document.getElementById('searchText');
  window.open(`${g_search_map[searchType.value]}${searchText.value}`);
}


window.onload = () => {
  const searchType = document.getElementById('searchType');
  const saveType = localStorage.getItem('searchType') || 'bing';
  searchType.value = saveType;
  onSearchTypeChange(false);
}