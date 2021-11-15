/* eslint-disable no-param-reassign */

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
      },
      mainProcessFile: 'src/background.js',
      mainProcessWatch: ['src/ipc.js', 'src/install.js', 'src/util.js'],
      preload: 'src/preload.js',
      builderOptions: {
        extraFiles: ['./bin/DO_NOT_REMOVE_THIS_DIRECTORY.txt'],
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
