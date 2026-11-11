"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");

function setup(t) {
  const dom = new JSDOM(
    fs.readFileSync(path.join(root, "index.html"), "utf8"),
    { runScripts: "outside-only", url: "http://localhost/" },
  );
  let interval;
  dom.window.setInterval = (fn) => {
    interval = fn;
    return 1;
  };
  dom.window.clearInterval = () => {
    interval = undefined;
  };
  for (const file of ["nrf.js", "spi-story.js", "scenes.js", "app.js"])
    vm.runInContext(
      fs.readFileSync(path.join(root, file), "utf8"),
      dom.getInternalVMContext(),
      { filename: file },
    );
  t.after(() => dom.window.close());
  const $ = (id) => dom.window.document.getElementById(id);
  const click = (selector) =>
    dom.window.document.querySelector(selector).click();
  const input = (id, value, type = "input") => {
    $(id).value = value;
    $(id).dispatchEvent(new dom.window.Event(type, { bubbles: true }));
  };
  return {
    dom,
    $,
    click,
    input,
    tick: () => {
      if (interval) interval();
    },
    playing: () => !!interval,
  };
}
test("classification and search combine without losing current experiment", (t) => {
  const { dom, $, click, input } = setup(t);
  const visible = () =>
    [...dom.window.document.querySelectorAll("[data-module]")]
      .filter((b) => !b.hidden)
      .map((b) => b.dataset.module);
  assert.equal(visible().length, 6);
  click('[data-category="bus"]');
  assert.deepEqual(visible(), ["usart", "i2c", "spi"]);
  input("module-search", "采集");
  assert.equal(visible().length, 0);
  assert.equal($("empty-search").hidden, false);
  assert.match($("module-title").textContent, /GPIO/);
  input("module-search", "");
  click('[data-category="all"]');
  assert.equal(visible().length, 6);
  input("module-search", "gpio");
  assert.deepEqual(visible(), ["gpio"]);
  input("module-search", "串口");
  assert.deepEqual(visible(), ["usart"]);
  input("module-search", "IIC");
  assert.deepEqual(visible(), ["i2c"]);
});
test("all experiments render every frame and support forward, backward and seeking", (t) => {
  const { $, click, input } = setup(t);
  for (const id of ["gpio", "usart", "i2c", "spi", "adc", "dma"]) {
    click(`[data-module="${id}"]`);
    assert.equal($("previous").disabled, true);
    const end = Number($("timeline").max);
    for (let i = 0; i <= end; i++) {
      input("timeline", i);
      assert.equal($("timeline-value").textContent, `${i + 1}/${end + 1}`);
      assert($("diagram").querySelector('svg[role="img"]'));
      assert(
        !/undefined|NaN/.test(
          $("diagram").innerHTML + $("scene-readout").innerHTML,
        ),
      );
    }
    assert.equal($("step").disabled, true);
    click("#previous");
    assert.equal(Number($("timeline").value), end - 1);
    click("#reset");
    assert.equal(Number($("timeline").value), 0);
    click("#step");
    assert.equal(Number($("timeline").value), 1);
  }
});
test("playback pauses on seek and config change, finishes, and replays", (t) => {
  const { $, click, input, tick, playing } = setup(t);
  click("#play");
  assert(playing());
  tick();
  assert.equal($("timeline").value, "1");
  input("timeline", 3);
  assert(!playing());
  click("#play");
  input("param-mode", "od");
  assert(!playing());
  assert.equal($("timeline").value, "0");
  input("param-pull", "no");
  input("timeline", 1);
  assert.equal($("result-value").textContent, "Z · 悬空");
  click("#play");
  for (let i = 0; i < 10; i++) tick();
  assert(!playing());
  assert($("step").disabled);
  click("#play");
  assert(playing());
  assert.equal($("timeline").value, "0");
  click('[data-module="dma"]');
  assert(!playing());
});
test("NACK omits I2C data and DMA fixed-address transfers overwrite only slot zero", (t) => {
  const { $, click, input } = setup(t);
  click('[data-module="i2c"]');
  input("param-ack", "no");
  assert.equal($("timeline").max, "22");
  input("timeline", 22);
  assert.equal($("scene-phase").textContent, "STOP");
  assert.equal($("result-value").textContent, "NACK");
  click('[data-module="dma"]');
  input("param-increment", "no");
  input("timeline", $("timeline").max);
  assert.equal($("result-value").textContent, "0");
  assert.match($("diagram").textContent, /0x33/);
  assert.doesNotMatch($("diagram").textContent, /0x30|0x31|0x32/);
});
test("invalid numeric input is restored while ADC full scale stays finite", (t) => {
  const { $, click, input } = setup(t);
  click('[data-module="usart"]');
  input("param-byte", "999");
  assert.equal($("param-byte").getAttribute("aria-invalid"), "true");
  input("param-byte", "999", "change");
  assert.equal($("param-byte").value, "65");
  input("param-byte", "");
  input("param-byte", "", "change");
  assert.equal($("param-byte").value, "65");
  click('[data-module="adc"]');
  input("param-voltage", "3.3");
  input("timeline", $("timeline").max);
  assert.equal($("result-value").textContent, "4095 / 4095");
  assert.match($("scene-readout").textContent, /4095/);
});

