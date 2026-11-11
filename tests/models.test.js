'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildModel, MODULES } = require('../app.js');

test('all models have consistent channel and frame counts', () => {
  for (const [id, config] of Object.entries(MODULES)) {
    const params = Object.fromEntries(config.controls.map(c => [c.key, c.value]));
    const model = buildModel(id, params);
    assert(model.frames.length > 1);
    for (const frame of model.frames) assert.equal(frame.values.length, model.channels.length);
  }
});
test('open-drain high requires a pull-up', () => {
  assert.equal(buildModel('gpio', { mode: 'od', pull: 'no' }).frames[1].values[0], null);
  assert.equal(buildModel('gpio', { mode: 'od', pull: 'yes' }).frames[1].values[0], 1);
});
test('UART sends 8N1 with LSB first and computes frame duration', () => {
  const m = buildModel('usart', { byte: 65, baud: 9600 });
  assert.deepEqual(m.frames.slice(1, 11).map(f => f.values[0]), [0, 1, 0, 0, 0, 0, 0, 1, 0, 1]);
  assert.equal(m.result, '1.042 ms');
});
test('all SPI modes sample the same byte on the configured clock edge', () => {
  for (let mode = 0; mode < 4; mode++) {
    const m = buildModel('spi', { mode, byte: 165 });
    assert.equal(m.frames[0].values[0], mode >> 1);
    assert.deepEqual(m.frames.filter(f => f.sample).map(f => f.values[1]), [1, 0, 1, 0, 0, 1, 0, 1]);
    for (let i = 1; i < m.frames.length; i++) {
      if (m.frames[i].sample) {
        assert.notEqual(m.frames[i-1].values[0], m.frames[i].values[0]);
        assert.equal(m.frames[i].values[0], (mode & 1) ? mode >> 1 : 1 - (mode >> 1));
      }
    }
  }
});
test('I2C sends shifted address and stops after address NACK', () => {
  for (const ack of ['yes', 'no']) {
    const m = buildModel('i2c', { address: 80, byte: 165, ack });
    const rises = m.frames.filter((f, i) => i && f.values[0] === 1 && m.frames[i-1].values[0] === 0);
    assert.equal(rises.length, ack === 'yes' ? 19 : 10); // Includes SCL release before STOP.
    assert.deepEqual(m.frames.slice(2,18).filter((_,i) => i%2 === 1).map(f => f.values[1]), [1,0,1,0,0,0,0,0]);
    assert.equal(m.frames.length, ack === 'yes' ? 41 : 23);
    assert.deepEqual(m.frames.at(-1).values, [1,1]);
    assert.equal(m.frames[19].values[1], ack === 'yes' ? 0 : 1);
    // Data stays stable on rising clocks, including ACK; START and STOP are separate.
    for (let i = 2; i < m.frames.length-2; i++) {
      if (m.frames[i-1].values[0] === 0 && m.frames[i].values[0] === 1) {
        assert.equal(m.frames[i-1].values[1], m.frames[i].values[1]);
      }
    }
  }
});
test('ADC quantization handles zero, midpoint and full scale at all resolutions', () => {
  for (const bits of [8,10,12]) {
    for (const voltage of [0,1.65,3.3]) {
      const m = buildModel('adc', { bits, voltage });
      assert.equal(Number(m.result.split(' / ')[0]), voltage === 0 ? 0 : voltage === 3.3 ? 2**bits-1 : 2**(bits-1));
    }
  }
});
test('DMA decrements count once per transfer and raises completion only at end', () => {
  for (const count of [4,8]) {
    const m = buildModel('dma', { count, increment: 'no' });
    assert.equal(m.frames.at(-1).transferred, count);
    assert(m.frames.filter((_,i) => i > 0 && i%2 === 0).every(f => f.text.includes('buffer[0]')));
    assert.equal(m.frames.filter(f => f.values[1]).length, 1);
  }
});
