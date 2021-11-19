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

const chromiumPath = pathResolve('./bin/chromium-latest/chrome-win/chrome.exe');
const currentProgress = {};

function addProgress(videoid, size) {
  currentProgress[videoid] += size;
}

async function concatFiles(count, tempFolder, destination, type) {
  return new Promise((resolve, reject) => {
    const buffersKey = new Array(count).fill('');
    const streamArray = buffersKey.map((x, i) => createReadStream(join(tempFolder, `${type}_part_${i}.part`)));
    const writer = createWriteStream(destination);
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

async function checkDirectory(saveLocation) {
  if (!existsSync(join(homedir(), 'Videos'))) await fs.mkdir(join(homedir(), 'Videos'));
  if (!existsSync(saveLocation)) await fs.mkdir(saveLocation);
  if (!existsSync('./temp')) await fs.mkdir('./temp');
}

async function getQualityFromHeadless(videoId) {
  const browser = await chromium.launch({ args: ['--disable-features=PreloadMediaEngagementData, MediaEngagementBypassAutoplayPolicies'], headless: true, executablePath: chromiumPath });
  const page = await browser.newPage();

  await page.goto(`https://www.youtube.com/watch?v=${videoId}`);
  await page.click('.ytp-settings-button');
  await page.click('.ytp-menuitem:last-child');
  const qualityString = await (await page.$('.ytp-quality-menu')).textContent();
  browser.close();
  return qualityString.match(/\d*p60|\d*p/gm);
}

function parseCookie(c) {
  const pairs = c.split(';');
  const cookies = [];
  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i].split('=');
    const coo = {
      name: (`${pair[0]}`).trim(),
      value: unescape(pair.slice(1).join('=')),
      url: 'https://www.youtube.com',
      secure: true,
    };

    if (coo.name === 'LOGIN_INFO') {
      coo.secure = true;
      coo.httpOnly = true;
    } else if (coo.name.startsWith('_')) coo.secure = true;
    cookies.push(coo);
  }
  return cookies;
}

async function getSecretVideoQuality(videoId, cookie) {
  const browser = await chromium.launch({ args: ['--disable-features=PreloadMediaEngagementData, MediaEngagementBypassAutoplayPolicies'], headless: false, executablePath: chromiumPath });
  const page = await browser.newPage();

  await page.context().addCookies(parseCookie(cookie));
  await page.goto(`https://www.youtube.com/watch?v=${videoId}`);
  console.log(await page.context().cookies(`https://www.youtube.com/watch?v=${videoId}`));
  await page.click('.ytp-settings-button');
  await page.click('.ytp-menuitem:last-child');
  const qualityString = await (await page.$('.ytp-quality-menu')).textContent();
  browser.close();
  return qualityString.match(/\d*p60|\d*p/gm);
}

async function getDownloadableURLFromHeadless(videoId, quality, type) {
  const browser = await chromium.launch({ args: ['--disable-features=PreloadMediaEngagementData, MediaEngagementBypassAutoplayPolicies'], headless: true, executablePath: chromiumPath });
  const page = await browser.newPage();

  let audioURL;
  let videoURL;

  page.on('request', (request) => {
    if (request.url().includes('googlevideo.com') && request.url().includes('mime=video')) videoURL = request.url().replace(/&range=[0-9]*-[0-9]*/gm, '');
    if (request.url().includes('googlevideo.com') && request.url().includes('mime=audio')) audioURL = request.url().replace(/&range=[0-9]*-[0-9]*/gm, '');
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

  // 네트워크 로딩 시간
  await new Promise((r) => setTimeout(r, 1000));
  browser.close();

  if (type === 'video') return { videoURL, audioURL };
  if (type === 'audio') return { audioURL };
  return { videoURL, audioURL };
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

module.exports = {
  concatFiles, checkDirectory, getQualityFromHeadless, downloadPart, currentProgress, getDownloadableURLFromHeadless, dividePart, clearPartFile, clearAndCreateTempFolder, createRandomString, getSecretVideoQuality,
};
