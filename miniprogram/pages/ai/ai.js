const app = getApp()

Page({
  data: {
    messages: [
      { id: '1', role: 'ai', text: '你好！我是你的 AI 育儿助手。你可以问我关于宝宝辅食添加、营养搭配或过敏排查的问题。' }
    ],
    inputText: '',
    isTyping: false,
    lastMsgId: 'msg-1'
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  sendMessage() {
    if (!this.data.inputText.trim()) return

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      text: this.data.inputText
    }

    const messages = [...this.data.messages, userMsg]
    
    this.setData({
      messages,
      inputText: '',
      isTyping: true,
      lastMsgId: 'msg-' + userMsg.id
    })

    // 模拟 AI 回复
    // 实际应调用后端接口，后端再调用 Gemini
    setTimeout(() => {
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: '这是一个模拟回复。在实际应用中，我会根据您的提问（' + userMsg.text + '）提供专业的辅食建议。'
      }
      
      this.setData({
        messages: [...this.data.messages, aiMsg],
        isTyping: false,
        lastMsgId: 'msg-' + aiMsg.id
      })
    }, 1500)
  }
})
