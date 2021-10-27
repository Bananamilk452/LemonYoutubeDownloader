module.exports = {
  pluginOptions: {
    electronBuilder: {
      mainProcessWatch: ['src/ipc.js'],
      preload: 'src/preload.js',
    },
  },
};
