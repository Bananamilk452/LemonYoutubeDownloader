/* eslint-disable no-await-in-loop */
const { join } = require('path');
const { ipcMain, Notification, shell } = require('electron');
const ytsr = require('better-ytsr');
const { getInfo } = require('ytdl-core');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const { fork } = require('child_process');
const { stringify } = require('flatted');
const {
  createRandomString, getQualityFromHeadless, getSecretVideoQuality,
} = require('./util');

let win;
const working = {};

module.exports = (window) => {
  win = window;
};

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

ipcMain.on('openBrowser', async (event, arg) => {
  shell.openExternal(arg.url);
});

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
  event.reply('getheadless data', await getQualityFromHeadless(arg));
});

ipcMain.on('download', async (event, arg) => {
  const uuid = createRandomString();
  if (arg.type === 'video') working[uuid] = fork(process.argv[2] === 'dev' ? './src/downloadVideo.js' : join(__dirname, 'downloadVideo.js'));
  else if (arg.type === 'audio') working[uuid] = fork(process.argv[2] === 'dev' ? './src/downloadAudio.js' : join(__dirname, 'downloadAudio.js'));

  working[uuid].send(stringify({ arg, uuid }));
  working[uuid].on('message', (data) => {
    if (data.status === 'ok') {
      new Notification({ title: '다운로드 완료!', body: `${data.filename}의 다운로드가 완료되었습니다!` }).show();
      shell.showItemInFolder(data.fileLocation);
      working[uuid].kill();
    } else if (data.status === 'fail') {
      win.webContents.send('download progress', { url: data.url, value: '다운로드 실패', type: 'text' });
      alert(data.error);
      working[uuid].kill();
    } else {
      win.webContents.send(data.title, data.data);
    }
  });
});

ipcMain.on('download cancel', async (event, arg) => {
  working[arg.uuid].kill();
  win.webContents.send('download progress', { url: arg.url, value: '다운로드 취소됨', type: 'text' });
  fs.rm(`./temp/${arg.info.videoId}`, { force: true, recursive: true });
});

ipcMain.on('test', async (event, arg) => {
  const a = await getSecretVideoQuality(arg.videoId, 'SID=EAhLw9eKScD7inSwibvfvnUcPBrmu5ePOVGQKBce6-OTSp9ur5c5P2e_JNewNEeL8q4-mw.; __Secure-1PSID=EAhLw9eKScD7inSwibvfvnUcPBrmu5ePOVGQKBce6-OTSp9u1YZJ6KV2H8qamM4umZJBCA.; __Secure-3PSID=EAhLw9eKScD7inSwibvfvnUcPBrmu5ePOVGQKBce6-OTSp9u3ETOUSpWR8TWOMCjlw-JuA.; HSID=AJ-_Ah6kT_0AkMS4d; SSID=AwdP9-e7YXZ1ME-Q5; APISID=Aui1ifv7Jz2doYSJ/AAw8KBk21Nqv9JkmF; SAPISID=4iim1GFJnrMtFony/AGl3gvdf_xUAGb_xO; __Secure-1PAPISID=4iim1GFJnrMtFony/AGl3gvdf_xUAGb_xO; __Secure-3PAPISID=4iim1GFJnrMtFony/AGl3gvdf_xUAGb_xO; SIDCC=AJi4QfFcLw…ecure-3PSIDCC=AJi4QfFNH5R1gAp5yjArk24-OeGOcef6_thGA2dFrh0t9MFJb5d-R71fk3s_7p8rWKGEkmVIz5E; PREF=tz=Asia.Seoul&gl=KR&hl=en; VISITOR_INFO1_LIVE=UVJfhnWi8l8; LOGIN_INFO=AFmmF2swRgIhAPoPkqHIIGLIunodHromWqa6FbjZPpfW8BvSvWRGb-nFAiEAhvF1wikcn0_I2GPMlATbdGEKA1nmtDXjPQLiMTNl8UM:QUQ3MjNmd3VVTWUtQV9DbkhYV1Jmd3o5dU5EQzZlc2w3SGVzdXloQm1mZHkxcUFyUnhZcm1Ta2NSQ0NtSHhPYnhPZ0tVeTNzTEtlZUpuY002bkNmWWhUbnlJTlBVbnhXaGlxVFFEYk41NlhoV2RJekh1blNLNWctbWhLMm9rTUh2T0xnSVd3bjFOTUloZXA3XzJ4REw3Y2hKWUdwZzZfR3lB; YSC=GayRzm6JTOY; wide=0');
  console.log(a);
});

