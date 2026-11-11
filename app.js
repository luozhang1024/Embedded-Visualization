"use strict";

const MODULES = {
  gpio: {
    title: "GPIO",
    name: "通用输入 / 输出",
    icon: "⌁",
    tag: "数字电平",
    description:
      "一个引脚如何控制外部电路？切换输出模式，观察电平与 LED 的变化。",
    controls: [
      {
        key: "mode",
        label: "输出模式",
        options: [
          ["pp", "推挽输出"],
          ["od", "开漏输出"],
        ],
        value: "pp",
      },
      {
        key: "pull",
        label: "外部上拉电阻",
        options: [
          ["yes", "接入上拉"],
          ["no", "无上拉"],
        ],
        value: "yes",
      },
    ],
  },
  usart: {
    title: "USART",
    name: "通用同步 / 异步收发器",
    icon: "⇄",
    tag: "异步串行 · 8N1",
    description:
      "让一个字节沿 TX 线逐位发送：起始位 → 8 个数据位（LSB first）→ 停止位。",
    controls: [
      {
        key: "byte",
        label: "发送数据（十进制）",
        type: "number",
        min: 0,
        max: 255,
        value: 65,
        help: "0–255；默认 65 = 0x41 = 字符 A",
      },
      {
        key: "baud",
        label: "波特率",
        options: [
          ["9600", "9600 baud"],
          ["115200", "115200 baud"],
        ],
        value: "9600",
      },
    ],
  },
  i2c: {
    title: "I²C",
    name: "双线串行总线",
    icon: "⑁",
    tag: "7 位寻址 · 写入",
    description:
      "跟随 SCL 和 SDA，观察主机寻址、从机应答与一个字节的写入过程。",
    controls: [
      {
        key: "address",
        label: "从机地址（十进制）",
        type: "number",
        min: 8,
        max: 119,
        value: 80,
        help: "使用非保留地址 8–119；默认 80 = 0x50",
      },
      {
        key: "byte",
        label: "写入数据（十进制）",
        type: "number",
        min: 0,
        max: 255,
        value: 165,
      },
      {
        key: "ack",
        label: "模拟从机响应",
        options: [
          ["yes", "ACK · 正常应答"],
          ["no", "NACK · 地址无应答"],
        ],
        value: "yes",
      },
    ],
  },
  spi: {
    title: "SPI",
    name: "串行外设接口",
    icon: "≋",
    tag: "同步串行 · MSB first",
    description:
      "时钟由主机产生。改变 CPOL / CPHA，观察时钟空闲电平和数据采样沿。",
    controls: [
      {
        key: "byte",
        label: "发送数据（十进制）",
        type: "number",
        min: 0,
        max: 255,
        value: 165,
      },
      {
        key: "mode",
        label: "SPI 模式",
        options: [
          ["0", "Mode 0 · CPOL=0, CPHA=0"],
          ["1", "Mode 1 · CPOL=0, CPHA=1"],
          ["2", "Mode 2 · CPOL=1, CPHA=0"],
          ["3", "Mode 3 · CPOL=1, CPHA=1"],
        ],
        value: "0",
      },
    ],
  },
  adc: {
    title: "ADC",
    name: "模数转换器",
    icon: "∿",
    tag: "模拟 → 数字",
    description:
      "拖动输入电压，观察连续的模拟量如何被量化成有限位数的数字结果。",
    controls: [
      {
        key: "voltage",
        label: "输入电压",
        type: "range",
        min: 0,
        max: 3.3,
        step: 0.01,
        value: 1.65,
        unit: " V",
      },
      {
        key: "bits",
        label: "转换分辨率",
        options: [
          ["8", "8 位 · 256 个量化等级"],
          ["10", "10 位 · 1024 个量化等级"],
          ["12", "12 位 · 4096 个量化等级"],
        ],
        value: "12",
      },
    ],
  },
  dma: {
    title: "DMA",
    name: "直接存储器访问",
    icon: "▤",
    tag: "外设 → 内存",
    description:
      "CPU 配置好通道后，由 DMA 响应外设请求，把数据依次搬入内存缓冲区。",
    controls: [
      {
        key: "count",
        label: "传输长度",
        options: [
          ["4", "4 个数据项"],
          ["8", "8 个数据项"],
        ],
        value: "4",
      },
      {
        key: "increment",
        label: "内存地址递增",
        options: [
          ["yes", "开启 · 依次填充"],
          ["no", "关闭 · 覆盖同一位置"],
        ],
        value: "yes",
      },
    ],
  },
};

