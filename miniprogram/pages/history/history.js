const app = getApp()

Page({
  data: {
    historyData: []
  },

  onLoad() {
    this.fetchHistory()
  },

  fetchHistory() {
    // 模拟数据
    const mockHistory = [
      {
        date: '2026-03-08',
        records: [
          { id: 'h1', time: '08:00', type: 'milk', val: '200ml', desc: '配方奶' },
          { id: 'h2', time: '12:00', type: 'food', val: '2勺', desc: '胡萝卜泥' },
          { id: 'h3', time: '18:00', type: 'milk', val: '180ml', desc: '母乳' }
        ]
      },
      {
        date: '2026-03-07',
        records: [
          { id: 'h4', time: '09:00', type: 'milk', val: '210ml', desc: '配方奶' },
          { id: 'h5', time: '13:00', type: 'food', val: '1勺', desc: '米粉' }
        ]
      }
    ]

    this.setData({ historyData: mockHistory })
  }
})
