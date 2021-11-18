/* eslint-disable no-param-reassign */
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  productionSourceMap: false,
  pluginOptions: {
    electronBuilder: {
      chainWebpackMainProcess: (config) => {
        config.module
          .rule('ext')
          .test(/playwright-core.*(png$|ps1$|sh$|html$)/)
          .use('raw-loader')
          .loader('raw-loader')
          .end();
        config.plugin('define').tap((arg) => {
          arg[0]['process.env.FLUENTFFMPEG_COV'] = false;
          return arg;
        });
        config.plugin('copy').use(new CopyPlugin({
          patterns: [
            { from: 'src/downloadVideo.js', to: 'src/downloadVideo.js' },
            { from: 'src/downloadAudio.js', to: 'src/downloadAudio.js' },
            { from: 'src/util.js', to: 'src/util.js' },
          ],
        }));
      },
      mainProcessFile: 'src/background.js',
      mainProcessWatch: ['src/ipc.js', 'src/install.js', 'src/util.js', 'src/downloadVideo.js', 'src/downloadAudio.js'],
      preload: 'src/preload.js',
      builderOptions: {
        extraFiles: ['./bin/DO_NOT_REMOVE_THIS_DIRECTORY.txt', 'src/downloadVideo.js', 'src/downloadAudio.js', 'src/util.js'],
        appId: 'com.lemonyoutubedownloader.app',
        productName: 'LemonYoutubeDownloader',
        publish: [
          {
            provider: 'github',
            owner: 'Bananamilk452',
            repo: 'LemonYoutubeDownloader',
            releaseType: 'draft',
          },
        ],
      },
    },
  },
};