const hex = (n) => "0x" + Number(n).toString(16).toUpperCase().padStart(2, "0");
const bits = (n, lsb = false) =>
  Array.from({ length: 8 }, (_, i) => (n >> (lsb ? i : 7 - i)) & 1);
function buildModel(id, p) {
  const frames = [];
  const add = (label, text, values, extra = {}) =>
    frames.push({ label, text, values, ...extra });
  let channels, resultLabel, result, detail, explanation, takeaway, code, time;
  if (id === "gpio") {
    channels = ["引脚"];
    [0, 1, 0, 1, 0, 1].forEach((value, i) => {
      const level = value && p.mode === "od" && p.pull === "no" ? null : value;
      add(
        `写 ${value}`,
        level === null
          ? "输出管关闭，引脚悬空；不能保证读到高电平。"
          : value && p.mode === "od"
            ? "输出管关闭，由外部上拉电阻将引脚拉高。"
            : `输出级主动驱动${value ? "高" : "低"}电平，逻辑指示器显示${value ? "高" : "低"}状态。`,
        [level],
        { output: value },
      );
    });
    resultLabel = "当前引脚电平";
    result = "动态";
    detail = "供电 3.3 V；灯光仅表示逻辑状态，不模拟 LED 负载电流。";
    time = "每步代表一次软件写入";
    explanation =
      "推挽输出可以主动拉高、拉低。开漏输出只负责拉低：写 0 导通输出管，写 1 关闭输出管、释放引脚。接入上拉后，释放的引脚才会回到高电平；没有上拉时电平不确定。";
    takeaway = "开漏的“1”表示释放总线，这是理解 I²C 多设备共用信号线的基础。";
    code =
      "// 先配置输出模式及 LED 引脚\nHAL_GPIO_WritePin(GPIOA, GPIO_PIN_5,\n                  GPIO_PIN_SET);\n// 开漏：SET 表示释放，RESET 表示拉低";
  } else if (id === "usart") {
    channels = ["TX"];
    add("空闲", "异步串口空闲时，TX 保持高电平。", [1]);
    add("START", "起始位拉低，通知接收端开始接收一帧。", [0]);
    bits(+p.byte, true).forEach((b, i) =>
      add(`D${i}`, `发送数据位 D${i} = ${b}。USART 先发送最低有效位。`, [b]),
    );
    add("STOP", "停止位为高电平；本实验使用 1 个停止位、无校验。", [1]);
    add("空闲", "一帧发送结束，线路回到空闲状态。", [1]);
    resultLabel = "帧内传输时间";
    result = `${((10 / +p.baud) * 1000).toFixed(3)} ms`;
    detail = `${hex(p.byte)} · ${Number(p.byte).toString(2).padStart(8, "0")}；10 位 / ${p.baud} baud。`;
    time = `1 bit = ${(1e6 / +p.baud).toFixed(2)} μs`;
    explanation =
      "USART 的异步模式没有独立时钟线，发送端与接收端约定相同的波特率和帧格式。接收端检测到起始位后，按位周期采样。8N1 每发送 8 位有效数据，需要 10 位线路时间。";
    takeaway = "图中的数据顺序是 D0 → D7；它与通常书写二进制数的顺序相反。";
    code = `// huart1：${p.baud} baud，8N1\nuint8_t data = ${hex(p.byte)};\nHAL_UART_Transmit(&huart1, &data, 1, 100);`;
  } else if (id === "i2c") {
    channels = ["SCL", "SDA"];
    add("空闲", "SCL、SDA 都由上拉电阻保持高电平。", [1, 1]);
    add("START", "SCL 为高时，SDA 从高变低，形成起始条件。", [1, 0]);
    const sendByte = (value, prefix) =>
      bits(value).forEach((b, i) => {
        const name =
          prefix === "A"
            ? i === 7
              ? "R/W"
              : `A${6 - i}`
            : `${prefix}${7 - i}`;
        add(`${name}·设`, `SCL 低电平期间，主机设置 ${name} = ${b}。`, [0, b]);
        add(`${name}·读`, `SCL 高电平期间，接收方采样 ${b}；SDA 保持稳定。`, [
          1,
          b,
        ]);
      });
    sendByte(+p.address << 1, "A");
    frames[16].text = "主机设置方向位 R/W = 0，表示写入。";
    frames[17].text = "从机采样方向位 R/W = 0；完整地址字节已发送。";
    const ack = p.ack === "yes" ? 0 : 1;
    add(
      "释放",
      ack
        ? "第九个时钟前，主机释放 SDA；无从机拉低，SDA 被上拉为高。"
        : "第九个时钟前，主机释放 SDA，从机在低电平相位将 SDA 拉低。",
      [0, ack],
    );
    add(
      ack ? "NACK" : "ACK",
      ack
        ? "从机未拉低 SDA：地址无应答，主机将终止本次传输。"
        : "第九个时钟，主机采样到 SDA 为低，表示地址应答 ACK。",
      [1, ack],
    );
    if (!ack) {
      sendByte(+p.byte, "D");
      add(
        "释放",
        "主机释放 SDA，从机在 SCL 低电平时拉低 SDA，准备数据应答。",
        [0, 0],
      );
      add("ACK", "主机在第九个时钟采样到 SDA 为低，数据得到确认。", [1, 0]);
    }
    add("结束准备", "SCL 拉低后，主机将 SDA 拉低，准备 STOP。", [0, 0]);
    add("抬高 SCL", "保持 SDA 为低，先释放 SCL。", [1, 0]);
    add("STOP", "SCL 为高时，SDA 从低变高，形成停止条件。", [1, 1]);
    resultLabel = "总线事务";
    result = ack ? "NACK" : "WRITE + ACK";
    detail = `7 位地址 ${hex(p.address)} → 地址字节 ${hex(+p.address << 1)}${ack ? "；无应答，数据未发送。" : `；写入 ${hex(p.byte)}。`}`;
    time = "相位示意，非等时采样";
    explanation =
      "I²C 使用开漏输出和上拉电阻。数据通常在 SCL 低电平时改变、高电平时保持稳定；START 和 STOP 是例外。7 位地址后跟 1 位读写方向，每个字节后都有第九个应答时钟。";
    takeaway =
      "HAL 的 DevAddress 参数通常使用左移 1 位的 7 位地址；手册中的 7 位地址不应直接照填。";
    code = `uint8_t data = ${hex(p.byte)};\nHAL_StatusTypeDef status = HAL_I2C_Master_Transmit(\n    &hi2c1, ${hex(p.address)} << 1, &data, 1, 100);\n// 检查 status 及 HAL_I2C_GetError(&hi2c1)`;
  } else if (id === "spi") {
    channels = ["SCK", "MOSI", "NSS"];
    const cpol = +p.mode >> 1,
      cpha = +p.mode & 1,
      data = bits(+p.byte);
    add("空闲", `SCK 空闲电平为 ${cpol}，片选 NSS 为高。`, [cpol, 0, 1]);
    add("选中", "NSS 拉低，选中从机。", [cpol, cpha ? 0 : data[0], 0]);
    data.forEach((b, i) => {
      add(
        `D${7 - i}·前`,
        cpha
          ? `第一个沿移出 D${7 - i} = ${b}。`
          : `第一个沿采样 D${7 - i} = ${b}。`,
        [1 - cpol, b, 0],
        { sample: !cpha },
      );
      add(
        `D${7 - i}·后`,
        cpha
          ? `第二个沿采样 D${7 - i} = ${b}。`
          : "第二个沿移出下一位数据；接收方等待下一个采样沿。",
        [cpol, cpha ? b : (data[i + 1] ?? b), 0],
        { sample: !!cpha },
      );
    });
    add("结束", "NSS 回到高电平，8 位数据发送完成。", [cpol, data[7], 1]);
    resultLabel = "当前采样沿";
    result = (cpha ? cpol : 1 - cpol) ? "↑ 上升沿" : "↓ 下降沿";
    detail = `Mode ${p.mode} · CPOL=${cpol} · CPHA=${cpha}；发送 ${hex(p.byte)}。`;
    time = "● 表示采样相位";
    explanation =
      "CPOL 决定时钟空闲电平；CPHA 决定在第一个还是第二个时钟沿采样。每个数据位占一个完整时钟周期。主从双方必须使用一致的模式。本图只展示 MOSI 发送，SPI 也可以同时经 MISO 接收。";
    takeaway = "“第一个沿”不总是上升沿：当 CPOL=1 时，第一个沿是下降沿。";
    code = `// hspi1 预先配置为 Mode ${p.mode}\nuint8_t data = ${hex(p.byte)};\nHAL_GPIO_WritePin(CS_GPIO_Port, CS_Pin, GPIO_PIN_RESET);\nHAL_SPI_Transmit(&hspi1, &data, 1, 100);\nHAL_GPIO_WritePin(CS_GPIO_Port, CS_Pin, GPIO_PIN_SET);`;
  } else if (id === "adc") {
    const levels = 2 ** +p.bits,
      value = Math.min(levels - 1, Math.floor((+p.voltage / 3.3) * levels));
    channels = ["采样", "EOC"];
    add("等待", "等待软件或定时器触发一次转换。", [0, 0]);
    add("采样", `对 ${(+p.voltage).toFixed(2)} V 的模拟输入进行采样。`, [1, 0]);
    add("保持", "保持采样电压，进入转换阶段。", [0, 0]);
    add(
      "量化",
      `理想量化：floor(Vin / Vref × ${levels})，并限制在 0–${levels - 1}。`,
      [0, 0],
    );
    add("完成", `转换完成，EOC 置位，结果为 ${value}。`, [0, 1]);
    resultLabel = "理想转换结果";
    result = `${value} / ${levels - 1}`;
    detail = `Vref = 3.3 V · 1 LSB ≈ ${(3300 / levels).toFixed(3)} mV`;
    time = "转换阶段示意，非 ADC 时钟";
    explanation = `ADC 把模拟电压映射到离散数字。${p.bits} 位 ADC 有 ${levels} 个量化等级，最大码值是 ${levels - 1}。分辨率越高，电压阶梯越细；它不等于测量精度，实际结果还受参考电压、噪声和采样时间影响。`;
    takeaway =
      "输入电压达到参考电压时，结果饱和到最大码值；本实验只允许 0–3.3 V 输入。";
    code =
      "// 单次软件触发，先完成 ADC 初始化\nHAL_ADC_Start(&hadc1);\nif (HAL_ADC_PollForConversion(&hadc1, 100) == HAL_OK) {\n    uint32_t value = HAL_ADC_GetValue(&hadc1);\n}";
  } else if (id === "dma") {
    channels = ["请求", "完成"];
    add(
      "配置",
      "CPU 配置外设地址、内存地址与传输长度，随后使能 DMA。",
      [0, 0],
      { transferred: 0 },
    );
    for (let i = 0; i < +p.count; i++) {
      add(
        `请求 ${i + 1}`,
        `外设数据寄存器就绪，发出第 ${i + 1} 次 DMA 请求。`,
        [1, 0],
        { transferred: i },
      );
      add(
        `搬运 ${i + 1}`,
        `DMA 把 ${hex(0x30 + i)} 写入 buffer[${p.increment === "yes" ? i : 0}]，剩余 ${+p.count - i - 1} 项。`,
        [0, i === +p.count - 1 ? 1 : 0],
        { transferred: i + 1 },
      );
    }
    resultLabel = "剩余传输数";
    result = p.count;
    detail = `单次模式 · ${p.count} 项 · 内存地址${p.increment === "yes" ? "递增" : "固定"}；数据宽度为 8 位。`;
    time = "每个请求对应一次数据搬运";
    explanation =
      "DMA 根据外设请求在外设寄存器和内存之间传输数据，CPU 不必逐项读取、写入。每完成一项，剩余计数递减。单次模式计数归零后停止；循环模式需要另行配置。CPU 仍负责初始化和处理完成事件。";
    takeaway =
      "关闭内存地址递增时，所有传输都会覆盖 buffer[0]，并不会自动填满整个缓冲区。";
    code = `// 先配置字节宽度、单次模式、内存${p.increment === "yes" ? "递增" : "不递增"}\nstatic uint8_t buffer[${p.count}];\nHAL_UART_Receive_DMA(&huart1, buffer, ${p.count});\n// 在接收完成回调中处理 buffer`;
  } else {
    throw new Error("Unknown module: " + id);
  }
  return {
    frames,
    channels,
    resultLabel,
    result,
    detail,
    explanation,
    takeaway,
    code,
    time,
  };
}

