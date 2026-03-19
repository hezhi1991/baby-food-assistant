const app = getApp()

Page({
  data: {
    articles: [
      { id: '1', title: '6个月宝宝辅食添加指南', summary: '从米粉开始，逐步引入蔬菜泥和水果泥。' },
      { id: '2', title: '如何判断宝宝是否过敏？', summary: '观察皮肤红疹、腹泻或呕吐等症状。' },
      { id: '3', title: '辅食黑名单：这些食物千万别碰', summary: '蜂蜜、盐、糖、鲜奶等。' },
      { id: '4', title: 'DHA 补充全攻略', summary: '深海鱼类是天然的 DHA 来源。' }
    ]
  },

  viewArticle(e) {
    const id = e.currentTarget.dataset.id
    wx.showToast({ title: '查看文章 ' + id, icon: 'none' })
  }
})
