import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
} from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  MarkLineComponent,
  RadarComponent,
  DatasetComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  MarkLineComponent,
  RadarComponent,
  DatasetComponent,
  SVGRenderer,
]);

export const chartTheme = {
  background: 'transparent',
  textColor: '#3a342a',
  textMuted: '#6b614f',
  grid: '#d6cdb6',
  palette: ['#5b3aa3', '#8b2c4d', '#7a55cc', '#b8721c', '#2d5a3f', '#8b4a2c'],
  accent: '#5b3aa3',
  burgundy: '#8b2c4d',
  amber: '#b8721c',
  forest: '#2d5a3f',
};

export const fontFamily = '"Inter Tight", sans-serif';
export const monoFamily = '"JetBrains Mono", monospace';

export const baseOption = {
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily,
    color: chartTheme.textColor,
  },
  tooltip: {
    backgroundColor: '#faf6ed',
    borderColor: '#d6cdb6',
    borderWidth: 1,
    textStyle: {
      color: '#0f0d0a',
      fontFamily,
      fontSize: 12,
    },
    extraCssText: 'box-shadow: 0 10px 30px -10px rgba(26, 24, 20, 0.2); border-radius: 8px;',
  },
  grid: {
    left: 40,
    right: 20,
    top: 20,
    bottom: 30,
    containLabel: true,
  },
};

export function axisStyle() {
  return {
    axisLine: { lineStyle: { color: chartTheme.grid } },
    axisLabel: {
      color: chartTheme.textMuted,
      fontFamily: monoFamily,
      fontSize: 10,
    },
    axisTick: { lineStyle: { color: chartTheme.grid } },
    splitLine: { lineStyle: { color: chartTheme.grid, opacity: 0.4, type: 'dashed' } },
  };
}

export function mountChart(el: HTMLElement, option: EChartsOption) {
  const chart = echarts.init(el, null, { renderer: 'svg' });
  chart.setOption({ ...baseOption, ...option });

  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(el);

  return { chart, destroy: () => { ro.disconnect(); chart.dispose(); } };
}

/**
 * Mounts a chart only when the element scrolls into view.
 * Keeps widgets off the critical render path and out of TBT.
 */
export function lazyMountChart(el: HTMLElement, optionFactory: () => EChartsOption) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          io.disconnect();
          mountChart(el, optionFactory());
          return;
        }
      }
    },
    { rootMargin: '150px' }
  );
  io.observe(el);
}
