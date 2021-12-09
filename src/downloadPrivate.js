/* eslint-disable no-inner-declarations */
/* eslint-disable prefer-destructuring */
const { join } = require('path');
const asyncPool = require('tiny-async-pool');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { homedir } = require('os');
const logger = require('electron-log');
const { parse } = require('flatted');
const {
  checkDirectory, concatFiles, downloadPart, getDownloadableURLFromHeadless, currentProgress, dividePart, clearAndCreateTempFolder, clearPartFile,
} = require('./util');

async function downloadVideo(arg, uuid, setting) {
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

        const poolCount = 4;
        const audioPart = dividePart(2, audioContentLength); // 오디오 다운로드는 끊김현상이 심해서 고정

        await clearAndCreateTempFolder(tempFolder);

        let url = new URL(videoURL);
        let param = new URLSearchParams(url.search);
        param.delete('rn');
        param.delete('rbuf');
        let count = 0;
        let diff = 0;

        async function checkMetadata() {
          param.set('sq', diff);
          url.search = param;
          await axios.get(url.href, { encoding: 'utf8' })
            .then(async (res) => {
              if (res.data.startsWith('https://')) {
                url = new URL(res.data);
                param = new URLSearchParams(url.search);
                await checkMetadata();
                return;
              }
              const match = (/Segment-Count: ([0-9]*)/gm).exec(res.data);
              if (match === null && diff === 0) console.error('메타데이터 찾을 수 없음');
              else if (match === null && diff > 0) {
                console.log('메타데이터 중복 확인 및 수집 완료. 작업 시작');
              } else if (match !== null && diff > 0) {
                console.log('메타데이터 중복, 생략함');
                diff += 1;
                await checkMetadata();
              } else if (match !== null && diff === 0) {
                count = Number(match[1]);
                diff += 1;
                console.log('메타데이터 확인, 중복 검사 시도...');
                await checkMetadata();
              }
            });
        }

        await checkMetadata();
        // 0에서 request 시작과 1에서 시작이 데이터가 달라서 부득이하게 0으로 시작하고
        // 겹치는건 그냥 스킵
        async function dl(num) {
          // eslint-disable-next-line no-async-promise-executor
          return new Promise((rs, rj) => {
            const tempURL = url;
            const tempParam = param;
            tempParam.set('sq', num);
            tempURL.search = param;
            process.send({ title: 'download progress', data: { uuid, value: `${num}/${count}번째 파일 다운로드 중...`, type: 'text' } });
            console.log(`[${videoId}] Downloading ${num}/${count} file`);
            axios.get(tempURL.href, { validateStatus: false, responseType: 'stream' })
              .then(async (res) => {
                const writer = createWriteStream(`temp/${videoId}/video_part_${num}.part`);
                res.data.pipe(writer);
                writer.on('finish', () => {
                  rs();
                });
              })
              .catch((e) => {
                console.error(e);
                rj();
              });
          });
        }

        const a = Array.from(Array(count).keys());
        await asyncPool(poolCount, a, dl);

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
              uuid, size: videoContentLength + audioContentLength, current: currentProgress[videoId], value: '오디오 다운로드 중...', type: 'progress',
            },
          });
        }, 300);

        const audioIndexArray = Array.from(Array(audioPart.length).keys());

        const audioConfigs = audioIndexArray.map((x) => ({
          index: x, url: audioURL, filename: `temp/${videoId}/audio_part_${x}.part`, part: audioPart[x], type: 'audio', videoId,
        }));

        console.log(`[${videoId}] Download Started...`);
        await asyncPool(poolCount, audioConfigs, downloadPart);
        clearInterval(sendProgress);

        console.log(`[${videoId}] Concating downloaded part files...`);
        process.send({ title: 'download progress', data: { uuid, value: '다운로드 끝, 파일 합치는 중..', type: 'text' } });

        const tempVideoFile = join(tempFolder, `video.${setting.videotype}`);
        const tempAudioFile = join(tempFolder, `audio.${setting.audiotype}`);
        const tempFinalFile = join(tempFolder, `final.${setting.videotype}`);

        await concatFiles(count, tempFolder, tempVideoFile, 'video', diff - 1);
        await concatFiles(audioPart.length, tempFolder, tempAudioFile, 'audio');

        clearPartFile(count, audioPart.length, tempFolder);

        ffmpeg.setFfmpegPath('./bin/ffmpeg.exe');
        ffmpeg(tempVideoFile)
          .input(tempAudioFile)
          .addOption('-c:v copy')
          .save(tempFinalFile)
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
            const filename = arg.info.title.replace(/<|>|:|"|\/|\\|\||\?|\*|^COM[0-9]$|^LPT[0-9]$|^CON$|^PRN$|^AUX$|^NUL$/gm, '□');
            const destination = join(saveDirectory, `[${new Date().valueOf()}]-${filename}.${setting.videotype}`);

            await fs.copyFile(tempFinalFile, destination);

            fs.rm(tempFolder, { recursive: true, force: true });
            resolve({ title: arg.info.title, filename, fileLocation: destination });
          })
          .on('error', (err) => {
            console.log(`an error happened: ${err.message}`);
            reject(err.message);
          });
      } catch (err) {
        reject(err.message);
      }
    })();
  });
}

process.on('message', async (data) => {
  const { arg, uuid, setting } = parse(data);

  Object.assign(console, logger.functions);

  await downloadVideo(arg, uuid, JSON.parse(setting))
    .then((res) => {
      process.send({ status: 'ok', ...res, uuid });
    })
    .catch((err) => {
      console.log(err);
      process.send({ status: 'fail', error: err, uuid });
    });
});
