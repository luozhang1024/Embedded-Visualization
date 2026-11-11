"use strict";
/* A progressive explanation backed by the same nRF transaction frames. */
const SPIStory = (() => {
  const hex = (n) => "0x" + n.toString(16).toUpperCase().padStart(2, "0");
  function chapters(m) {
    return [
      { at: 0, title: "我想读一个寄存器" },
      { at: 1, title: "先选中这颗芯片" },
      { at: 16, title: "第一轮：发命令，同时收状态" },
      ...(!m.transfer.nop
        ? [{ at: 32, title: "第二轮：继续打时钟，收目标值" }]
        : []),
      { at: m.frames.length - 1, title: "结束事务，交出返回值" },
    ];
  }
  function render(m, position) {
    const f = m.frames[position],
      t = m.transfer,
      done = position === m.frames.length - 1;
    const scenes = chapters(m);
    const chapter = scenes.findIndex((c) => c.at >= position);
    const active = chapter < 0 ? scenes.length - 1 : chapter;
    const i = f.byteIndex,
      count = Math.max(0, Math.min(8, f.completed - i * 8));
    const firstDone = f.completed >= 8,
      secondDone = f.completed >= 16;
    let title, description, focus;
    if (position === 0) {
      title = t.nop
        ? "只想知道当前状态，发一次 NOP。"
        : `STM32：我想读取 ${t.register}。`;
      description =
        "先记住一件事：主机发出时钟时，两条数据线同时工作。发出去一个字节，也会收到一个字节。";
      focus = "现在还没有时钟，也没有任何数据被接收。";
    } else if (position === 1) {
      title = "CSN 拉低：这次交流开始了。";
      description =
        "STM32 选中 nRF24L01。双方把要发的数据放好，但选中本身不会传走任何一位。";
      focus =
        "片选负责“选谁”，时钟负责“什么时候交换”。CE 是另外的无线控制信号。";
    } else if (done) {
      title = `返回 ${hex(t.rx.at(-1))}：读取完成。`;
      description = t.nop
        ? "只交换了一个字节，NOP 同时收到的 STATUS 就是结果。"
        : `CSN 拉高后，这次事务结束。Read_Reg(${t.register}) 交出第二轮收到的 ${hex(t.value)}。`;
      focus = t.nop
        ? "总共 8 个时钟。"
        : `总共 16 个时钟。第一个接收字节是 STATUS，第二个才是目标 ${t.register}。`;
    } else if (i === 0) {
      title = t.nop
        ? "发出 NOP 的同时，STATUS 正在回来。"
        : "第一轮：告诉从机要读哪里。";
      description = t.nop
        ? "MOSI 发送 0xFF（NOP），同一组时钟下 MISO 返回 STATUS。不需要再发送占位字节。"
        : `MOSI 发送 ${hex(t.tx[0])}（读 ${t.register} 命令），MISO 同时返回当前 STATUS。它不会等命令发完才开始返回。`;
      focus = firstDone
        ? `第一轮完成：从机收到命令，STM32 收到 STATUS=${hex(t.status)}。${t.nop ? "可以结束了。" : "CSN 还不能拉高，接下来继续读数据。"}`
        : "每敲一次时钟，两端各接收一位；不是先发完再接收。";
    } else {
      title = "第二轮：想接收，也要继续发。";
      description = `MOSI 发送 ${hex(t.tx[1])} 占位，目的是让 STM32 再产生 8 个时钟。同一时间，MISO 正在送回 ${t.register}。从机忽略这轮 MOSI 的内容。`;
      focus = secondDone
        ? `目标值 ${hex(t.value)} 已接收完整。最后还要拉高 CSN，结束事务。`
        : `这轮的 ${hex(t.tx[1])} 是占位。0xFF 只有放在首个命令字节位置时才表示 NOP。`;
    }
    const cells = (byte, n, kind) =>
      Array.from({ length: 8 }, (_, b) => {
        const bit = (byte >> (7 - b)) & 1;
        const received = kind === "received",
          visible = received ? b < n : b >= n;
        return `<span class="queue-bit ${visible ? (received ? "arrived" : "waiting") : "vacant"}" aria-label="D${7 - b}: ${visible ? bit : "空"}">${visible ? bit : "·"}</span>`;
      }).join("");
    const lane = (outbound) => {
      const byte = outbound ? t.tx[i] : t.rx[i],
        color = outbound ? "blue" : "purple",
        current = (byte >> (7 - f.bitIndex)) & 1;
      const source = `<div class="queue-end"><span>${outbound ? "STM32 发出" : "nRF24L01 发出"} <b>${hex(byte)}</b></span><div class="queue-bits">${cells(byte, count, "pending")}</div></div>`;
      const dest = `<div class="queue-end"><span>${outbound ? "nRF24L01 收到" : "STM32 收到"} <b>${count}/8 位</b></span><div class="queue-bits">${cells(byte, count, "received")}</div></div>`;
      return `<div class="story-lane ${color}">${outbound ? source : dest}<div class="queue-wire"><span>${outbound ? "MOSI →" : "← MISO"}</span><div class="wire-track">${f.sample ? `<b class="flying-bit ${outbound ? "outbound" : "inbound"}">${current}</b>` : ""}</div><small>${f.sample ? "同一拍采入" : "等待下一拍"}</small></div>${outbound ? dest : source}</div>`;
    };
    const receipt = (idx, label) =>
      `<div class="receipt ${f.completed >= (idx + 1) * 8 ? "filled" : ""}"><span>${label}</span><strong>${f.completed >= (idx + 1) * 8 ? hex(t.rx[idx]) : "还没收全"}</strong><small>${idx === 0 ? "命令期间返回的 STATUS" : `目标寄存器 ${t.register}`}</small></div>`;
    return `<nav class="story-chapters" aria-label="故事章节">${scenes.map((c, j) => `<button data-story-seek="${c.at}" class="${j === active ? "active" : ""}" aria-current="${j === active ? "step" : "false"}"><b>${j + 1}</b><span>${c.title}</span></button>`).join("")}</nav>
      <section class="story-narration" aria-live="polite" aria-atomic="true"><span>第 ${active + 1} 幕 / ${scenes.length} 幕</span><h3>${title}</h3><p>${description}</p></section>
      <div class="story-clock-face"><span class="clock-lamp ${f.sample ? "on" : ""}"></span><b>SCK · 共用一只时钟</b><span>已交换 ${f.completed} / ${t.tx.length * 8} 位</span></div>
      <div class="story-conveyor" role="img" aria-label="${f.completed} 位已同时交换，MOSI 发 ${hex(t.tx[i])}，MISO 回 ${hex(t.rx[i])}">${lane(true)}${lane(false)}</div>
      <p class="story-focus">${focus}</p>
      <div class="story-receipts">${receipt(0, "接收盒 rx[0]")}${t.nop ? "" : receipt(1, "接收盒 rx[1]")}<div class="receipt returned ${done ? "filled" : ""}"><span>函数交给 state</span><strong>${done ? hex(t.rx.at(-1)) : "尚未返回"}</strong><small>${t.nop ? "取 rx[0]" : "取 rx[1]，不取 rx[0]"}</small></div></div>
      ${!t.nop && t.register === "STATUS" ? '<div class="story-comparison">两轮都是 STATUS，数值可能相同，容易混淆。<button id="story-compare">换成读 CONFIG，对比两次返回 →</button></div>' : ""}
      <details class="story-analogy"><summary>为什么“读”还要“写”？</summary><p>这里的“写”是向 SPI 控制器放入一个要发的字节，让它产生时钟，不等于向从机寄存器写数据。一次交换，两边各送出 8 位、各收到 8 位；读取命令决定这些位该如何解释。</p></details>`;
  }
  return { chapters, render };
})();
if (typeof module !== "undefined") module.exports = SPIStory;
