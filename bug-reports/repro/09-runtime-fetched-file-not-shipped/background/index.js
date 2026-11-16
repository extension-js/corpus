const CONFIG_URL_BASE = 'https://example.com/config'
const CONFIG = {remote: `${CONFIG_URL_BASE}/sites.config`, local: '../config/sites.config'}
async function load() {
  const response = await fetch(CONFIG.local)
  console.log(await response.text())
}
chrome.runtime.onInstalled.addListener(load)
