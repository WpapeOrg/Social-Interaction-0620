const { request } = require("../../utils/request");

Page({
  data: {
    inputValue: "",
    messages: [{ id: 1, sender: "other", content: "你好，认识一下？" }]
  },
  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },
  onSend() {
    const text = this.data.inputValue.trim();
    if (!text) return;
    const messages = this.data.messages.concat({
      id: Date.now(),
      sender: "me",
      content: text
    });
    this.setData({ messages, inputValue: "" });
  },
  onReportTap() {
    wx.showModal({
      title: "举报提示",
      content: "确认举报当前会话中的不当行为吗？",
      success: (modalResult) => {
        if (!modalResult.confirm) return;
        request({
          url: "/reports",
          method: "POST",
          data: { reason: "聊天内容不当（客户端快捷举报）" }
        })
          .then(() => {
            wx.showToast({ title: "举报已提交", icon: "none" });
          })
          .catch(() => {
            wx.showToast({ title: "举报失败", icon: "none" });
          });
      }
    });
  }
});
