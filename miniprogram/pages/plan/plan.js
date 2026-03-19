const app = getApp()

Page({
  data: {
    dates: [],
    selectedDate: '',
    selectedDateDisplay: '',
    dayPlans: [],
    showModal: false,
    editingId: null,
    formTime: '08:00',
    formType: 'milk',
    formDesc: ''
  },

  onLoad() {
    this.initDates()
    this.fetchPlans()
  },

  initDates() {
    const dates = []
    const now = new Date()
    const dayNames = ['日', '一', '二', '三', '四', '五', '六']
    
    for (let i = -3; i < 14; i++) {
      const d = new Date()
      d.setDate(now.getDate() + i)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const date = String(d.getDate()).padStart(2, '0')
      const full = `${year}-${month}-${date}`
      
      dates.push({
        full,
        dayNum: d.getDate(),
        dayName: dayNames[d.getDay()]
      })
    }

    const today = dates[3].full
    this.setData({
      dates,
      selectedDate: today,
      selectedDateDisplay: '今天'
    })
  },

  selectDate(e) {
    const date = e.currentTarget.dataset.date
    const isToday = date === this.data.dates[3].full
    this.setData({
      selectedDate: date,
      selectedDateDisplay: isToday ? '今天' : date
    })
    this.fetchPlans()
  },

  fetchPlans() {
    // 模拟接口调用
    const mockData = [
      { id: '1', date: this.data.dates[3].full, time: '08:00', type: 'milk', desc: '母乳 180ml', isCompleted: true },
      { id: '2', date: this.data.dates[3].full, time: '12:00', type: 'food', desc: '南瓜泥 + 米粉', isCompleted: false },
      { id: '3', date: this.data.dates[3].full, time: '16:00', type: 'milk', desc: '配方奶 200ml', isCompleted: false }
    ]

    const filtered = mockData.filter(p => p.date === this.data.selectedDate)
    this.setData({ dayPlans: filtered })
  },

  showAddModal() {
    this.setData({
      showModal: true,
      editingId: null,
      formTime: '08:00',
      formType: 'milk',
      formDesc: ''
    })
  },

  hideModal() {
    this.setData({ showModal: false })
  },

  onTimeChange(e) {
    this.setData({ formTime: e.detail.value })
  },

  onTypeChange(e) {
    this.setData({ formType: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ formDesc: e.detail.value })
  },

  savePlan() {
    const { formTime, formType, formDesc, selectedDate, editingId } = this.data
    
    // wx.request({
    //   url: app.globalData.baseUrl + '/meals',
    //   method: 'POST',
    //   data: { date: selectedDate, time: formTime, type: formType, desc: formDesc },
    //   success: () => { ... }
    // })

    wx.showToast({ title: '保存成功', icon: 'success' })
    this.hideModal()
    this.fetchPlans()
  },

  toggleComplete(e) {
    const id = e.currentTarget.dataset.id
    const plans = this.data.dayPlans.map(p => {
      if (p.id === id) return { ...p, isCompleted: !p.isCompleted }
      return p
    })
    this.setData({ dayPlans: plans })
    
    const plan = plans.find(p => p.id === id)
    if (plan.isCompleted) {
      wx.showToast({ title: '打卡成功！', icon: 'success' })
    }
  },

  deletePlan(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定要删除这个计划吗？',
      success: (res) => {
        if (res.confirm) {
          const filtered = this.data.dayPlans.filter(p => p.id !== id)
          this.setData({ dayPlans: filtered })
          wx.showToast({ title: '已删除' })
        }
      }
    })
  }
})
