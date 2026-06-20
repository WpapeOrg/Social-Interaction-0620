const { request } = require("../../utils/request");

function toWsUrl(apiBaseUrl, token) {
  if (!apiBaseUrl || !token) return "";
  const wsBase = apiBaseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${wsBase}/ws?token=${encodeURIComponent(token)}`;
}

Page({
  data: {
    conversationId: 0,
    currentUserId: 0,
    inputValue: "",
    messages: [],
    readTip: ""
  },
  socketTask: null,
  onLoad(options) {
    const conversationId = Number(options.id || 0);
    this.setData({ conversationId });
    this.bootstrap();
  },
  onUnload() {
    this.teardownSocket();
  },
  onHide() {
    this.teardownSocket();
  },
  async bootstrap() {
    if (!this.data.conversationId) {
      wx.showToast({ title: "无效会话", icon: "none" });
      return;
    }
    await this.loadCurrentUser();
    await this.loadMessages();
    this.connectRealtime();
  },
  loadCurrentUser() {
    return request({ url: "/profile/me" })
      .then((result) => {
        const currentUserId = Number(result?.data?.id || 0);
        this.setData({ currentUserId });
      })
      .catch(() => {
        wx.showToast({ title: "用户信息加载失败", icon: "none" });
      });
  },
  loadMessages() {
    const conversationId = this.data.conversationId;
    return request({ url: `/conversations/${conversationId}/messages` })
      .then((result) => {
        const currentUserId = this.data.currentUserId;
        const messages = ((result && result.data) || []).map((item) => ({
          id: item.id,
          sender: Number(item.sender_id) === currentUserId ? "me" : "other",
          content: item.content
        }));
        this.setData({ messages });
        const lastMessage = messages[messages.length - 1];
        if (lastMessage) {
          this.markRead(lastMessage.id);
        }
      })
      .catch(() => {
        wx.showToast({ title: "消息加载失败", icon: "none" });
      });
  },
  connectRealtime() {
    const app = getApp();
    const token = wx.getStorageSync("token");
    const url = toWsUrl(app.globalData.apiBaseUrl, token);
    if (!url) return;

    this.teardownSocket();
    const socketTask = wx.connectSocket({ url });
    this.socketTask = socketTask;

    socketTask.onMessage((event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (_error) {
        return;
      }

      if (payload.type === "new_message" && Number(payload.conversationId) === this.data.conversationId) {
        const incoming = payload.message || {};
        const incomingId = Number(incoming.id || 0);
        const exists = this.data.messages.some((item) => Number(item.id) === incomingId);
        if (!exists) {
          const message = {
            id: incoming.id,
            sender: Number(incoming.sender_id) === this.data.currentUserId ? "me" : "other",
            content: incoming.content || ""
          };
          const messages = this.data.messages.concat(message);
          this.setData({ messages });
          if (message.sender === "other") {
            this.markRead(Number(message.id || 0));
          }
        }
      }

      if (payload.type === "read_receipt" && Number(payload.conversationId) === this.data.conversationId) {
        this.setData({
          readTip: `对方已读至消息 #${payload.lastReadMessageId || 0}`
        });
      }
    });
  },
  teardownSocket() {
    if (!this.socketTask) return;
    try {
      this.socketTask.close();
    } catch (_error) {
      // ignore close errors
    }
    this.socketTask = null;
  },
  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },
  onSend() {
    const conversationId = this.data.conversationId;
    const text = this.data.inputValue.trim();
    if (!text || !conversationId) return;

    request({
      url: `/conversations/${conversationId}/messages`,
      method: "POST",
      data: { content: text }
    })
      .then((result) => {
        const message = result?.data;
        if (!message) return;
        const exists = this.data.messages.some((item) => Number(item.id) === Number(message.id));
        if (!exists) {
          this.setData({
            messages: this.data.messages.concat({
              id: message.id,
              sender: "me",
              content: message.content || text
            })
          });
        }
        this.setData({ inputValue: "" });
      })
      .catch(() => {
        wx.showToast({ title: "发送失败", icon: "none" });
      });
  },
  markRead(lastReadMessageId) {
    const conversationId = this.data.conversationId;
    if (!conversationId || !lastReadMessageId) return;
    request({
      url: `/conversations/${conversationId}/read`,
      method: "POST",
      data: { lastReadMessageId }
    }).catch(() => {});
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
