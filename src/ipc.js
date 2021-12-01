/* eslint-disable no-await-in-loop */
const { join } = require('path');
const {
  ipcMain, Notification, shell, dialog,
} = require('electron');
const ytsr = require('better-ytsr');
const { getInfo } = require('ytdl-core');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const { fork } = require('child_process');
const { stringify } = require('flatted');
const {
  createRandomString, getQualityFromHeadless, getPrivateVideoQuality, getPrivateVideoInfo, fetchSettings,
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
  shell.openExternal(arg);
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
  if (arg.type === 'video') working[uuid] = fork(join(__dirname, 'downloadVideo.js'));
  else if (arg.type === 'audio') working[uuid] = fork(join(__dirname, 'downloadAudio.js'));

  working[uuid].send(stringify({ arg, uuid, setting: await fetchSettings() }));

  working[uuid].on('message', (data) => {
    if (data.status === 'ok') {
      win.webContents.send('download progress', { uuid: data.uuid, value: '다운로드 완료!', type: 'text' });
      new Notification({ title: '다운로드 완료!', body: `${data.filename}의 다운로드가 완료되었습니다!` }).show();
      shell.showItemInFolder(data.fileLocation);
      working[uuid].kill();
    } else if (data.status === 'fail') {
      win.webContents.send('download progress', { uuid: data.uuid, value: '다운로드 실패', type: 'text' });
      dialog.showErrorBox('에러가 발생했습니다!', `에러 내용: \n${data.error}`);
      working[uuid].kill();
    } else {
      win.webContents.send(data.title, data.data);
    }
  });
});

ipcMain.on('download cancel', async (event, arg) => {
  working[arg.uuid].kill();
  win.webContents.send('download progress', { url: arg.url, value: '다운로드 취소됨', type: 'text' });
  // 삭제 버그 해결
  fs.rm(`./temp/${arg.info.videoId}`, { force: true, recursive: true });
});

// TODO: 합치거나 리팩토링
ipcMain.on('private getinfo', async (event, arg) => {
  event.reply('private getinfo data', await getPrivateVideoInfo(arg.videoId, arg.cookie));
});

ipcMain.on('private getheadless', async (event, arg) => {
  event.reply('private getheadless data', await getPrivateVideoQuality(arg.videoId, arg.cookie));
});

ipcMain.on('private download', async (event, arg) => {
  const uuid = createRandomString();
  working[uuid] = fork(join(__dirname, 'downloadPrivate.js'));

  working[uuid].send(stringify({ arg, uuid, setting: await fetchSettings() }));

  working[uuid].on('message', (data) => {
    if (data.status === 'ok') {
      win.webContents.send('download progress', { uuid: data.uuid, value: '다운로드 완료!', type: 'text' });
      new Notification({ title: '다운로드 완료!', body: `${data.filename}의 다운로드가 완료되었습니다!` }).show();
      shell.showItemInFolder(data.fileLocation);
      working[uuid].kill();
    } else if (data.status === 'fail') {
      win.webContents.send('download progress', { uuid: data.uuid, value: '다운로드 실패', type: 'text' });
      dialog.showErrorBox('에러가 발생했습니다!', `에러 내용: \n${data.error.toString()}`);
      working[uuid].kill();
    } else {
      win.webContents.send(data.title, data.data);
    }
  });
});

ipcMain.on('setting fetch', async (event) => {
  event.reply('setting data', await fetchSettings());
});

ipcMain.on('setting save', async (event, arg) => {
  const settingLocation = join(process.env.APPDATA, 'LemonYoutubeDownloader', 'setting.json');
  await fs.writeFile(settingLocation, arg);
  console.log('Setting saved');
});
