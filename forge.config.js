module.exports = {
  packagerConfig: {
    asar: true,
    name: "WheelTimer",
    icon: './icon.ico'
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'WheelTimer',
        productName: '轉盤計時器',
        setupIcon: './icon.ico',
        createDesktopShortcut: true,
        createStartMenuShortcut: true
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
  plugins: [],
};