if (typeof module !== "undefined") module.exports = { buildModel, MODULES };

if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);
  let selected = "gpio",
    params = {},
    model,
    position = 0,
    timer = null;
  const escapeHTML = (value) =>
    String(value).replace(
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
  const categories = [
    { id: "all", name: "全部实验", icon: "▦" },
    { id: "basic", name: "基础外设", icon: "⌁" },
    { id: "bus", name: "通信协议", icon: "⇄" },
    { id: "analog", name: "模拟采集", icon: "∿" },
    { id: "system", name: "系统协同", icon: "▤" },
  ];
  const metadata = {
    gpio: ["basic", "#007aff", "#edf4ff", "推挽 / 开漏 / 电平"],
    usart: ["bus", "#af52de", "#f6edfc", "串口 / 逐位发送"],
    i2c: ["bus", "#ff9500", "#fff4e5", "寻址 / 应答 / 总线"],
    spi: ["bus", "#30a58b", "#eaf7f2", "时钟 / 采样沿"],
    adc: ["analog", "#ff617b", "#fff0f3", "采样 / 量化 / 编码"],
    dma: ["system", "#5856d6", "#f0efff", "数据搬运 / 缓冲区"],
  };
  let category = "all";
  const aliases = { gpio: "引脚 io", usart: "uart 串口 8n1", i2c: "iic i2c i²c", spi: "串行", adc: "模数转换 电压", dma: "内存 搬运" };
  $("categories").innerHTML = categories
    .map(
      (c) =>
        `<button data-category="${c.id}" aria-pressed="${c.id === "all"}" class="${c.id === "all" ? "active" : ""}"><span class="category-icon" aria-hidden="true">${c.icon}</span>${c.name}<span class="category-count">${Object.keys(MODULES).filter((id) => c.id === "all" || metadata[id][0] === c.id).length}</span></button>`,
    )
    .join("");
  $("modules").innerHTML = Object.entries(MODULES)
    .map(
      ([id, m]) =>
        `<button data-module="${id}" aria-pressed="false" style="--color:${metadata[id][1]};--tint:${metadata[id][2]}"><span class="nav-icon" aria-hidden="true">${m.icon}</span><span><strong>${m.title}</strong><small>${metadata[id][3]}</small></span></button>`,
    )
    .join("");
  function filterLibrary() {
    const query = $("module-search").value.trim().toLowerCase();
    let count = 0;
    document.querySelectorAll("[data-module]").forEach((button) => {
      const id = button.dataset.module,
        m = MODULES[id];
      button.hidden =
        !(category === "all" || metadata[id][0] === category) ||
        !`${id} ${m.title} ${m.name} ${m.tag} ${metadata[id][3]} ${aliases[id]}`
          .toLowerCase()
          .includes(query);
      if (!button.hidden) count++;
    });
    $("library-count").textContent = `${count} 个交互实验`;
    $("empty-search").hidden = count > 0;
  }
  $("categories").addEventListener("click", (e) => {
    const button = e.target.closest("[data-category]");
    if (!button) return;
    category = button.dataset.category;
    document.querySelectorAll("[data-category]").forEach((b) => {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
    $("library-title").textContent = categories.find(
      (c) => c.id === category,
    ).name;
    filterLibrary();
  });
  $("module-search").addEventListener("input", filterLibrary);
  filterLibrary();
  $("modules").addEventListener("click", (e) => {
    const button = e.target.closest("[data-module]");
    if (button) selectModule(button.dataset.module);
  });
  function stop() {
    clearInterval(timer);
    timer = null;
    $("play").textContent = "▶ 播放演示";
  }
  function refreshModel() {
    stop();
    position = 0;
    model = buildModel(selected, params);
    [
      "resultLabel",
      "result",
      "detail",
      "explanation",
      "takeaway",
      "code",
      "time",
    ].forEach((key, i) => {
      $(
        [
          "result-label",
          "result-value",
          "result-detail",
          "explanation",
          "takeaway",
          "code",
          "time-note",
        ][i],
      ).textContent = model[key];
    });
    render();
  }
  function selectModule(id) {
    selected = id;
    const m = MODULES[id];
    params = Object.fromEntries(m.controls.map((c) => [c.key, c.value]));
    document.querySelectorAll("[data-module]").forEach((b) => {
      b.classList.toggle("active", b.dataset.module === id);
      b.setAttribute("aria-pressed", String(b.dataset.module === id));
    });
    $("module-title").textContent = m.title + " " + m.name;
    $("module-tag").textContent = m.tag;
    $("module-description").textContent = m.description;
    $("module-number").textContent = String(
      Object.keys(MODULES).indexOf(id) + 1,
    ).padStart(2, "0");
    $("controls").innerHTML = m.controls
      .map(
        (c) =>
          `<div><label class="control-label" for="param-${c.key}">${c.label}${c.type === "range" ? `<output id="output-${c.key}">${c.value}${c.unit || ""}</output>` : ""}</label>${c.options ? `<select id="param-${c.key}" data-key="${c.key}">${c.options.map(([value, label]) => `<option value="${value}" ${String(c.value) === value ? "selected" : ""}>${label}</option>`).join("")}</select>` : `<input id="param-${c.key}" data-key="${c.key}" type="${c.type}" min="${c.min}" max="${c.max}" step="${c.step || 1}" value="${c.value}">`}${c.help ? `<p class="control-help">${c.help}</p>` : ""}</div>`,
      )
      .join("");
    refreshModel();
  }
  $("controls").addEventListener("input", (e) => {
    const key = e.target.dataset.key;
    if (!key) return;
    const config = MODULES[selected].controls.find((c) => c.key === key);
    if (config.type === "number" || config.type === "range") {
      if (e.target.value === "" || !e.target.validity.valid) {
        e.target.setAttribute("aria-invalid", "true");
        return;
      }
      params[key] = Number(e.target.value);
      e.target.removeAttribute("aria-invalid");
    } else params[key] = e.target.value;
    if ($("output-" + key))
      $("output-" + key).textContent = params[key] + (config.unit || "");
    refreshModel();
  });
  $("controls").addEventListener("change", (e) => {
    const key = e.target.dataset.key;
    if (
      key &&
      e.target.type === "number" &&
      (e.target.value === "" || !e.target.validity.valid)
    ) {
      e.target.value = params[key];
      e.target.removeAttribute("aria-invalid");
    }
  });
  function advance() {
    if (position < model.frames.length - 1) {
      position++;
      render();
    }
    if (position === model.frames.length - 1) stop();
  }
  $("step").addEventListener("click", () => {
    stop();
    advance();
  });
  $("reset").addEventListener("click", () => {
    stop();
    position = 0;
    render();
  });
  $("previous").addEventListener("click", () => {
    stop();
    position = Math.max(0, position - 1);
    render();
  });
  $("timeline").addEventListener("input", (e) => {
    stop();
    position = Math.min(
      model.frames.length - 1,
      Math.max(0, Number(e.target.value)),
    );
    render();
  });
  function play() {
    if (timer) {
      stop();
      return;
    }
    if (position === model.frames.length - 1) {
      position = 0;
      render();
    }
    $("play").textContent = "Ⅱ 暂停";
    timer = setInterval(advance, +$("speed").value);
  }
  $("play").addEventListener("click", play);
  $("speed").addEventListener("change", () => {
    if (timer) {
      stop();
      play();
    }
  });
  function renderWave() {
    const { frames, channels } = model,
      w = 750,
      left = 47,
      right = 12,
      dx = (w - left - right) / frames.length,
      height = channels.length * 49 + 32;
    let svg = `<svg viewBox="0 0 ${w} ${height}" role="img" aria-label="${escapeHTML(MODULES[selected].title)} 教学波形，竖线表示当前步骤"><defs><pattern id="grid" width="${dx}" height="49" patternUnits="userSpaceOnUse" x="${left}"><path d="M0 0V${height}" stroke="#e2ebe8" stroke-dasharray="2 3"/></pattern></defs><rect x="${left}" width="${w - left - right}" height="${height - 22}" fill="url(#grid)"/>`;
    channels.forEach((channel, row) => {
      const high = 12 + row * 49,
        low = high + 24;
      svg += `<text x="3" y="${high + 16}" font-size="10" fill="#7d8b9b">${channel}</text>`;
      frames.forEach((frame, i) => {
        const value = frame.values[row],
          previous = frames[Math.max(0, i - 1)].values[row],
          y = value === null ? high + 12 : value ? high : low;
        const prevY = previous === null ? high + 12 : previous ? high : low;
        svg += `<path d="M${left + i * dx} ${i ? prevY : y}V${y}H${left + (i + 1) * dx}" fill="none" stroke="${value === null ? "#c49b50" : "#15977f"}" stroke-width="2" ${value === null ? 'stroke-dasharray="4 3"' : ""}/>`;
        if (frame.sample && row === 0)
          svg += `<circle cx="${left + i * dx}" cy="${y}" r="3.2" fill="#e4a841"/>`;
      });
    });
    const labels =
      frames.length <= 20
        ? frames.map((_, i) => i)
        : [0, 1, 18, 19, frames.length - 1];
    labels.forEach((i) => {
      svg += `<text x="${left + (i + 0.5) * dx}" y="${height - 5}" text-anchor="middle" font-size="8" fill="#8a98a4">${escapeHTML(frames[i].label)}</text>`;
    });
    svg += `<rect x="${left + position * dx}" y="4" width="${dx}" height="${height - 26}" fill="#15977f" opacity=".08"/><path d="M${left + (position + 0.5) * dx} 2V${height - 22}" stroke="#de9b3a" stroke-width="1.5" stroke-dasharray="4 3"/></svg>`;
    $("waveform").innerHTML = svg;
  }
  function render() {
    $("step-count").textContent =
      `${String(position + 1).padStart(2, "0")} / ${String(model.frames.length).padStart(2, "0")}`;
    $("step-text").textContent = model.frames[position].text;
    $("step").disabled = position === model.frames.length - 1;
    $("previous").disabled = position === 0;
    $("timeline").max = model.frames.length - 1;
    $("timeline").value = position;
    $("timeline").setAttribute(
      "aria-valuetext",
      `第 ${position + 1} 步：${model.frames[position].text}`,
    );
    $("timeline-value").textContent = `${position + 1}/${model.frames.length}`;
    renderWave();
    renderDiagram();
  }
  function renderDiagram() {
    const scene = EmbeddedScenes.render(selected, params, model, position);
    $("diagram").innerHTML = scene.svg;
    $("scene-readout").innerHTML = scene.readout;
    $("scene-name").textContent = scene.name;
    $("scene-phase").textContent = model.frames[position].label;
    $("experiment-hint").textContent = scene.hint;
    if (scene.result !== undefined)
      $("result-value").textContent = scene.result;
  }
  selectModule("gpio");
}
