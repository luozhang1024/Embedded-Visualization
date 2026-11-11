/* Per-peripheral SVG teaching scenes. No external assets or animation dependencies. */
"use strict";
const EmbeddedScenes = (() => {
  const C = {
    blue: "#007aff",
    green: "#28a883",
    gray: "#c6cfdb",
    text: "#344459",
    muted: "#94a0b1",
    orange: "#e9a146",
    purple: "#9566ca",
  };
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const hex = (n) =>
    "0x" + Number(n).toString(16).toUpperCase().padStart(2, "0");
  const text = (x, y, value, size = 12, color = C.text, anchor = "middle") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${color}">${esc(value)}</text>`;
  const path = (d, color = C.gray, width = 2, dash = false) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dash ? ' stroke-dasharray="5 5"' : ""}/>`;
  const rect = (x, y, w, h, fill = "#fff", stroke = "#e0e7f0", r = 10) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
  const dot = (x, y, color = C.blue, r = 4) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
  function chip(x, y, w, h, title, sub) {
    let pins = "";
    for (let i = 0; i < 5; i++) {
      const py = y + 22 + (i * (h - 44)) / 4;
      pins += path(`M${x - 7} ${py}H${x}M${x + w} ${py}h7`, "#bccbdf", 3);
    }
    return (
      pins +
      rect(x, y, w, h, "url(#chip-fill)", "#cfdced", 14) +
      rect(x + 8, y + 8, w - 16, h - 16, "none", "#e1e9f4", 9) +
      text(x + w / 2, y + h / 2 - 2, title, 19) +
      text(x + w / 2, y + h / 2 + 21, sub, 10, C.muted)
    );
  }
  const resistor = (x, y, h = 35) =>
    path(`M${x} ${y}v5l-5 4 10 5-10 5 10 5-5 4v${h - 28}`, "#aebed1", 1.7);
  const ground = (x, y) =>
    path(`M${x} ${y}v9m-12 0h24m-19 5h14m-10 5h6`, "#aebed1", 1.7);
  const pill = (name, value) =>
    `<span class="signal-pill">${esc(name)}<b>${esc(value)}</b></span>`;
  const bitCells = (data, completed, current, lsb) =>
    Array.from({ length: 8 }, (_, i) => {
      const bit = lsb ? i : 7 - i;
      return `<span class="bit-cell ${i < completed ? "received" : ""} ${i === current ? "current" : ""}"><span>D${bit}</span><b>${(data >> bit) & 1}</b></span>`;
    }).join("");
  function render(id, p, m, position) {
    const f = m.frames[position];
    let body = "",
      readout = "",
      name = "",
      hint = "",
      result;
    if (id === "gpio") {
      name = "输出级 · 电平指示";
      hint = "切换到开漏，移除上拉，再停在“写 1”：此时引脚为什么不是高电平？";
      const level = f.values[0],
        high = level === 1,
        driveHigh = p.mode === "pp" && f.output === 1,
        driveLow = f.output === 0,
        pull = p.pull === "yes",
        color = level === null ? C.orange : high ? C.blue : C.muted;
      body =
        rect(58, 34, 358, 241, "#ffffffa6", "#dfe7f1", 15) +
        text(85, 58, "STM32 · GPIO 输出级", 12, C.muted, "start");
      body +=
        text(278, 53, "VDD · 3.3 V", 10, C.muted) +
        path("M278 62V88", driveHigh ? C.blue : C.gray) +
        path("M278 114V156", driveHigh ? C.blue : C.gray);
      body +=
        path(
          `M278 88v8m0 0l${driveHigh ? "0 18" : "15 10"}`,
          driveHigh ? C.blue : C.gray,
          3,
        ) +
        dot(278, 114, C.gray, 2) +
        text(327, 105, p.mode === "od" ? "禁用" : "上管", 10, C.muted);
      body +=
        path("M278 156V184", driveLow ? C.blue : C.gray) +
        path(
          `M278 184v8m0 0l${driveLow ? "0 18" : "15 10"}`,
          driveLow ? C.blue : C.gray,
          3,
        ) +
        dot(278, 210, C.gray, 2) +
        path("M278 210v20", driveLow ? C.blue : C.gray) +
        ground(278, 230) +
        text(327, 204, "下管", 10, C.muted);
      body +=
        rect(81, 125, 96, 63, "#edf4ff", "#dce8fa", 9) +
        text(129, 150, "ODR", 12, C.blue) +
        text(129, 173, `写入 ${f.output}`, 16, C.blue) +
        path("M177 156H224", C.blue, 1.5, true) +
        text(211, 140, "控制", 9, C.muted);
      body +=
        path("M278 156H615", color, 3, level === null) +
        dot(278, 156, color) +
        dot(416, 156, color) +
        text(450, 146, "PA5", 11, color) +
        text(
          480,
          186,
          level === null
            ? "高阻态 · Z"
            : `${high ? "HIGH" : "LOW"} · ${high ? "3.3" : "0"} V`,
          14,
          color,
        );
      if (pull) {
        body +=
          text(490, 44, "外部上拉", 10, C.muted) +
          text(490, 62, "3.3 V", 10, C.muted) +
          path("M490 70v15") +
          resistor(490, 85, 42) +
          path("M490 127v29") +
          dot(490, 156, color, 3);
      } else body += text(490, 78, "未接上拉", 10, C.orange);
      body +=
        rect(590, 116, 135, 85, "#fff", "#e2e7f0", 13) +
        (high ? '<circle cx="657" cy="145" r="28" fill="#007aff0d"/>' : "") +
        dot(
          657,
          145,
          high ? C.blue : level === null ? "#e8c999" : "#d8e0eb",
          14,
        ) +
        text(
          657,
          184,
          high ? "逻辑高" : level === null ? "状态不确定" : "逻辑低",
          11,
          color,
        ) +
        text(657, 229, "高阻逻辑指示器", 10, C.muted) +
        text(410, 302, "开关为功能示意 · 指示灯不作为电气负载", 10, C.muted);
      readout =
        pill("模式", p.mode === "pp" ? "推挽" : "开漏") +
        pill("上管", driveHigh ? "导通" : "关闭") +
        pill("下管", driveLow ? "导通" : "关闭") +
        pill("PA5", level === null ? "Z" : level);
      result = level === null ? "Z · 悬空" : `${high ? "3.3" : "0"} V`;
    } else if (id === "usart") {
      name = "字节拆解 · 串行传输";
      hint = "把发送数据改成 1，再改成 128，对比第一个数据位和最后一个数据位。";
      const current = position >= 2 && position <= 9 ? position - 2 : -1,
        complete = Math.max(0, Math.min(8, position - 1));
      body =
        chip(56, 64, 158, 145, "STM32", "USART · TX") +
        chip(602, 64, 158, 145, "接收端", "RX · 8N1");
      body +=
        path("M221 135H595", f.values[0] ? C.blue : C.muted, 3) +
        text(
          410,
          98,
          `${f.label} · ${f.values[0] ? "高电平" : "低电平"}`,
          15,
          C.blue,
        ) +
        text(410, 177, `${p.baud} baud · 低位先传`, 11, C.muted);
      body +=
        rect(376, 116, 65, 38, "#eaf3ff", "#c9def8", 10) +
        text(408, 142, f.values[0], 21, C.blue) +
        path("M450 135h40", C.blue, 2) +
        path("M483 129l7 6-7 6", C.blue, 2);
      body +=
        text(135, 249, `发送 ${hex(p.byte)}`, 12, C.text) +
        text(681, 249, `已收到 ${complete} / 8 位`, 12, C.text) +
        text(410, 291, "START → D0 D1 D2 D3 D4 D5 D6 D7 → STOP", 11, C.muted);
      readout = bitCells(+p.byte, complete, current, true);
    } else if (id === "i2c") {
      name = "双线总线 · 开漏与应答";
      hint = "将从机响应改成 NACK，观察地址之后是否还会发送数据。";
      body =
        chip(48, 99, 150, 146, "主机", "I²C controller") +
        chip(621, 99, 150, 146, hex(p.address), "7 位地址 · 从机");
      for (let i = 0; i < 2; i++) {
        const y = 150 + i * 46,
          color = f.values[i] ? C.blue : C.muted,
          x = 366 + i * 90;
        body +=
          path(`M205 ${y}H614`, color, 2.5) +
          text(235, y - 10, i ? "SDA" : "SCL", 12, color, "start") +
          dot(x, y, color, 3) +
          path(`M${x} ${y}V97`) +
          resistor(x, 62, 35) +
          text(x, 45, "3.3 V", 10, C.muted) +
          rect(448, y - 14, 53, 28, "#fff", "#dce6f1", 7) +
          text(474, y + 5, f.values[i] ? "1" : "0", 14, color);
      }
      const slaveDrive =
        f.label === "ACK" || (f.label === "释放" && f.values[1] === 0);
      body +=
        text(
          410,
          261,
          slaveDrive
            ? "从机拉低 SDA · 主机读取应答"
            : f.label === "NACK"
              ? "SDA 保持高 · 地址无应答"
              : "数据相位由主机驱动，低电平设置、高电平采样",
          11,
          slaveDrive ? C.green : C.muted,
        ) +
        text(
          410,
          296,
          `地址 ${hex(p.address)} → 总线字节 ${hex(+p.address << 1)}（写）`,
          11,
          C.muted,
        );
      readout =
        pill("SCL", f.values[0]) +
        pill("SDA", f.values[1]) +
        pill("阶段", f.label) +
        pill("响应", p.ack === "yes" ? "ACK" : "NACK");
    } else if (id === "spi") {
      name = "时钟与数据 · 采样相位";
      hint = "保持数据不变，切换四种模式，观察采样标记与时钟空闲电平。";
      body =
        chip(48, 65, 155, 175, "SPI 主机", `Mode ${p.mode}`) +
        chip(618, 65, 155, 175, "SPI 从机", f.values[2] ? "未选中" : "已选中");
      ["SCK", "MOSI", "NSS"].forEach((label, i) => {
        const y = 110 + i * 43,
          color = f.values[i] ? C.blue : C.muted;
        body +=
          path(`M210 ${y}H611`, color, 2.5) +
          text(245, y - 10, label, 11, color, "start") +
          rect(384, y - 13, 54, 26, "#fff", "#dce6f1", 6) +
          text(411, y + 5, f.values[i], 14, color);
      });
      body +=
        text(
          410,
          271,
          f.sample
            ? "● 此沿采样 · 数据进入接收寄存器"
            : "观察时钟沿与 MOSI 的相对位置",
          12,
          f.sample ? C.orange : C.muted,
        ) +
        text(
          410,
          301,
          `CPOL=${+p.mode >> 1} · CPHA=${+p.mode & 1} · ${m.result}`,
          11,
          C.muted,
        );
      const samples = m.frames
        .slice(0, position + 1)
        .filter((frame) => frame.sample).length;
      readout = bitCells(+p.byte, samples, f.sample ? samples - 1 : -1, false);
    } else if (id === "adc") {
      name = "模拟电压 · 量化阶梯";
      hint =
        "把电压缓慢拖过 1.65 V，再切换 8 位与 12 位，观察每个码值对应的电压跨度。";
      const value = Number(m.result.split(" / ")[0]),
        max = 2 ** +p.bits - 1,
        y = 251 - (+p.voltage / 3.3) * 181;
      body +=
        path("M83 53V251H376", "#c6d2e1", 1.5) +
        text(70, 59, "3.3 V", 10, C.muted, "end") +
        text(70, 253, "0 V", 10, C.muted, "end") +
        text(230, 287, "理想量化阶梯 · 局部概念图", 10, C.muted);
      let stairs = "M84 251";
      for (let i = 0; i < 12; i++)
        stairs += `H${84 + (i + 1) * 24}V${251 - (i + 1) * 15}`;
      body +=
        path(stairs, "#aecbf2", 2) +
        path(`M84 ${y}H376`, C.blue, 1.5, true) +
        dot(220, y, C.blue, 6) +
        text(
          287,
          Math.max(39, y - 13),
          `${(+p.voltage).toFixed(2)} V`,
          14,
          C.blue,
        );
      body +=
        path("M407 151h41", C.blue, 2) +
        path("M442 145l7 6-7 6", C.blue, 2) +
        chip(478, 72, 148, 158, "ADC", `${p.bits} bit · Vref 3.3 V`) +
        rect(659, 104, 112, 94, "#edf4ff", "#d1e2f8", 12) +
        text(715, 133, "转换结果", 10, C.muted) +
        text(715, 164, position === 4 ? value : "…", 25, C.blue) +
        text(715, 185, position === 4 ? "EOC = 1" : "等待完成", 10, C.muted) +
        text(
          624,
          250,
          `0 — ${max} · 1 LSB = ${(3300 / (max + 1)).toFixed(3)} mV`,
          11,
          C.muted,
        );
      readout =
        pill("输入", `${(+p.voltage).toFixed(2)} V`) +
        pill("采样", f.values[0]) +
        pill("EOC", f.values[1]) +
        pill("码值", position === 4 ? value : "待转换");
    } else if (id === "dma") {
      name = "外设请求 · 内存搬运";
      hint = "关闭内存地址递增，播放一次，观察为什么只有 buffer[0] 一直变化。";
      const n = f.transferred,
        active = position > 0,
        moving = position > 0 && position % 2 === 0;
      body =
        chip(
          50,
          103,
          139,
          112,
          "外设 DR",
          n < +p.count ? hex(0x30 + n) : "传输结束",
        ) +
        chip(327, 103, 148, 112, "DMA", `剩余 ${+p.count - n} 项`) +
        rect(620, 70, 144, 174, "#fff", "#dce4ef", 13) +
        text(692, 101, "SRAM", 16, C.text) +
        text(692, 124, "buffer[]", 11, C.muted);
      body +=
        path("M196 153H320", active ? C.blue : C.gray, 2.5) +
        path("M482 153H613", moving ? C.blue : C.gray, 2.5) +
        text(259, 137, "请求 / 数据", 10, C.muted) +
        text(547, 137, "写入", 10, C.muted);
      if (active) {
        const packetX = moving ? 520 : 229;
        body +=
          rect(packetX, 168, 65, 28, "#e7f1ff", "#bbd8ff", 7) +
          text(packetX + 32, 187, hex(0x30 + (moving ? n - 1 : n)), 12, C.blue);
      }
      body +=
        rect(341, 27, 120, 40, "#fff", "#dce4ef", 9) +
        text(401, 52, "CPU · 配置通道", 11, C.muted) +
        path("M401 67V96", C.gray, 1.5, true) +
        text(
          401,
          259,
          active ? "CPU 无需逐项搬运数据" : "先设置地址、数据宽度与传输数",
          11,
          C.muted,
        );
      for (let i = 0; i < +p.count; i++) {
        const x = 94 + i * 79,
          filled = p.increment === "yes" ? i < n : i === 0 && n > 0,
          current = moving && i === (p.increment === "yes" ? n - 1 : 0);
        body +=
          rect(
            x,
            282,
            67,
            34,
            filled ? "#eaf3ff" : "#fff",
            current ? C.blue : "#e0e7f0",
            7,
          ) +
          text(
            x + 33,
            304,
            filled ? hex(0x30 + (p.increment === "yes" ? i : n - 1)) : "—",
            12,
            filled ? C.blue : C.muted,
          ) +
          text(x + 33, 334, `[${i}]`, 9, C.muted);
      }
      body +=
        text(692, 166, n > 0 ? `${n} 项已传输` : "等待请求", 12, C.blue) +
        text(
          692,
          194,
          p.increment === "yes" ? "地址依次递增" : "固定写入 [0]",
          11,
          C.muted,
        );
      readout =
        pill("请求", f.values[0]) +
        pill("剩余", +p.count - n) +
        pill("完成标志", f.values[1]) +
        pill("内存递增", p.increment === "yes" ? "ON" : "OFF");
      result = +p.count - n;
    } else throw new Error("Unknown scene: " + id);
    const height = id === "dma" ? 352 : 326;
    const svg = `<svg class="diagram-svg" viewBox="0 0 820 ${height}" role="img" aria-label="${esc(name + "，" + f.text)}"><defs><linearGradient id="chip-fill" x2="0" y2="1"><stop stop-color="#fdfefe"/><stop offset="1" stop-color="#eaf0f9"/></linearGradient></defs>${body}</svg>`;
    return { svg, readout, name, hint, result };
  }
  return { render };
})();
if (typeof module !== "undefined") module.exports = EmbeddedScenes;
