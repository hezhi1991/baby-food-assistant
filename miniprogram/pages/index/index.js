const app = getApp()

Page({
  data: {
    babyInfo: {},
    todayMeals: [],
    totalMilk: 0,
    totalMilkPlanned: 800,
    totalFood: 0,
    totalFoodPlanned: 5,
    upcomingMeal: null
  },

  onLoad() {
    this.setData({
      babyInfo: app.globalData.babyInfo
    })
    this.fetchTodayData()
  },

  onShow() {
    // 每次回到页面刷新数据
    this.fetchTodayData()
  },

  fetchTodayData() {
    // 模拟从后端获取数据
    // wx.request({ url: app.globalData.baseUrl + '/meals', ... })
    
    const mockMeals = [
      { id: '1', time: '08:00', type: 'milk', desc: '母乳 180ml', isCompleted: true },
      { id: '2', time: '12:00', type: 'food', desc: '南瓜泥 + 米粉', isCompleted: false },
      { id: '3', time: '16:00', type: 'milk', desc: '配方奶 200ml', isCompleted: false }
    ]

    this.setData({
      todayMeals: mockMeals,
      totalMilk: 180,
      totalFood: 0,
      upcomingMeal: mockMeals[1]
    })
  },

  addMeal() {
    wx.switchTab({ url: '/pages/plan/plan' })
  },

  addFood() {
    wx.switchTab({ url: '/pages/plan/plan' })
  },

  viewMeal(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/history/history?id=${id}` })
  },

  goToPlan() {
    wx.switchTab({ url: '/pages/plan/plan' })
  },

  goToAI() {
    wx.switchTab({ url: '/pages/ai/ai' })
  }
})
