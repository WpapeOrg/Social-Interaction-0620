Page({
  data: {
    conversations: []
  },
  onShow() {
    this.setData({
      conversations: [{ id: 1, title: "示例会话", lastMessage: "你好呀" }]
    });
  },
  toDetail(e) {
    wx.navigateTo({ url: `/pages/chat/detail?id=${e.currentTarget.dataset.id}` });
  }
});
