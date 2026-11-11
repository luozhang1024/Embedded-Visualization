/* nRF24L01 SPI teaching transaction: Mode 0, MSB first, static register snapshot.
 * Protocol reference: Nordic nRF24L01+ Product Specification, SPI interface,
 * SPI commands and register map. No RF engine or electrical timing simulation.
 */
"use strict";
const NRF24Lab = (() => {
  const hex = (n) => "0x" + n.toString(16).toUpperCase().padStart(2, "0");
  function buildModel(p) {
    const status = Number(p.status ?? 46),
      dummy = Number(p.dummy ?? 255);
    const operation = p.operation || "status",
      nop = operation === "nop";
    const register = operation === "config" ? "CONFIG" : "STATUS";
    const address = operation === "config" ? 0x00 : 0x07;
    const value = operation === "config" ? 0x0b : status;
    const tx = nop ? [0xff] : [address, dummy],
      rx = nop ? [status] : [status, value];
    const frames = [],
      add = (label, text, values, extra = {}) =>
        frames.push({ label, text, values, ...extra });
    add(
      "空闲",
      "CSN 为高，nRF24L01 的 MISO 为高阻态。STM32 尚未产生时钟。",
      [0, 0, null, 1],
      { completed: 0, byteIndex: 0, bitIndex: 0 },
    );
    add(
      "选中",
      "STM32 拉低 CSN，保持到整个命令与数据结束。双方先准备各自的最高位。",
      [0, tx[0] >> 7, rx[0] >> 7, 0],
      { completed: 0, byteIndex: 0, bitIndex: 0 },
    );
    tx.forEach((byte, byteIndex) => {
      for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
        const bit = 7 - bitIndex,
          mosi = (byte >> bit) & 1,
          miso = (rx[byteIndex] >> bit) & 1;
        const completed = byteIndex * 8 + bitIndex + 1;
        const phase = byteIndex === 0 ? "命令" : "数据";
        const source = byteIndex === 0 ? "STATUS 快照" : register;
        add(
          `${phase} D${bit} ↑`,
          `同一个上升沿：nRF24L01 从 MOSI 采入 ${mosi}；STM32 从 MISO 采入 ${miso}（${source} 的 D${bit}）。两边同时移入一位，已交换 ${completed} / ${tx.length * 8} 位。`,
          [1, mosi, miso, 0],
          { sample: true, completed, byteIndex, bitIndex },
        );
        const next = completed,
          nextByte = Math.floor(next / 8),
          nextBit = 7 - (next % 8);
        const nextTx =
          next < tx.length * 8 ? (tx[nextByte] >> nextBit) & 1 : mosi;
        const nextRx =
          next < tx.length * 8 ? (rx[nextByte] >> nextBit) & 1 : miso;
        let description =
          "下降沿：双方移出下一位。还没有新的采样，也没有额外接收一位。";
        if (bitIndex === 7)
          description =
            byteIndex === 0 && !nop
              ? `第 1 字节完成：从机收到 ${hex(byte)}${operation === "config" ? "（读 CONFIG）" : "（读 STATUS）"}，主机已经收到 STATUS=${hex(status)}。CSN 继续保持低，下一字节发送占位数据来读取 ${register}。`
              : `第 ${byteIndex + 1} 字节完成：STM32 收到 ${hex(rx[byteIndex])}；${nop ? "NOP 不需要第二字节。" : "寄存器值接收完成，接下来结束片选。"}`;
        add(`${phase} D${bit} ↓`, description, [0, nextTx, nextRx, 0], {
          completed,
          byteIndex: next < tx.length * 8 ? nextByte : byteIndex,
          bitIndex: next < tx.length * 8 ? next % 8 : bitIndex,
        });
      }
    });
    add(
      "返回",
      `STM32 拉高 CSN，MISO 释放为高阻态。${nop ? `NOP 的接收字节就是 STATUS=${hex(status)}。` : `Read_Reg(${register}) 返回第 2 个接收字节 ${hex(value)}；第 1 字节 ${hex(status)} 是命令期间同步返回的 STATUS。`}`,
      [0, tx.at(-1) & 1, null, 1],
      { completed: tx.length * 8, byteIndex: tx.length - 1, bitIndex: 7 },
    );
    const code = nop
      ? `// SPI1: Mode 0, 8-bit, MSB first；先完成初始化\nuint8_t tx = 0xFF, state = 0; // NOP\nCSN_LOW();\nHAL_StatusTypeDef ret = HAL_SPI_TransmitReceive(\n    &hspi1, &tx, &state, 1, 100); // 同时收发，8 个时钟\nCSN_HIGH();\nif (ret != HAL_OK) { Error_Handler(); }\n// 成功时 state = STATUS`
      : `// SPI1: Mode 0, 8-bit, MSB first；先完成初始化\nuint8_t NRF24L01_Read_Reg(uint8_t reg) {\n    uint8_t tx[2] = {0x00 | (reg & 0x1F), ${hex(dummy)}};\n    uint8_t rx[2] = {0};\n    CSN_LOW();\n    HAL_StatusTypeDef ret = HAL_SPI_TransmitReceive(\n        &hspi1, tx, rx, 2, 100); // 16 个时钟，同时收发\n    CSN_HIGH();\n    if (ret != HAL_OK) {\n        Error_Handler(); // 项目提供错误处理\n        return 0; // 此错误路径的值不能视为有效读取\n    }\n    // rx[0] = 命令期间的 STATUS\n    return rx[1]; // rx[1] = 目标寄存器值\n}\n// 在调用处：${register} = ${hex(address)}\n// uint8_t state = NRF24L01_Read_Reg(${hex(address)});`;
    return {
      frames,
      channels: ["SCK", "MOSI", "MISO", "CSN"],
      resultLabel: nop ? "NOP 返回值" : "驱动函数返回值",
      result: "等待交换",
      detail: nop
        ? `发送 NOP=0xFF，8 个时钟直接取回 STATUS=${hex(status)}。`
        : `发送 ${hex(tx[0])} → 收到 STATUS=${hex(status)}；再发送 ${hex(dummy)} → 收到 ${register}=${hex(value)}。`,
      time: "Mode 0 · 上升沿同时采样 · CSN 全程保持低",
      explanation:
        "SPI 每个时钟同时搬运两个方向的数据：STM32 的 MOSI → nRF24L01，nRF24L01 的 MISO → STM32。读寄存器时，第一组 8 个时钟交换读命令与 STATUS；第二组 8 个时钟交换占位字节与寄存器值。没有时钟，就没有数据位被采入。",
      takeaway:
        "0x07 是 STATUS 的寄存器地址，不是写入 STATUS 的数据。R_REGISTER | 0x07 = 0x07；写寄存器则是另一条 W_REGISTER 命令。0xFF 位于首字节时是 NOP 命令，位于读寄存器后续数据阶段时只是占位，不会开启新命令。",
      code,
      transfer: { tx, rx, status, value, register, operation, nop },
    };
  }
  function render(p, m, position) {
    const f = m.frames[position],
      t = m.transfer,
      total = f.completed,
      index = f.byteIndex;
    const esc = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const text = (x, y, s, size = 12, color = "#596d85", anchor = "middle") =>
      `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${color}">${esc(s)}</text>`;
    const rect = (x, y, w, h, fill = "#fff", stroke = "#dce5f2") =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}"/>`;
    const path = (d, color = "#bdcbdc", dash = false) =>
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"${dash ? ' stroke-dasharray="5 5"' : ""}/>`;
    const receiving = position > 0 && position < m.frames.length - 1;
    let body =
      rect(25, 24, 218, 270, "#f8fbff") +
      rect(577, 24, 218, 270, "#fcf9ff") +
      text(134, 60, "STM32", 24, "#2368b2") +
      text(686, 60, "nRF24L01", 24, "#8664b1") +
      text(134, 82, "主机 · 产生时钟", 11) +
      text(686, 82, "从机 · 响应命令", 11);
    const rows = [
      {
        label: "SCK",
        y: 119,
        value: f.values[0],
        color: "#899bb0",
        right: true,
      },
      {
        label: "MOSI",
        y: 164,
        value: f.values[1],
        color: "#007aff",
        right: true,
      },
      {
        label: "MISO",
        y: 210,
        value: f.values[2],
        color: "#a26aca",
        right: false,
      },
      {
        label: "CSN",
        y: 255,
        value: f.values[3],
        color: "#9aafc4",
        right: true,
      },
    ];
    for (const row of rows) {
      const color = row.value === null ? "#c6b18c" : row.color;
      body +=
        path(`M244 ${row.y}H576`, color, row.value === null) +
        text(269, row.y - 11, row.label, 11, color, "start") +
        text(
          552,
          row.y - 11,
          row.value === null ? "Z · 高阻" : row.value,
          12,
          color,
          "end",
        );
      const tip = row.right ? 563 : 257,
        sign = row.right ? -1 : 1;
      body += path(
        `M${tip + sign * 7} ${row.y - 5}L${tip} ${row.y}L${tip + sign * 7} ${row.y + 5}`,
        color,
      );
      if (receiving && (row.label === "MOSI" || row.label === "MISO")) {
        const progress = (total % 8) / 8,
          x = row.right ? 321 + progress * 165 : 498 - progress * 165;
        body +=
          `<circle cx="${x}" cy="${row.y}" r="13" fill="${color}"/>` +
          text(x, row.y + 4, row.value, 12, "#fff");
      }
    }
    body +=
      text(134, 120, "TX → MOSI", 11, "#007aff") +
      text(134, 143, hex(t.tx[index]), 21, "#007aff") +
      text(686, 120, "MISO ← TX", 11, "#a26aca") +
      text(686, 143, hex(t.rx[index]), 21, "#a26aca");
    const partial = (byte, n) =>
      n === 0
        ? "_ _ _ _ _ _ _ _"
        : Array.from({ length: 8 }, (_, i) =>
            i < n ? String((byte >> (7 - i)) & 1) : "_",
          ).join(" ");
    const count = Math.max(0, Math.min(8, total - index * 8));
    body +=
      text(134, 191, "RX · 从 MISO 采入", 10) +
      text(134, 216, partial(t.rx[index], count), 12, "#9561bc") +
      text(686, 191, "RX · 从 MOSI 采入", 10) +
      text(686, 216, partial(t.tx[index], count), 12, "#007aff");
    body +=
      text(134, 265, `接收 ${count}/8 位`, 11) +
      text(
        686,
        265,
        index === 0
          ? total >= 8
            ? t.nop
              ? "识别 NOP"
              : "读命令已解码"
            : "等待完整命令"
          : "读阶段：忽略 MOSI 占位内容",
        10,
      );
    body += text(
      410,
      324,
      f.sample
        ? "同一个上升沿，两边同时采入一位。"
        : f.values[3]
          ? "CSN 为高：事务未开始或已经结束。"
          : "下降沿准备下一位；上升沿才同时采样。",
      13,
      f.sample ? "#007aff" : "#8090a5",
    );
    const bitRow = (y, byte, label, color) => {
      let s = text(75, y + 19, label, 10, color);
      for (let i = 0; i < 8; i++) {
        const x = 130 + i * 72,
          current = f.sample && i === f.bitIndex,
          done = i < count;
        s +=
          rect(
            x,
            y,
            56,
            31,
            current ? color : done ? "#edf3fa" : "#fff",
            current ? color : "#dfe7f1",
          ) +
          text(
            x + 28,
            y + 21,
            (byte >> (7 - i)) & 1,
            14,
            current ? "#fff" : done ? color : "#bbc4d0",
          );
        if (y === 363) s += text(x + 28, y - 8, `D${7 - i}`, 9, "#9aa8ba");
      }
      return s;
    };
    body +=
      bitRow(363, t.tx[index], "MOSI →", "#007aff") +
      bitRow(408, t.rx[index], "← MISO", "#a26aca");
    body += text(
      410,
      472,
      `第 ${index + 1} 字节 · 已交换 ${total} / ${t.tx.length * 8} 位 · 共用同一根 SCK`,
      11,
    );
    const svg = `<svg class="diagram-svg" viewBox="0 0 820 490" role="img" aria-label="${esc(f.text)}">${body}</svg>`;
    const stage = (i, label, sub) =>
      `<button type="button" class="exchange-stage ${index === i && position > 0 ? "active" : ""}" data-seek="${i === 0 ? 16 : 32}" aria-label="跳转到${label}交换完成"><span>${label} · 8 个时钟</span><strong><i>MOSI → ${hex(t.tx[i])}</i><i>MISO ← ${total >= (i + 1) * 8 ? hex(t.rx[i]) : "等待接收"}</i></strong><small>${sub}</small></button>`;
    const received = total >= t.tx.length * 8;
    const readout = `<div class="exchange-ledger">${stage(0, t.nop ? "NOP" : "① 命令", t.nop ? "0xFF 作为首字节：NOP → STATUS" : `R_REGISTER | ${t.register}；返回的是 STATUS`)}${t.nop ? "" : stage(1, "② 数据", `${hex(t.tx[1])} 只提供时钟；返回的是 ${t.register}`)}<div class="exchange-result"><span>${t.nop ? "NOP 返回" : "Read_Reg 返回"}</span><strong>${received ? hex(t.rx.at(-1)) : "等待完整字节"}</strong><small>${t.nop ? "只需一次字节交换" : t.register === "STATUS" ? "两个字节都可能是同一个 STATUS，但含义不同。" : "STATUS 与 CONFIG 是不同的返回内容。"}</small></div><div class="status-flags">STATUS=${hex(t.status)} · RX_DR=${(t.status >> 6) & 1} · TX_DS=${(t.status >> 5) & 1} · MAX_RT=${(t.status >> 4) & 1} · RX_P_NO=${(t.status >> 1) & 7} · TX_FULL=${t.status & 1}<br>CE 保持低；CSN 控制 SPI 事务，CE 控制无线工作模式。两者不是同一根信号。</div></div>`;
    return {
      svg,
      readout,
      name: "STM32 ↔ nRF24L01 · 同一时钟，双向交换",
      hint: "先读 STATUS，再读 CONFIG：命令期间 MISO 都返回 STATUS，但第二字节变成不同的寄存器值。把占位 0xFF 改为 0x00，返回值会改变吗？",
      result: received
        ? f.values[3]
          ? hex(t.rx.at(-1))
          : "待拉高 CSN"
        : "等待交换",
    };
  }
  return { buildModel, render };
})();
if (typeof module !== "undefined") module.exports = NRF24Lab;
