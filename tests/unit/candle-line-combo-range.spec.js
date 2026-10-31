import { describe, it, expect } from 'vitest'
import { createChartWithOptions } from './utils/utils.js'

// A line series on a candlestick chart (broken since 8.1.0, #5407) was
// written into the OHLC arrays as null. Range then did Math.min(lowest, null),
// which is 0, so the y-axis started at zero and squashed the candles.

const T0 = Date.UTC(2026, 0, 1)
const DAY = 864e5

function chartOf(series) {
  return createChartWithOptions({
    chart: {
      type: 'candlestick',
      width: 600,
      height: 400,
      animations: { enabled: false },
    },
    series,
    xaxis: { type: 'datetime' },
  })
}

describe('candlestick chart with a line series keeps its y range', () => {
  it('does not pin minY at 0', () => {
    const candles = [
      [6629.81, 6650.5, 6623.04, 6633.33],
      [6632.01, 6643.59, 6620, 6630.11],
      [6630.71, 6648.95, 6623.34, 6635.65],
    ].map((y, j) => ({ x: T0 + j * DAY, y }))
    const line = [6633.33, 6631.72, 6633.03].map((y, j) => ({
      x: T0 + j * DAY,
      y,
    }))

    const chart = chartOf([
      { name: 'Price', data: candles },
      { name: 'MA', type: 'line', data: line },
    ])
    const w = chart.w

    expect(w.globals.minY).toBeGreaterThan(0)
    // the scale still reaches the candle low, rather than a domain from 0
    expect(w.globals.minY).toBeLessThanOrEqual(6620)
    expect(w.globals.maxY).toBeGreaterThanOrEqual(6650.5)
    // the line is not an OHLC series, so it does not occupy a candle slot
    expect(w.candleData.seriesCandleL[1]).toBeUndefined()
    expect(w.candleData.seriesCandleL[0]).toEqual([6623.04, 6620, 6623.34])
    chart.destroy()
  })

  it('a leading null on the line and a gap in the candles stay in range', () => {
    const candles = [
      { x: T0, y: [10, 12, 9, 11] },
      { x: T0 + DAY, y: null },
      { x: T0 + 2 * DAY, y: [20, 22, 19, 21] },
      { x: T0 + 3 * DAY, y: [30, 32, 29, 31] },
    ]
    // moving average: null until the window fills, all values above 0
    const line = [null, null, 15, 24].map((y, j) => ({ x: T0 + j * DAY, y }))

    const chart = chartOf([
      { name: 'MA', type: 'line', data: line },
      { name: 'Price', type: 'candlestick', data: candles },
    ])
    const w = chart.w

    expect(w.globals.minY).toBeGreaterThan(0)
    expect(w.globals.maxY).toBeGreaterThanOrEqual(32)
    // the gap keeps its slot, so the candle after it is still its own low
    expect(w.candleData.seriesCandleL[1][2]).toBe(19)
    expect(w.candleData.seriesCandleO[1].length).toBe(candles.length)
    expect(w.candleData.seriesCandleL[0]).toBeUndefined()
    chart.destroy()
  })
})
