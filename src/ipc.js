/* eslint-disable no-await-in-loop */
import { join, resolve as pathResolve } from 'path';
import { ipcMain, Notification, shell } from 'electron';
import { chromium } from 'playwright';
import ytsr from 'better-ytsr';
import { getInfo } from 'ytdl-core';
import asyncPool from 'tiny-async-pool';
import {
  promises as fs, createWriteStream, createReadStream, existsSync,
} from 'fs';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { homedir } from 'os';
import MultiStream from 'multistream';

const chromiumPath = pathResolve('./bin/chromium-latest/chrome-win/chrome.exe');
let win;
const currentProgress = {};

export default function init(window) {
  win = window;
}

function addProgress(videoid, size) {
  currentProgress[videoid] += size;
}

async function concatFiles(streamArray, path, type) {
  return new Promise((resolve, reject) => {
    const writer = createWriteStream(path);
    const reader = new MultiStream(streamArray);
    reader.pipe(writer);
    writer.once('finish', () => {
      console.log(`Finish concat ${type} files`);
      resolve();
    });
    writer.once('error', (error) => {
      console.error(`Error while concat ${type} files.`, error);
      reject();
    });
  });
}

async function downloadPart(conf) {
  // TODO: promiseretry 넣기
  return new Promise((resolve, reject) => {
    const {
      index, url, filename, part, type, videoId,
    } = conf;

    axios.get(`${url}&range=${part.start}-${part.end}`, { responseType: 'stream' })
      .then((res) => {
        const { data } = res;
        console.log(`Starting download ${videoId} ${type} part ${index}`);
        const writer = createWriteStream(filename);
        data.on('data', (chunk) => addProgress(videoId, chunk.length));
        data.pipe(writer);
        writer.on('finish', () => {
          console.log(`Finished download ${videoId} ${type} part ${index}`);
          resolve();
        });
      })
      .catch((e) => {
        console.error(e);
        reject();
      });
  });
}

async function checkDirectory(saveLocation) {
  if (!existsSync(join(homedir(), 'Videos'))) await fs.mkdir(join(homedir(), 'Videos'));
  if (!existsSync(saveLocation)) await fs.mkdir(saveLocation);
  if (!existsSync('./temp')) await fs.mkdir('./temp');
}

// TODO: 로그창 만들기
// TODO: try catch 씌우기

// #region 앱 켜질 때 스크립트
(async () => {
  console.log('Clearing Temp Folder...');
  if (existsSync('./temp')) {
    const dir = await fs.readdir('./temp');
    dir.forEach((d) => {
      fs.rm(join('./temp', d), { recursive: true, force: true });
      console.log(`Removed temp ${d} folder`);
    });
  }
})();
// #endregion

ipcMain.on('search', async (event, arg) => {
  const data = await ytsr(arg, {
    pages: 1, hl: 'ko', gl: 'KR', exactMatch: true, filters: { type: 'Video' },
  });
  event.reply('search data', data);
});

// TODO: 헤드리스 body를 ytdl에 넘겨서 시간 줄이기
ipcMain.on('getinfo', async (event, arg) => {
  const data = await getInfo(arg);
  event.reply('getinfo data', data);
});

ipcMain.on('getheadless', async (event, arg) => {
  const browser = await chromium.launch({ args: ['--disable-features=PreloadMediaEngagementData, MediaEngagementBypassAutoplayPolicies'], headless: true, executablePath: chromiumPath });
  const page = await browser.newPage();

  await page.goto(`https://www.youtube.com/watch?v=${arg}`);
  await page.click('.ytp-settings-button');
  await page.click('.ytp-menuitem:last-child');
  const qualityString = await (await page.$('.ytp-quality-menu')).textContent();
  event.reply('getheadless data', qualityString.match(/\d*p60|\d*p/gm));
  await browser.close();
});

