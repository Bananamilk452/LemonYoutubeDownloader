/* eslint-disable no-await-in-loop */
const { homedir } = require('os');
const MultiStream = require('multistream');
const {
  createReadStream, createWriteStream, existsSync,
} = require('fs');
const fs = require('fs').promises;
const { chromium } = require('playwright');
const { join } = require('path');
const pathResolve = require('path').resolve;
const axios = require('axios');
const { getInfo } = require('ytdl-core');

const chromiumPath = pathResolve('./bin/chromium-latest/chrome-win/chrome.exe');
const currentProgress = {};

function addProgress(videoid, size) {
  currentProgress[videoid] += size;
}

async function concatFiles(count, tempFolder, destination, type, skip) {
  return new Promise((resolve, reject) => {
    const buffersKey = new Array(count).fill('');
    const streamArray = buffersKey.map((x, i) => createReadStream(join(tempFolder, `${type}_part_${i}.part`)));
    const writer = createWriteStream(destination);
    const reader = new MultiStream(streamArray);
    if (skip !== undefined) {
      for (let i = 0; i < skip; i += 1) {
        buffersKey.shift();
      }
    }
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

async function checkDirectory(saveLocation) {
  if (!existsSync(join(homedir(), 'Videos'))) await fs.mkdir(join(homedir(), 'Videos'));
  if (!existsSync(saveLocation)) await fs.mkdir(saveLocation);
  if (!existsSync('./temp')) await fs.mkdir('./temp');
}

async function getQualityFromHeadless(videoId) {
  const browser = await chromium.launch({ headless: true, executablePath: chromiumPath });
  const page = await browser.newPage();

  await page.goto(`https://www.youtube.com/watch?v=${videoId}`);
  await page.click('.ytp-settings-button');
  await page.click('.ytp-menuitem:last-child');
  const qualityString = await (await page.$('.ytp-quality-menu')).textContent();
  browser.close();
  return qualityString.match(/\d*p60|\d*p/gm);
}

function parseCookie(cookie) {
  // TODO .youtube??? ?????? ????????? ??????
  let c = cookie;
  c = c.split('\n');
  c.splice(0, 4);
  c = c.map((x, i) => {
    const s = x.split(/\s/);
    const r = {
      name: s[5] || `cookie${i}`,
      value: unescape(s[6]) || `cookie${i}`,
      url: 'https://www.youtube.com',
      secure: true,
    };
    if (s[5] === 'LOGIN_INFO') r.httpOnly = true;
    return r;
  });
  return c;
}

async function getPrivateVideoQuality(videoId, cookie) {
  const browser = await chromium.launch({ headless: true, executablePath: chromiumPath });
  const page = await browser.newPage();

  await page.context().addCookies(parseCookie(cookie));
  await page.goto(`https://www.youtube.com/watch?v=${videoId}`);
  await page.click('.ytp-settings-button');
  await page.click('.ytp-menuitem:last-child');
  const qualityString = await (await page.$('.ytp-quality-menu')).textContent();
  browser.close();
  return qualityString.match(/\d*p60|\d*p/gm);
}

async function getPrivateVideoInfo(videoId, cookie) {
  let c = '';
  parseCookie(cookie).forEach((x) => {
    c += `${x.name}=${x.value};`;
  });
  c = c.substring(0, c.length - 2);

  const data = await getInfo(videoId, { requestOptions: { headers: { cookie: c } } });
  return data;
}

async function getDownloadableURLFromHeadless(videoId, quality, type, cookie) {
  const browser = await chromium.launch({ headless: true, executablePath: chromiumPath });
  const page = await browser.newPage();

  if (cookie !== undefined) {
    await page.context().addCookies(parseCookie(cookie));
  }

  let audioURL;
  let videoURL;
  let readyToGo = false;

  page.on('request', (request) => {
    if (request.url().includes('googlevideo.com') && request.url().includes('mime=video')) videoURL = request.url().replace(/&range=[0-9]*-[0-9]*/gm, '');
    if (request.url().includes('googlevideo.com') && request.url().includes('mime=audio')) audioURL = request.url().replace(/&range=[0-9]*-[0-9]*/gm, '');

    if (type === 'video') {
      if (videoURL !== '' && audioURL !== '') readyToGo = true;
    }

    if (type === 'audio') {
      if (audioURL !== '') readyToGo = true;
    }
  });

  await page.goto(`https://www.youtube.com/watch?v=${videoId}`);
  await page.click('.ytp-settings-button');
  await page.click('.ytp-menuitem:last-child');
  await page.$('.ytp-menuitem');
  const item = await page.$$('.ytp-panel-menu > .ytp-menuitem[role="menuitemradio"]');
  // eslint-disable-next-line no-return-await

  for (let i = 0; i < item.length; i += 1) {
    if (await (await item[i].textContent()).startsWith(quality)) {
      await item[i].click();
      break;
    }
  }

  // ???????????? ?????? ??????
  await new Promise((r) => {
    const interval = setInterval(() => {
      if (readyToGo) {
        clearInterval(interval);
        r();
      }
    }, 500);
  });

  browser.close();

  if (type === 'video') return { videoURL, audioURL };
  if (type === 'audio') return { audioURL };
  return { videoURL, audioURL };
}

async function downloadPart(conf) {
  // TODO: promiseretry ??????
  return new Promise((resolve, reject) => {
    const {
      index, url, filename, part, type, videoId,
    } = conf;

    axios.get(`${url}&range=${part.start}-${part.end}`, { responseType: 'stream' })
      .then((res) => {
        const { data } = res;
        console.log(`[${videoId}] Starting download ${type} part ${index}`);
        const writer = createWriteStream(filename);
        data.on('data', (chunk) => addProgress(videoId, chunk.length));
        data.pipe(writer);
        writer.on('finish', () => {
          console.log(`[${videoId}] Finished download ${type} part ${index}`);
          resolve();
        });
      })
      .catch((e) => {
        console.error(e);
        reject();
      });
  });
}

function dividePart(splitSize, contentLength) {
  const part = [];
  const mbToByte = splitSize * 1048576;
  const count = Math.ceil(contentLength / mbToByte);

  for (let i = 0; i < count; i += 1) {
    if (i === 0) part.push({ start: 0, end: mbToByte });
    else {
      const previousEnd = part[i - 1].end;
      part.push({ start: previousEnd + 1, end: previousEnd + mbToByte });
    }
  }

  part[part.length - 1].end = contentLength;

  return part;
}

function clearPartFile(videoPartCount, audioPartCount, tempFolder) {
  for (let i = 0; i < videoPartCount; i += 1) {
    fs.rm(join(tempFolder, `video_part_${i}.part`), { force: true });
  }

  for (let i = 0; i < audioPartCount; i += 1) {
    fs.rm(join(tempFolder, `video_part_${i}.part`), { force: true });
  }
}

async function clearAndCreateTempFolder(tempFolder) {
  await fs.rm(tempFolder, { recursive: true, force: true });
  await fs.mkdir(tempFolder);
}

function createRandomString() {
  return Math.random().toString(36).substr(2, 5);
}

async function fetchSettings() {
  const settingLocation = join(process.env.APPDATA, 'LemonYoutubeDownloader', 'setting.json');
  const initData = {
    version: 1,
    videotype: 'mp4',
    audiotype: 'mp3',
  };

  if (existsSync(settingLocation)) {
    const data = await fs.readFile(settingLocation, { encoding: 'utf8' });
    console.log('Setting loaded from', settingLocation);
    return data;
  }
  // else
  await fs.writeFile(settingLocation, JSON.stringify(initData));
  console.log('Setting not found, creating new ', settingLocation);
  return JSON.stringify(initData);
}

module.exports = {
  concatFiles,
  checkDirectory,
  getQualityFromHeadless,
  downloadPart,
  currentProgress,
  getDownloadableURLFromHeadless,
  dividePart,
  clearPartFile,
  clearAndCreateTempFolder,
  createRandomString,
  getPrivateVideoQuality,
  getPrivateVideoInfo,
  parseCookie,
  fetchSettings,
};
