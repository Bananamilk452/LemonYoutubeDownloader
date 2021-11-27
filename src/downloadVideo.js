const { join } = require('path');
const asyncPool = require('tiny-async-pool');
const fs = require('fs').promises;
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { homedir } = require('os');
const { parse } = require('flatted');
const {
  checkDirectory, concatFiles, downloadPart, getDownloadableURLFromHeadless, currentProgress, dividePart, clearPartFile, clearAndCreateTempFolder,
} = require('./util');

async function downloadVideo(arg, uuid) {
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
        const { videoURL, audioURL } = await getDownloadableURLFromHeadless(videoId, arg.quality, 'video', arg.cookie);

        console.log(`[${videoId}] Fetching content size from url...`);
        process.send({ title: 'download progress', data: { uuid, value: '크기 계산 중...', type: 'text' } });
        const infos = await Promise.all([axios.head(videoURL), axios.head(audioURL)]);
        const videoContentLength = Number(infos[0].headers['content-length']);
        const audioContentLength = Number(infos[1].headers['content-length']);

        const splitSize = 10; // Megabyte
        const poolCount = 4;
        const videoPart = dividePart(splitSize, videoContentLength);
        const audioPart = dividePart(2, audioContentLength); // 오디오 다운로드는 끊김현상이 심해서 고정

        process.send({
          title: 'download progress',
          data: {
            uuid, size: videoContentLength + audioContentLength, current: 0, value: '영상과 오디오 다운로드 중...', type: 'progress',
          },
        });

        currentProgress[videoId] = 0;

        const sendProgress = setInterval(() => {
          process.send({
            title: 'download progress',
            data: {
              uuid, size: videoContentLength + audioContentLength, current: currentProgress[videoId], value: '영상과 오디오 다운로드 중...', type: 'progress',
            },
          });
        }, 300);

        await clearAndCreateTempFolder(tempFolder);

        const videoIndexArray = Array.from(Array(videoPart.length).keys());
        const audioIndexArray = Array.from(Array(audioPart.length).keys());

        const videoConfigs = videoIndexArray.map((x) => ({
          index: x, url: videoURL, filename: `temp/${videoId}/video_part_${x}.part`, part: videoPart[x], type: 'video', videoId,
        }));
        const audioConfigs = audioIndexArray.map((x) => ({
          index: x, url: audioURL, filename: `temp/${videoId}/audio_part_${x}.part`, part: audioPart[x], type: 'audio', videoId,
        }));

        console.log(`[${videoId}] Download Started...`);
        await Promise.all([asyncPool(poolCount, videoConfigs, downloadPart), asyncPool(poolCount, audioConfigs, downloadPart)]);
        clearInterval(sendProgress);

        console.log(`[${videoId}] Concating downloaded part files...`);
        process.send({ title: 'download progress', data: { uuid, value: '다운로드 끝, 파일 합치는 중..', type: 'text' } });
        await concatFiles(videoPart.length, tempFolder, join(tempFolder, 'video.mkv'), 'video');
        await concatFiles(audioPart.length, tempFolder, join(tempFolder, 'audio.mkv'), 'audio');

        clearPartFile(videoPart.length, audioPart.length, tempFolder);

        ffmpeg.setFfmpegPath('./bin/ffmpeg.exe');
        ffmpeg(join(tempFolder, 'video.mkv'))
          .input(join(tempFolder, 'audio.mkv'))
          .addOption('-c:v copy')
          .save(join(tempFolder, 'final.mkv'))
          .on('progress', (p) => {
            process.send({
              title: 'download progress',
              data: {
                uuid, size: 10000, current: p.percent * 100, value: `영상과 오디오 합치는 중... (${p.currentKbps}Kbps)`, type: 'progress',
              },
            });
          })
          .on('end', async () => {
            console.log(`[${videoId}] Video & Audio merged successfully.`);
            const filename = arg.info.title.replace(/<|>:|"|\/|\\|\||\?|\*|^COM[0-9]$|^LPT[0-9]$|^CON$|^PRN$|^AUX$|^NUL$/gm, ' ');

            await fs.copyFile(join(tempFolder, 'final.mkv'), join(saveDirectory, `${filename}.mkv`));
            process.send({ title: 'download progress', data: { uuid, value: '다운로드 완료!', type: 'text' } });
            fs.rm(tempFolder, { recursive: true, force: true });
            resolve({ filename, fileLocation: join(saveDirectory, `${filename}.mkv`) });
          })
          .on('error', (err) => {
            console.log(`an error happened: ${err.message}`);
            reject(err);
          });
      } catch (err) {
        reject(err);
      }
    })();
  });
}

process.on('message', async (data) => {
  const { arg, uuid } = parse(data);
  await downloadVideo(arg, uuid)
    .then((res) => {
      process.send({ status: 'ok', ...res, uuid });
    })
    .catch((err) => {
      console.log(err);
      process.send({ status: 'fail', error: err, uuid });
    });
});