ipcMain.on('download', async (event, arg) => {
  // TODO: 리팩토링해서 분류에 맞게 코드 정렬하기
  win.webContents.send('download receive', arg);

  const videoId = arg.url.match(/.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/)[1];
  const saveDirectory = join(homedir(), 'Videos', 'LemonYoutubeDownloader');

  await checkDirectory(saveDirectory);

  const browser = await chromium.launch({ args: ['--disable-features=PreloadMediaEngagementData, MediaEngagementBypassAutoplayPolicies'], headless: true, executablePath: chromiumPath });
  const page = await browser.newPage();
  win.webContents.send('download progress', { url: arg.url, value: '헤드리스 브라우저 여는 중...', type: 'text' });

  let audioURL;
  let videoURL;
  // Subscribe to 'request' and 'response' events.
  page.on('request', (request) => {
    if (request.url().includes('googlevideo.com') && request.url().includes('mime=video')) videoURL = request.url();
    if (request.url().includes('googlevideo.com') && request.url().includes('mime=audio')) audioURL = request.url();
  });

  win.webContents.send('download progress', { url: arg.url, value: '페이지 조회 중...', type: 'text' });
  await page.goto(arg.url);
  await page.click('.ytp-settings-button');
  await page.click('.ytp-menuitem:last-child');
  await page.$('.ytp-menuitem');
  const item = await page.$$('.ytp-panel-menu > .ytp-menuitem[role="menuitemradio"]');
  // eslint-disable-next-line no-return-await

  for (let i = 0; i < item.length; i += 1) {
    console.log(await (await item[i].textContent()), arg.quality);
    if (await (await item[i].textContent()).startsWith(arg.quality)) {
      await item[i].click();
      break;
    }
  }

  // 네트워크 로딩 시간
  await new Promise((r) => setTimeout(r, 2000));

  await browser.close();

  win.webContents.send('download progress', { url: arg.url, value: '파일 크기 및 파트 계산 중...', type: 'text' });

  videoURL = videoURL.replace(/&range=[0-9]*-[0-9]*/gm, '');
  audioURL = audioURL.replace(/&range=[0-9]*-[0-9]*/gm, '');

  console.log('Fetching Datas & Processing Datas...');
  const infos = await Promise.all([axios.head(videoURL), axios.head(audioURL)]);
  const videoContentLength = Number(infos[0].headers['content-length']);
  const audioContentLength = Number(infos[1].headers['content-length']);
  // TODO: 고정단위로 나누기 (50MB 등)
  const splitCount = 4;
  const poolCount = 4;
  const videoPart = [];
  const audioPart = [];

  // init clen
  for (let i = 0; i < splitCount; i += 1) {
    const size = Math.floor(videoContentLength / splitCount);

    if (i === 0) videoPart.push({ start: 0, end: size });
    else {
      const previousEnd = videoPart[i - 1].end;
      videoPart.push({ start: previousEnd + 1, end: previousEnd + size });
    }
  }

  for (let i = 0; i < splitCount; i += 1) {
    const size = Math.floor(audioContentLength / splitCount);

    if (i === 0) audioPart.push({ start: 0, end: size });
    else {
      const previousEnd = audioPart[i - 1].end;
      audioPart.push({ start: previousEnd + 1, end: previousEnd + size });
    }
  }

  videoPart[videoPart.length - 1].end += videoContentLength % splitCount;
  audioPart[audioPart.length - 1].end += audioContentLength % splitCount;

  win.webContents.send('download progress', {
    url: arg.url, size: videoContentLength + audioContentLength, current: 0, value: '영상과 오디오 다운로드 중...', type: 'progress',
  });

  currentProgress[videoId] = 0;

  const sendProgress = setInterval(() => {
    win.webContents.send('download progress', {
      url: arg.url, size: videoContentLength + audioContentLength, current: currentProgress[videoId], value: '영상과 오디오 다운로드 중...', type: 'progress',
    });
  }, 300);

  const tempFolder = join('./temp', videoId);

  await fs.rm(tempFolder, { recursive: true, force: true });
  await fs.mkdir(tempFolder);

  const keyArray = Array.from(Array(splitCount).keys());
  const videoConfigs = keyArray.map((x) => ({
    index: x, url: videoURL, filename: `temp/${videoId}/video_part_${x}.part`, part: videoPart[x], type: 'video', videoId,
  }));
  const audioConfigs = keyArray.map((x) => ({
    index: x, url: audioURL, filename: `temp/${videoId}/audio_part_${x}.part`, part: audioPart[x], type: 'audio', videoId,
  }));

  await Promise.all([asyncPool(poolCount, videoConfigs, downloadPart), asyncPool(poolCount, audioConfigs, downloadPart)]);
  clearInterval(sendProgress);

  win.webContents.send('download progress', { url: arg.url, value: '다운로드 끝, 파일 합치는 중..', type: 'text' });

  const buffersKey = new Array(splitCount).fill('');
  const videoBuffers = buffersKey.map((x, i) => createReadStream(join(tempFolder, `video_part_${i}.part`)));
  const audioBuffers = buffersKey.map((x, i) => createReadStream(join(tempFolder, `audio_part_${i}.part`)));

  await concatFiles(videoBuffers, join(tempFolder, 'video.mkv'), 'video');
  await concatFiles(audioBuffers, join(tempFolder, 'audio.mkv'), 'audio');

  for (let i = 0; i < splitCount; i += 1) {
    fs.rm(join(tempFolder, `video_part_${i}.part`), { force: true });
    fs.rm(join(tempFolder, `audio_part_${i}.part`), { force: true });
  }

  ffmpeg.setFfmpegPath('./bin/ffmpeg.exe');
  ffmpeg(join(tempFolder, 'video.mkv'))
    .input(join(tempFolder, 'audio.mkv'))
    .addOption('-c:v copy')
    .save(join(tempFolder, 'final.mkv'))
    .on('progress', (progress) => {
      win.webContents.send('download progress', {
        url: arg.url, size: 10000, current: progress.percent * 100, value: `영상과 오디오 합치는 중... (${progress.currentKbps}Kbps)`, type: 'progress',
      });
    })
    .on('end', async () => {
      console.log(`${videoId} files have been merged succesfully`);
      const filename = arg.info.title.replace(/<|>:|"|\/|\\|\||\?|\*|^COM[0-9]$|^LPT[0-9]$|^CON$|^PRN$|^AUX$|^NUL$/gm, ' ');

      await fs.copyFile(join(tempFolder, 'final.mkv'), join(saveDirectory, `${filename}.mkv`));

      win.webContents.send('download progress', { url: arg.url, value: '다운로드 완료!', type: 'text' });
      new Notification({ title: '다운로드 완료!', body: `${filename}의 다운로드가 완료되었습니다!` }).show();
      shell.showItemInFolder(join(saveDirectory, `${filename}.mkv`));

      fs.rm(tempFolder, { recursive: true, force: true });
    })
    .on('error', (err) => {
      console.log(`an error happened: ${err.message}`);
    });
});

ipcMain.on('download audio', async (event, arg) => {
  // TODO: 리팩토링해서 분류에 맞게 코드 정렬하기
  win.webContents.send('download receive', arg);

  const videoId = arg.url.match(/.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/)[1];
  const saveDirectory = join(homedir(), 'Videos', 'LemonYoutubeDownloader');

  await checkDirectory(saveDirectory);

  const browser = await chromium.launch({ args: ['--disable-features=PreloadMediaEngagementData, MediaEngagementBypassAutoplayPolicies'], headless: true, executablePath: chromiumPath });
  const page = await browser.newPage();
  win.webContents.send('download progress', { url: arg.url, value: '헤드리스 브라우저 여는 중...', type: 'text' });

  let audioURL;
  // Subscribe to 'request' and 'response' events.
  page.on('request', (request) => {
    if (request.url().includes('googlevideo.com') && request.url().includes('mime=audio')) audioURL = request.url();
  });

  win.webContents.send('download progress', { url: arg.url, value: '페이지 조회 중...', type: 'text' });
  await page.goto(arg.url);
  await page.click('.ytp-settings-button');
  await page.click('.ytp-menuitem:last-child');
  await page.$('.ytp-menuitem');
  const item = await page.$$('.ytp-panel-menu > .ytp-menuitem[role="menuitemradio"]');
  // eslint-disable-next-line no-return-await

  for (let i = 0; i < item.length; i += 1) {
    console.log(await (await item[i].textContent()), arg.quality);
    if (await (await item[i].textContent()).startsWith(arg.quality)) {
      await item[i].click();
      break;
    }
  }

  // 네트워크 로딩 시간
  await new Promise((r) => setTimeout(r, 2000));

  await browser.close();

  win.webContents.send('download progress', { url: arg.url, value: '파일 크기 및 파트 계산 중...', type: 'text' });

  audioURL = audioURL.replace(/&range=[0-9]*-[0-9]*/gm, '');

  console.log('Fetching Datas & Processing Datas...');
  const info = await axios.head(audioURL);
  const audioContentLength = Number(info.headers['content-length']);
  // TODO: 고정단위로 나누기 (50MB 등)
  const splitCount = 4;
  const poolCount = 4;
  const audioPart = [];

  // init clen
  for (let i = 0; i < splitCount; i += 1) {
    const size = Math.floor(audioContentLength / splitCount);

    if (i === 0) audioPart.push({ start: 0, end: size });
    else {
      const previousEnd = audioPart[i - 1].end;
      audioPart.push({ start: previousEnd + 1, end: previousEnd + size });
    }
  }

  audioPart[audioPart.length - 1].end += audioContentLength % splitCount;

  win.webContents.send('download progress', {
    url: arg.url, size: audioContentLength, current: 0, value: '오디오 다운로드 중...', type: 'progress',
  });

  currentProgress[videoId] = 0;

  const sendProgress = setInterval(() => {
    win.webContents.send('download progress', {
      url: arg.url, size: audioContentLength, current: currentProgress[videoId], value: '오디오 다운로드 중...', type: 'progress',
    });
  }, 300);

  const tempFolder = join('./temp', videoId);

  await fs.rm(tempFolder, { recursive: true, force: true });
  await fs.mkdir(tempFolder);

  const keyArray = Array.from(Array(splitCount).keys());
  const audioConfigs = keyArray.map((x) => ({
    index: x, url: audioURL, filename: `temp/${videoId}/audio_part_${x}.part`, part: audioPart[x], type: 'audio', videoId,
  }));

  await asyncPool(poolCount, audioConfigs, downloadPart);
  clearInterval(sendProgress);

  win.webContents.send('download progress', { url: arg.url, value: '다운로드 끝, 파일 합치는 중..', type: 'text' });

  const buffersKey = new Array(splitCount).fill('');
  const audioBuffers = buffersKey.map((x, i) => createReadStream(join(tempFolder, `audio_part_${i}.part`)));

  await concatFiles(audioBuffers, join(tempFolder, 'audio.ogg'), 'audio');

  for (let i = 0; i < splitCount; i += 1) {
    fs.rm(join(tempFolder, `audio_part_${i}.part`), { force: true });
  }

  console.log(`${videoId} files have been merged succesfully`);
  const filename = arg.info.title.replace(/<|>:|"|\/|\\|\||\?|\*|^COM[0-9]$|^LPT[0-9]$|^CON$|^PRN$|^AUX$|^NUL$/gm, ' ');

  // 왠지 모르게 copy하면서 overwrite하면 끔찍하게 느려짐
  await fs.rm(join(homedir(), 'Videos', 'LemonYoutubeDownloader', `${filename}.ogg`), { force: true });
  await fs.copyFile(join(tempFolder, 'audio.ogg'), join(homedir(), 'Videos', 'LemonYoutubeDownloader', `${filename}.ogg`));

  win.webContents.send('download progress', { url: arg.url, value: '다운로드 완료!', type: 'text' });
  new Notification({ title: '다운로드 완료!', body: `${filename}의 다운로드가 완료되었습니다!` }).show();
  shell.showItemInFolder(join(homedir(), 'Videos', 'LemonYoutubeDownloader', `${filename}.ogg`));

  fs.rm(tempFolder, { recursive: true, force: true });
});
