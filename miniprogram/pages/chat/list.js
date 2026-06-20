const { request } = require("../../utils/request");

Page({
  data: {
    conversations: [],
    loading: false
  },
  onShow() {
    this.fetchConversations();
  },
  fetchConversations() {
    this.setData({ loading: true });
    request({ url: "/conversations" })
      .then((result) => {
        const list = ((result && result.data) || []).map((item) => ({
          id: item.id,
          title: `会话 #${item.id}`,
          lastMessage: item.last_message_at ? `最近活跃: ${item.last_message_at}` : "暂无消息",
          unreadCount: Number(item.unread_count || 0)
        }));
        this.setData({ conversations: list });
      })
      .catch(() => {
        wx.showToast({ title: "加载会话失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },
  toDetail(e) {
    wx.navigateTo({ url: `/pages/chat/detail?id=${e.currentTarget.dataset.id}` });
  }
});
