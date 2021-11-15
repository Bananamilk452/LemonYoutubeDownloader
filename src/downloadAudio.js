const { join } = require('path');
const asyncPool = require('tiny-async-pool');
const fs = require('fs').promises;
const axios = require('axios');
const { homedir } = require('os');
const { parse } = require('flatted');
const {
  checkDirectory, concatFiles, downloadPart, getDownloadableURLFromHeadless, currentProgress, dividePart, clearPartFile, clearAndCreateTempFolder,
} = require('./util');

async function downloadAudio(arg, uuid) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
      // TODO: 리팩토링해서 분류에 맞게 코드 정렬하기
        process.send({ title: 'download receive', data: { ...arg, uuid } });

        const videoId = arg.url.match(/.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/)[1];
        const saveDirectory = join(homedir(), 'Videos', 'LemonYoutubeDownloader');
        const tempFolder = join('./temp', videoId);

        await checkDirectory(saveDirectory);

        console.log(`[${videoId}] Fetching Datas from headless browser...`);
        process.send({ title: 'download progress', data: { url: arg.url, value: '헤드리스 브라우저에서 정보 수집 중...', type: 'text' } });
        const { audioURL } = await getDownloadableURLFromHeadless(videoId, arg.quality, 'audio');

        console.log(`[${videoId}] Fetching content size from url...`);
        process.send({ title: 'download progress', data: { url: arg.url, value: '크기 계산 중...', type: 'text' } });
        const info = await axios.head(audioURL);
        const audioContentLength = Number(info.headers['content-length']);

        // const splitSize = 50; // Megabyte
        const poolCount = 4;
        const audioPart = dividePart(1, audioContentLength); // 오디오 다운로드는 끊김현상이 심해서 1MB로 고정

        process.send({
          title: 'download progress',
          data: {
            url: arg.url, size: audioContentLength, current: 0, value: '오디오 다운로드 중...', type: 'progress',
          },
        });

        currentProgress[videoId] = 0;

        const sendProgress = setInterval(() => {
          process.send({
            title: 'download progress',
            data: {
              url: arg.url, size: audioContentLength, current: currentProgress[videoId], value: '오디오 다운로드 중...', type: 'progress',
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
        process.send({ title: 'download progress', data: { url: arg.url, value: '다운로드 끝, 파일 합치는 중..', type: 'text' } });
        await concatFiles(audioPart.length, tempFolder, join(tempFolder, 'audio.ogg'), 'audio');

        clearPartFile(0, audioPart.length, tempFolder);
        console.log(`[${videoId}] Audio merged successfully.`);
        const filename = arg.info.title.replace(/<|>:|"|\/|\\|\||\?|\*|^COM[0-9]$|^LPT[0-9]$|^CON$|^PRN$|^AUX$|^NUL$/gm, ' ');

        await fs.copyFile(join(tempFolder, 'audio.ogg'), join(saveDirectory, `${filename}.ogg`));

        fs.rm(tempFolder, { recursive: true, force: true });
        resolve({ filename, fileLocation: join(saveDirectory, `${filename}.ogg`) });
      } catch (err) {
        reject(err);
      }
    })();
  });
}

process.on('message', async (data) => {
  const { arg, uuid } = parse(data);
  await downloadAudio(arg, uuid)
    .then((res) => {
      process.send({ status: 'ok', ...res });
    })
    .catch((err) => {
      console.log(err);
      process.send({ status: 'fail', error: err, url: arg.url });
    });
});