test("nRF transaction stages, dummy comparison, NOP and generic SPI stay in sync", (t) => {
  const { $, click, input } = setup(t);
  click('[data-module="spi"]');
  assert.match($("diagram").textContent, /STM32/);
  assert.match($("diagram").textContent, /nRF24L01/);
  assert.equal($("param-mode").closest("[data-control-scope]").hidden, true);
  click('[data-seek="16"]');
  assert.equal($("timeline").value, "16");
  assert.equal($("result-value").textContent, "等待交换");
  assert.match($("scene-readout").textContent, /MISO ← 0x2E/);
  input("param-operation", "config");
  input("timeline", $("timeline").max);
  assert.equal($("result-value").textContent, "0x0B");
  input("param-dummy", "0");
  input("timeline", $("timeline").max);
  assert.equal($("result-value").textContent, "0x0B");
  input("param-operation", "nop");
  assert.equal($("param-dummy").closest("[data-control-scope]").hidden, true);
  assert.equal($("timeline").max, "18");
  input("timeline", 18);
  assert.equal($("result-value").textContent, "0x2E");
  input("param-device", "generic");
  assert.equal($("param-mode").closest("[data-control-scope]").hidden, false);
  assert.equal($("param-status").closest("[data-control-scope]").hidden, true);
  input("param-mode", "3");
  assert.match($("diagram").textContent, /Mode 3/);
  input("param-device", "nrf");
  assert.match($("time-note").textContent, /Mode 0/);
  input("param-operation", "status");
  assert.equal($("param-dummy").closest("[data-control-scope]").hidden, false);
});

test("story chapters stop on byte boundaries and one clock fills both receive queues", (t) => {
  const { $, click, tick, playing } = setup(t);
  click('[data-module="spi"]');
  assert.equal($("spi-learning").hidden, false);
  assert.equal($("signal-details").hidden, true);
  assert.equal($("view-story").getAttribute("aria-pressed"), "true");
  assert.equal($("story-pulse").disabled, true);
  click("#story-next");
  tick();
  assert.equal($("timeline").value, "1");
  assert(!playing());
  assert.equal($("story-next").disabled, false);
  click("#story-pulse");
  assert.equal($("timeline").value, "2");
  assert.equal(
    $("story-stage").querySelectorAll(".queue-bit.arrived").length,
    2,
  );
  click("#story-next");
  for (let i = 0; i < 30; i++) tick();
  assert(!playing());
  assert.equal($("timeline").value, "16");
  assert.equal($("story-next").disabled, false);
  assert.match($("story-stage").textContent, /第一轮完成/);
  assert.equal(
    $("story-stage").querySelectorAll(".queue-bit.arrived").length,
    16,
  );
  click("#story-next");
  tick();
  click("#story-pause");
  const paused = $("timeline").value;
  for (let i = 0; i < 10; i++) tick();
  assert.equal($("timeline").value, paused);
  assert.match($("story-clock").textContent, /时钟已暂停/);
  click("#story-next");
  for (let i = 0; i < 40; i++) tick();
  assert.equal($("timeline").value, "32");
  assert(!playing());
  assert.equal($("story-pulse").disabled, true);
  assert.match($("story-stage").textContent, /尚未返回/);
  click("#story-next");
  for (let i = 0; i < 5; i++) tick();
  assert.equal($("timeline").value, "34");
  assert.equal($("result-value").textContent, "0x2E");
  assert.equal($("story-next").disabled, true);
});

test("story speed change keeps its stop point, detail view keeps position and NOP skips data", (t) => {
  const { $, click, input, tick } = setup(t);
  click('[data-module="spi"]');
  click('[data-story-seek="1"]');
  click("#story-next");
  tick();
  input("story-speed", "200", "change");
  assert.equal($("speed").value, "200");
  for (let i = 0; i < 30; i++) tick();
  assert.equal($("timeline").value, "16");
  click("#story-details");
  assert.equal($("signal-details").hidden, false);
  assert.equal($("story-details").getAttribute("aria-expanded"), "true");
  click("#view-signals");
  assert.equal($("story-stage").hidden, true);
  assert.equal($("timeline").value, "16");
  click("#view-story");
  assert.equal($("timeline").value, "16");
  click("#story-compare");
  assert.equal($("param-operation").value, "config");
  assert.equal($("timeline").value, "0");
  click('[data-story-seek="34"]');
  assert.equal($("result-value").textContent, "0x0B");
  input("param-operation", "nop");
  assert.equal(
    $("story-stage").querySelectorAll("[data-story-seek]").length,
    4,
  );
  assert(!$("story-stage").querySelector('[data-story-seek="32"]'));
  click('[data-story-seek="16"]');
  click("#story-next");
  for (let i = 0; i < 10; i++) tick();
  assert.equal($("timeline").value, "18");
  click('[data-module="gpio"]');
  assert.equal($("spi-learning").hidden, true);
  assert.equal($("signal-details").hidden, false);
});