// #region downloadVideo
// async function downloadVideo(arg, uuid) {
//   return new Promise((resolve, reject, onCancel) => {
//     (async () => {
//       try {
//         win.webContents.send('download receive', { ...arg, uuid });

//         const videoId = arg.url.match(/.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/)[1];
//         const saveDirectory = join(homedir(), 'Videos', 'LemonYoutubeDownloader');
//         const tempFolder = join('./temp', videoId);

//         await checkDirectory(saveDirectory);

//         console.log(`[${videoId}] Fetching Datas from headless browser...`);
//         win.webContents.send('download progress', { url: arg.url, value: '헤드리스 브라우저에서 정보 수집 중...', type: 'text' });
//         const { videoURL, audioURL } = await getDownloadableURLFromHeadless(videoId, arg.quality, 'video');

//         console.log(`[${videoId}] Fetching content size from url...`);
//         win.webContents.send('download progress', { url: arg.url, value: '크기 계산 중...', type: 'text' });
//         const infos = await Promise.all([axios.head(videoURL), axios.head(audioURL)]);
//         const videoContentLength = Number(infos[0].headers['content-length']);
//         const audioContentLength = Number(infos[1].headers['content-length']);

//         const splitSize = 10; // Megabyte
//         const poolCount = 4;
//         const videoPart = dividePart(splitSize, videoContentLength);
//         const audioPart = dividePart(2, audioContentLength); // 오디오 다운로드는 끊김현상이 심해서 고정

//         win.webContents.send('download progress', {
//           url: arg.url, size: videoContentLength + audioContentLength, current: 0, value: '영상과 오디오 다운로드 중...', type: 'progress',
//         });

//         currentProgress[videoId] = 0;

//         const sendProgress = setInterval(() => {
//           win.webContents.send('download progress', {
//             url: arg.url, size: videoContentLength + audioContentLength, current: currentProgress[videoId], value: '영상과 오디오 다운로드 중...', type: 'progress',
//           });
//         }, 300);

//         onCancel(() => {
//           clearInterval(sendProgress);
//         });

//         await clearAndCreateTempFolder(tempFolder);

//         const videoIndexArray = Array.from(Array(videoPart.length).keys());
//         const audioIndexArray = Array.from(Array(audioPart.length).keys());

//         const videoConfigs = videoIndexArray.map((x) => ({
//           index: x, url: videoURL, filename: `temp/${videoId}/video_part_${x}.part`, part: videoPart[x], type: 'video', videoId,
//         }));
//         const audioConfigs = audioIndexArray.map((x) => ({
//           index: x, url: audioURL, filename: `temp/${videoId}/audio_part_${x}.part`, part: audioPart[x], type: 'audio', videoId,
//         }));

//         console.log(`[${videoId}] Download Started...`);
//         await Promise.all([asyncPool(poolCount, videoConfigs, downloadPart), asyncPool(poolCount, audioConfigs, downloadPart)]);
//         clearInterval(sendProgress);

//         console.log(`[${videoId}] Concating downloaded part files...`);
//         win.webContents.send('download progress', { url: arg.url, value: '다운로드 끝, 파일 합치는 중..', type: 'text' });
//         await concatFiles(videoPart.length, tempFolder, join(tempFolder, 'video.mkv'), 'video');
//         await concatFiles(audioPart.length, tempFolder, join(tempFolder, 'audio.mkv'), 'audio');

//         clearPartFile(videoPart.length, audioPart.length, tempFolder);

//         ffmpeg.setFfmpegPath('./bin/ffmpeg.exe');
//         ffmpeg(join(tempFolder, 'video.mkv'))
//           .input(join(tempFolder, 'audio.mkv'))
//           .addOption('-c:v copy')
//           .save(join(tempFolder, 'final.mkv'))
//           .on('progress', (progress) => {
//             win.webContents.send('download progress', {
//               url: arg.url, size: 10000, current: progress.percent * 100, value: `영상과 오디오 합치는 중... (${progress.currentKbps}Kbps)`, type: 'progress',
//             });
//           })
//           .on('end', async () => {
//             console.log(`[${videoId}] Video & Audio merged successfully.`);
//             const filename = arg.info.title.replace(/<|>:|"|\/|\\|\||\?|\*|^COM[0-9]$|^LPT[0-9]$|^CON$|^PRN$|^AUX$|^NUL$/gm, ' ');

