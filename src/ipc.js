import { ipcMain } from 'electron';
import ytsr from 'better-ytsr';

ipcMain.on('search', async (event, arg) => {
  const data = await ytsr(arg, {
    pages: 1, hl: 'ko', gl: 'KR', exactMatch: true, filters: { type: 'Video' },
  });
  event.reply('search data', data);
});
