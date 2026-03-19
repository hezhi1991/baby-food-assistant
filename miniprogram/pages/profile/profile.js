const app = getApp()

Page({
  data: {
    babyInfo: {}
  },

  onLoad() {
    this.setData({
      babyInfo: app.globalData.babyInfo
    })
  },

  navToHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '已退出' })
        }
      }
    })
  }
})
