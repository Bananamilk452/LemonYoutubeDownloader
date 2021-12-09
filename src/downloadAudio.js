const { join } = require('path');
const asyncPool = require('tiny-async-pool');
const fs = require('fs').promises;
const axios = require('axios');
const { homedir } = require('os');
const logger = require('electron-log');
const { parse } = require('flatted');
const {
  checkDirectory, concatFiles, downloadPart, getDownloadableURLFromHeadless, currentProgress, dividePart, clearPartFile, clearAndCreateTempFolder,
} = require('./util');

async function downloadAudio(arg, uuid, setting) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        process.send({ title: 'download receive', data: { ...arg, uuid } });

        const videoId = arg.url.match(/.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/)[1];
        const saveDirectory = join(homedir(), 'Videos', 'LemonYoutubeDownloader');
        const tempFolder = join('./temp', videoId);

        await checkDirectory(saveDirectory);

        console.log(`[${videoId}] Fetching Datas from headless browser...`);
        process.send({ title: 'download progress', data: { uuid, value: '헤드리스 브라우저에서 정보 수집 중...', type: 'text' } });
        const { audioURL } = await getDownloadableURLFromHeadless(videoId, arg.quality, 'audio', arg.cookie);

        console.log(`[${videoId}] Fetching content size from url...`);
        process.send({ title: 'download progress', data: { uuid, value: '크기 계산 중...', type: 'text' } });
        const info = await axios.head(audioURL);
        const audioContentLength = Number(info.headers['content-length']);

        // const splitSize = 50; // Megabyte
        const poolCount = 4;
        const audioPart = dividePart(1, audioContentLength); // 오디오 다운로드는 끊김현상이 심해서 1MB로 고정

        process.send({
          title: 'download progress',
          data: {
            uuid, size: audioContentLength, current: 0, value: '오디오 다운로드 중...', type: 'progress',
          },
        });

        currentProgress[videoId] = 0;

        const sendProgress = setInterval(() => {
          process.send({
            title: 'download progress',
            data: {
              uuid, size: audioContentLength, current: currentProgress[videoId], value: '오디오 다운로드 중...', type: 'progress',
            },
          });
        }, 300);

        await clearAndCreateTempFolder(tempFolder);

        const audioIndexArray = Array.from(Array(audioPart.length).keys());

        const audioConfigs = audioIndexArray.map((x) => ({
          index: x, url: audioURL, filename: `temp/${videoId}/audio_part_${x}.part`, part: audioPart[x], type: 'audio', videoId,
        }));

        console.log(`[${videoId}] Download Started...`);
        await asyncPool(poolCount, audioConfigs, downloadPart);
        clearInterval(sendProgress);

        console.log(`[${videoId}] Concating downloaded part files...`);
        process.send({ title: 'download progress', data: { uuid, value: '다운로드 끝, 파일 합치는 중..', type: 'text' } });

        const tempAudioFile = join(tempFolder, `audio.${setting.audiotype}`);

        await concatFiles(audioPart.length, tempFolder, tempAudioFile, 'audio');

        clearPartFile(0, audioPart.length, tempFolder);
        console.log(`[${videoId}] Audio merged successfully.`);

        const filename = arg.info.title.replace(/<|>|:|"|\/|\\|\||\?|\*|^COM[0-9]$|^LPT[0-9]$|^CON$|^PRN$|^AUX$|^NUL$/gm, '□');
        const destination = join(saveDirectory, `[${new Date().valueOf()}]-${filename}.${setting.audiotype}`);

        await fs.copyFile(tempAudioFile, destination);

        fs.rm(tempFolder, { recursive: true, force: true });
        resolve({ title: arg.info.title, filename, fileLocation: destination });
      } catch (err) {
        reject(err.message);
      }
    })();
  });
}

process.on('message', async (data) => {
  const { arg, uuid, setting } = parse(data);

  Object.assign(console, logger.functions);

  await downloadAudio(arg, uuid, JSON.parse(setting))
    .then((res) => {
      process.send({ status: 'ok', ...res });
    })
    .catch((err) => {
      console.log(err);
      process.send({ status: 'fail', error: err, uuid });
    });
});
