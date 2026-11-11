"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildModel } = require("../app.js");
const NRF = require("../nrf.js");
const defaults = { device: "nrf", operation: "status", status: 46, dummy: 255 };
const bytes = (samples) =>
  Array.from({ length: samples.length / 8 }, (_, j) =>
    samples.slice(j * 8, j * 8 + 8).reduce((v, b) => (v << 1) | b, 0),
  );

test("nRF24L01 clocks both directions together, command first and data second", () => {
  for (const operation of ["status", "config", "nop"]) {
    for (const status of [14, 46, 78]) {
      const m = buildModel("spi", { ...defaults, operation, status });
      const samples = m.frames.filter((f) => f.sample);
      assert.equal(samples.length, operation === "nop" ? 8 : 16);
      assert.deepEqual(
        bytes(samples.map((f) => f.values[1])),
        operation === "nop" ? [255] : [operation === "config" ? 0 : 7, 255],
      );
      assert.deepEqual(
        bytes(samples.map((f) => f.values[2])),
        operation === "nop"
          ? [status]
          : [status, operation === "config" ? 11 : status],
      );
      assert.deepEqual(m.channels, ["SCK", "MOSI", "MISO", "CSN"]);
      assert.equal(m.frames[0].values[2], null);
      assert.equal(m.frames.at(-1).values[2], null);
      assert(m.frames.slice(1, -1).every((f) => f.values[3] === 0));
      for (let i = 1; i < m.frames.length; i++) {
        if (m.frames[i].sample) {
          assert.equal(m.frames[i - 1].values[0], 0);
          assert.equal(m.frames[i].values[0], 1);
          assert.deepEqual(
            m.frames[i - 1].values.slice(1, 3),
            m.frames[i].values.slice(1, 3),
          );
        }
      }
      assert.equal(m.frames.at(-1).completed, samples.length);
    }
  }
});

test("dummy byte changes MOSI but cannot change target register or command STATUS", () => {
  for (const operation of ["status", "config"]) {
    const a = buildModel("spi", { ...defaults, operation, dummy: 255 });
    const b = buildModel("spi", { ...defaults, operation, dummy: 0 });
    assert.deepEqual(a.transfer.rx, b.transfer.rx);
    assert.equal(a.transfer.tx[0], b.transfer.tx[0]);
    assert.equal(a.transfer.tx[1], 255);
    assert.equal(b.transfer.tx[1], 0);
  }
});

test("every nRF frame renders without missing data and exposes return only after all bits", () => {
  for (const operation of ["status", "config", "nop"]) {
    const p = { ...defaults, operation };
    const m = NRF.buildModel(p);
    for (let i = 0; i < m.frames.length; i++) {
      const scene = NRF.render(p, m, i);
      assert(!/NaN|undefined/.test(scene.svg + scene.readout));
      if (m.frames[i].completed < m.transfer.tx.length * 8)
        assert.equal(scene.result, "等待交换");
    }
    assert.equal(
      NRF.render(p, m, m.frames.length - 1).result,
      operation === "config" ? "0x0B" : "0x2E",
    );
    assert.equal(NRF.render(p, m, m.frames.length - 2).result, "待拉高 CSN");
  }
});
