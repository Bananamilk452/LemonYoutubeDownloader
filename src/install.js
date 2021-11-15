/* eslint-disable no-await-in-loop */
import axios from 'axios';
import { promises as fs, existsSync, createWriteStream } from 'fs';
import AdmZip from 'adm-zip';
import { ipcMain } from 'electron';

let win;

export default function init(window) {
  win = window;
}

// https://stackoverflow.com/questions/27078285
function throttle(callback, limit) {
  let waiting = false; // Initially, we're not waiting
  return () => { // We return a throttled function
    if (!waiting) { // If we're not waiting
      // eslint-disable-next-line prefer-rest-params
      callback.apply(this, arguments); // Execute users function
      waiting = true; // Prevent future invocations
      setTimeout(() => { // After a period of time
        waiting = false; // And allow future invocations
      }, limit);
    }
  };
}

async function checkIsBinaryInstalled() {
  const bin = await fs.readdir('./bin');
  const result = { ffmpeg: false, chromium: false };
  const ffmpeg = bin.find((x) => x === 'ffmpeg.exe');
  const startsWithChromium = bin.filter((x) => x.startsWith('chromium'));

  for (let i = 0; i < startsWithChromium.length; i += 1) {
    const name = startsWithChromium[i];
    const stat = await fs.lstat(`./bin/${name}`);
    if (stat.isDirectory()) {
      if (existsSync(`./bin/${name}/chrome-win`)) {
        if (existsSync(`./bin/${name}/chrome-win/chrome.exe`)) {
          console.log('Chromium Found in:', `./bin/${name}/chrome-win`);
          result.chromium = true;
        }
      }
    }
  }

  if (ffmpeg === 'ffmpeg.exe') {
    const stat = await fs.lstat('./bin/ffmpeg.exe');
    if (stat.isFile()) {
      console.log('ffmpeg Found in:', './bin/ffmpeg.exe');
      result.ffmpeg = true;
    }
  }

  return result;
}

async function streamDownload(url, name, savedir) {
  return new Promise((resolve, reject) => {
    axios.get(url, { responseType: 'stream' })
      .then((res) => {
        const { data, headers } = res;
        const writer = createWriteStream(savedir);
        let progress = 0;
        console.log(`Starting download ${name} zip from ${url}`);
        data.on('data', (chunk) => {
          progress += chunk.length;
          throttle(win.webContents.send('binary progress', {
            type: 'progress', text: `${name} 바이너리 다운로드 중...`, size: headers['content-length'], current: progress,
          }));
        });
        data.pipe(writer);
        writer.on('finish', async () => {
          console.log(`Finished download ${name} zip`);
          resolve();
        });
      }).catch((e) => reject(e));
  });
}

async function downloadBinary(status) {
  // TODO: 동기로 만들기
  if (status.chromium === false) {
    await streamDownload('https://download-chromium.appspot.com/dl/Win_x64', 'Chromium', './bin/chrome-win.zip')
      .then(async () => {
        win.webContents.send('binary progress', { type: 'text', text: 'Chromium 바이너리 압축 해제 중...' });
        // interactive-ui-test 지우기
        const zip = new AdmZip('./bin/chrome-win.zip');
        await fs.mkdir('./bin/chromium-latest');
        await zip.extractAllTo('./bin/chromium-latest', true);
        await fs.unlink('./bin/chrome-win.zip');
      }).catch((e) => console.error(e));
  }

  if (status.ffmpeg === false) {
    const { data } = await axios.get('https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest');
    const url = data.assets.filter((x) => x.name.includes('win64-gpl') && !x.name.includes('shared'))[1].browser_download_url;

    await streamDownload(url, 'ffmpeg', './bin/ffmpeg.zip')
      .then(async () => {
        win.webContents.send('binary progress', { type: 'text', text: 'ffmpeg 바이너리 압축 해제 중...' });

        const zip = new AdmZip('./bin/ffmpeg.zip');
        const zipEntries = zip.getEntries();
        for (let i = 0; i < zipEntries.length; i += 1) {
          if (zipEntries[i].name === 'ffmpeg.exe') {
            await zip.extractEntryTo(zipEntries[i].entryName, './bin', false, true);
            break;
          }
        }
        await fs.unlink('./bin/ffmpeg.zip');
      }).catch((e) => console.error(e));
  }
}

ipcMain.on('check binary', async () => {
  let status = await checkIsBinaryInstalled();
  win.webContents.send('binary status', { status: (status.chromium && status.ffmpeg) });

  if (!status.ffmpeg || !status.chromium) {
    await downloadBinary(status);

    status = await checkIsBinaryInstalled();
    win.webContents.send('binary status', { status: (status.chromium && status.ffmpeg) });
  }
});
