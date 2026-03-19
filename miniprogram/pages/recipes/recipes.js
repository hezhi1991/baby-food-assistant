const app = getApp()

Page({
  data: {
    categories: ['全部', '蔬菜', '水果', '谷物', '肉禽', '鱼类'],
    activeCat: '全部',
    recipes: []
  },

  onLoad() {
    this.fetchRecipes()
  },

  selectCat(e) {
    this.setData({ activeCat: e.currentTarget.dataset.cat })
    this.fetchRecipes()
  },

  fetchRecipes() {
    // 模拟数据
    const mockRecipes = [
      { id: 'r1', name: '南瓜小米粥', age: 6, difficulty: '简单', image: '' },
      { id: 'r2', name: '胡萝卜泥', age: 6, difficulty: '极简', image: '' },
      { id: 'r3', name: '三文鱼土豆泥', age: 8, difficulty: '中等', image: '' },
      { id: 'r4', name: '牛肉番茄面', age: 10, difficulty: '中等', image: '' }
    ]

    const filtered = this.data.activeCat === '全部' 
      ? mockRecipes 
      : mockRecipes.filter(r => r.category === this.data.activeCat)
    
    this.setData({ recipes: filtered })
  },

  viewRecipe(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/recipes/detail?id=${id}` })
  }
})
