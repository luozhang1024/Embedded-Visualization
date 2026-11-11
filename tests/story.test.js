"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const NRF = require("../nrf.js");
const Story = require("../spi-story.js");

test("story byte chapters land on the eighth sampling edge, not the following shift", () => {
  for (const operation of ["status", "config", "nop"]) {
    const m = NRF.buildModel({ operation, status: 46, dummy: 255 });
    const chapters = Story.chapters(m);
    for (const c of chapters.slice(2, -1)) {
      assert.equal(m.frames[c.at].sample, true);
      assert.equal(m.frames[c.at].completed % 8, 0);
    }
    assert.equal(chapters.at(-1).at, m.frames.length - 1);
    assert.equal(chapters.length, operation === "nop" ? 4 : 5);
  }
});
test("story renders all transactions and placeholder choices without inventing completed bytes", () => {
  for (const operation of ["status", "config", "nop"]) {
    for (const dummy of [0, 255]) {
      const m = NRF.buildModel({ operation, status: 46, dummy });
      for (let i = 0; i < m.frames.length; i++) {
        const html = Story.render(m, i);
        assert(!/undefined|NaN/.test(html));
        if (i < m.frames.length - 1) assert.match(html, /尚未返回/);
      }
      const completed = Story.render(m, m.frames.length - 1);
      assert(!completed.includes("尚未返回"));
      if (operation === "config") assert.match(completed, /0x0B/);
    }
  }
});
