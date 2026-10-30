// Does window `load` fire when the HTML stream is cut (socket destroyed mid-chunked-body)?
// Case "drop": send part of the page, then destroy the socket after 500 ms.
// Case "stall": send part of the page and keep the socket open for 4 s, then end.
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire('/Users/alexis/Documents/GitHub/brumate/package.json');
const { chromium } = require(process.argv[2]);

const head = `<!doctype html><html><body><script>
window.log=[];const t0=performance.now();
addEventListener('DOMContentLoaded',()=>log.push(['DOMContentLoaded',Math.round(performance.now()-t0)]));
addEventListener('load',()=>log.push(['load',Math.round(performance.now()-t0)]));
addEventListener('error',()=>log.push(['error',Math.round(performance.now()-t0)]),true);
</script><p>first chunk</p>`;
let n=0;const server = http.createServer((req, res) => {console.log('request',++n,req.url);
  res.writeHead(200, { 'content-type': 'text/html' });
  res.write(head + ' '.repeat(2048));
  if (req.url === '/drop') setTimeout(() => res.socket.destroy(), 500);
  else if (req.url === '/stall') setTimeout(() => res.end('<p>end</p></body></html>'), 4000);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({channel:'chromium'});
for (const path of ['/drop', '/stall']) {
  const page = await browser.newPage();
  page.goto(`http://127.0.0.1:${port}${path}`).catch((e) => console.log(path, 'goto error:', e.message.split('\n')[0]));
  await new Promise((r) => setTimeout(r, 2000));
  console.log(path, 'at 2 s:', JSON.stringify(await page.evaluate(() => [document.readyState, window.log])));
  await new Promise((r) => setTimeout(r, 10000));
  console.log(path, 'at 12 s:', JSON.stringify(await page.evaluate(() => [document.readyState, window.log])));
  await page.close();
}
await browser.close();
server.close();
