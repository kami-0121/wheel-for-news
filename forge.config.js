module.exports = {
  packagerConfig: {
    asar: true,
    // ★★★ 核心修正：這是內部名稱，必須是純英文 ★★★
    name: "ToastiwaWheelTimer", 
    // icon 路徑保持不變
    icon: './icon.ico' 
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // ★★★ 核心修正：這是安裝程式的名稱，也必須是純英文 ★★★
        name: 'ToastiwaWheelTimer',
        // ★★★ 這是顯示在安裝介面和控制台的產品名稱，可以使用中文 ★★★
        productName: 'Toastiwaの轉盤計時器', 
        setupIcon: './icon.ico',
        createDesktopShortcut: true, // 明確要求建立桌面捷徑
        createStartMenuShortcut: true // 明確要求建立開始功能表捷徑
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    // (其他 maker 可以保留或移除)
  ],
  plugins: [],
};