//             await fs.copyFile(join(tempFolder, 'final.mkv'), join(saveDirectory, `${filename}.mkv`));
//             resolve();
//             win.webContents.send('download progress', { url: arg.url, value: '다운로드 완료!', type: 'text' });
//             new Notification({ title: '다운로드 완료!', body: `${filename}의 다운로드가 완료되었습니다!` }).show();
//             shell.showItemInFolder(join(saveDirectory, `${filename}.mkv`));

//             fs.rm(tempFolder, { recursive: true, force: true });
//           })
//           .on('error', (err) => {
//             console.log(`an error happened: ${err.message}`);
//           });
//       } catch (err) {
//         reject(err);
//       }
//     })();
//   });
// }
// #endregion downloadVideo

// #region downloadAudio
// async function downloadAudio(arg) {
//   return new Promise((resolve, reject) => {
//     (async () => {
//       try {
//         win.webContents.send('download receive', arg);

//         const videoId = arg.url.match(/.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/)[1];
//         const saveDirectory = join(homedir(), 'Videos', 'LemonYoutubeDownloader');
//         const tempFolder = join('./temp', videoId);

//         await checkDirectory(saveDirectory);

//         console.log(`[${videoId}] Fetching Datas from headless browser...`);
//         win.webContents.send('download progress', { url: arg.url, value: '헤드리스 브라우저에서 정보 수집 중...', type: 'text' });
//         const { audioURL } = await getDownloadableURLFromHeadless(videoId, arg.quality, 'audio');

//         console.log(`[${videoId}] Fetching content size from url...`);
//         win.webContents.send('download progress', { url: arg.url, value: '크기 계산 중...', type: 'text' });
//         const info = await axios.head(audioURL);
//         const audioContentLength = Number(info.headers['content-length']);

//         // const splitSize = 50; // Megabyte
//         const poolCount = 4;
//         const audioPart = dividePart(1, audioContentLength); // 오디오 다운로드는 끊김현상이 심해서 1MB로 고정

//         win.webContents.send('download progress', {
//           url: arg.url, size: audioContentLength, current: 0, value: '오디오 다운로드 중...', type: 'progress',
//         });

//         currentProgress[videoId] = 0;

//         const sendProgress = setInterval(() => {
//           win.webContents.send('download progress', {
//             url: arg.url, size: audioContentLength, current: currentProgress[videoId], value: '오디오 다운로드 중...', type: 'progress',
//           });
//         }, 300);

//         await clearAndCreateTempFolder(tempFolder);

//         const audioIndexArray = Array.from(Array(audioPart.length).keys());

//         const audioConfigs = audioIndexArray.map((x) => ({
//           index: x, url: audioURL, filename: `temp/${videoId}/audio_part_${x}.part`, part: audioPart[x], type: 'audio', videoId,
//         }));

//         console.log(`[${videoId}] Download Started...`);
//         await asyncPool(poolCount, audioConfigs, downloadPart);
//         clearInterval(sendProgress);

//         console.log(`[${videoId}] Concating downloaded part files...`);
//         win.webContents.send('download progress', { url: arg.url, value: '다운로드 끝, 파일 합치는 중..', type: 'text' });
//         await concatFiles(audioPart.length, tempFolder, join(tempFolder, 'audio.ogg'), 'audio');

//         clearPartFile(0, audioPart.length, tempFolder);
//         console.log(`[${videoId}] Audio merged successfully.`);
//         const filename = arg.info.title.replace(/<|>:|"|\/|\\|\||\?|\*|^COM[0-9]$|^LPT[0-9]$|^CON$|^PRN$|^AUX$|^NUL$/gm, ' ');

//         await fs.copyFile(join(tempFolder, 'audio.ogg'), join(saveDirectory, `${filename}.ogg`));

//         resolve();
//         win.webContents.send('download progress', { url: arg.url, value: '다운로드 완료!', type: 'text' });
//         new Notification({ title: '다운로드 완료!', body: `${filename}의 다운로드가 완료되었습니다!` }).show();
//         shell.showItemInFolder(join(saveDirectory, `${filename}.ogg`));

//         fs.rm(tempFolder, { recursive: true, force: true });
//       } catch (err) {
//         reject(err);
//       }
//     })();
//   });
// }
// #endregion downloadAudio
