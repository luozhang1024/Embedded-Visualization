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
  for (const file of ["scenes.js", "app.js"])
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
