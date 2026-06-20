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
  }
});
