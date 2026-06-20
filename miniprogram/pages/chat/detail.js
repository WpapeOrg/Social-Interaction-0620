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
    readTip: "",
    typingTip: "",
    connectionTip: ""
  },
  socketTask: null,
  socketReady: false,
  manualClose: false,
  reconnectAttempts: 0,
  reconnectTimer: null,
  pingTimer: null,
  typingStopTimer: null,
  typingLastEmitAt: 0,
  typingState: false,
  onLoad(options) {
    const conversationId = Number(options.id || 0);
    this.setData({ conversationId });
    this.bootstrap();
  },
  onShow() {
    this.manualClose = false;
    if (!this.socketTask) {
      this.connectRealtime();
    }
  },
  onUnload() {
    this.manualClose = true;
    this.teardownSocket();
  },
  onHide() {
    this.manualClose = true;
    this.sendTypingState(false, true);
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
    this.setData({ connectionTip: "连接中..." });
    const socketTask = wx.connectSocket({ url });
    this.socketTask = socketTask;
    this.socketReady = false;

    socketTask.onOpen(() => {
      this.socketReady = true;
      this.reconnectAttempts = 0;
      this.setData({ connectionTip: "" });
      this.startPing();
    });

    socketTask.onMessage((event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (_error) {
        return;
      }

      if (payload.type === "connected" || payload.type === "pong") {
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

      if (payload.type === "typing_status" && Number(payload.conversationId) === this.data.conversationId) {
        const isTyping = Boolean(payload.isTyping);
        this.setData({
          typingTip: isTyping ? "对方正在输入..." : ""
        });
      }
    });

    socketTask.onClose(() => {
      this.socketReady = false;
      this.stopPing();
      this.socketTask = null;
      this.scheduleReconnect();
    });

    socketTask.onError(() => {
      this.socketReady = false;
      this.stopPing();
      this.setData({ connectionTip: "连接异常，重试中..." });
    });
  },
  scheduleReconnect() {
    if (this.manualClose) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(10000, 1000 * Math.pow(2, this.reconnectAttempts - 1));
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setData({ connectionTip: `连接断开，${Math.floor(delay / 1000)} 秒后重连...` });
    this.reconnectTimer = setTimeout(() => {
      this.connectRealtime();
    }, delay);
  },
  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.sendRealtime({ type: "ping" });
    }, 20000);
  },
  stopPing() {
    if (!this.pingTimer) return;
    clearInterval(this.pingTimer);
    this.pingTimer = null;
  },
  sendRealtime(payload) {
    if (!this.socketTask || !this.socketReady) return;
    try {
      this.socketTask.send({
        data: JSON.stringify(payload)
      });
    } catch (_error) {
      // ignore send failures
    }
  },
  sendTypingState(isTyping, force = false) {
    const now = Date.now();
    if (!force && isTyping && now - this.typingLastEmitAt < 1200) {
      return;
    }
    if (!force && this.typingState === isTyping) {
      return;
    }
    this.typingState = isTyping;
    this.typingLastEmitAt = now;
    this.sendRealtime({
      type: "typing",
      conversationId: this.data.conversationId,
      isTyping
    });
  },
  teardownSocket() {
    this.stopPing();
    if (this.typingStopTimer) {
      clearTimeout(this.typingStopTimer);
      this.typingStopTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.socketTask) return;
    try {
      this.socketTask.close();
    } catch (_error) {
      // ignore close errors
    }
    this.socketTask = null;
    this.socketReady = false;
  },
  onInput(e) {
    const inputValue = e.detail.value;
    this.setData({ inputValue });
    const hasText = inputValue.trim().length > 0;
    this.sendTypingState(hasText);
    if (this.typingStopTimer) {
      clearTimeout(this.typingStopTimer);
      this.typingStopTimer = null;
    }
    if (hasText) {
      this.typingStopTimer = setTimeout(() => {
        this.sendTypingState(false, true);
      }, 3000);
    }
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
        this.sendTypingState(false, true);
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
