#!/usr/bin/env node
/**
 * P0 spike 运行器：跑三个探针页并汇总结论（结论回填 docs/mc-grid-contract.md）。
 *
 * 前置：pnpm dev 已在跑（默认 8642），并且 node modules 里有 playwright-core + 系统 Chrome。
 * 用法：
 *   node mosaic-admin/tools/spike.mjs                跑全部
 *   node mosaic-admin/tools/spike.mjs cell-channel   只跑一个
 *   BASE_URL=http://127.0.0.1:8642 CHANNEL=chrome 覆盖环境
 *
 * 退出码：全部通过 0；任一 spike 超时 / 有报错 / 有断言失败 1。
 */
import { chromium } from 'playwright-core';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:8642').replace(/\/$/, '');
const CHANNEL = process.env.CHANNEL ?? 'chrome';
const SPIKE_BASE = BASE + '/mosaic-admin/spikes/';

/** 每个 spike 页把结果写到 window.__spike = { done, checks, metrics, errors } */
const SPIKES = [
  { slug: 'cell-channel', title: 'A · columns[].cell 函数通道' },
  { slug: 'table-500', title: 'B · 500 行 sticky 表格' },
  { slug: 'tab-state', title: 'C · 标签页状态保持' },
];

const filters = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const targets = filters.length ? SPIKES.filter((spike) => filters.includes(spike.slug)) : SPIKES;

if (!targets.length) {
  console.error('没有匹配的 spike：' + filters.join(', '));
  process.exit(1);
}

const args = process.env.BROWSER_NO_PROXY === '1' ? ['--no-proxy-server'] : [];
const browser = await chromium.launch({ channel: CHANNEL, args });
const summary = [];

for (const spike of targets) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const problems = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('favicon')) return;
    problems.push('console: ' + text.slice(0, 300));
  });
  page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
  page.on('response', (response) => {
    if (response.status() < 400) return;
    if (response.url().includes('favicon')) return;
    problems.push('HTTP ' + response.status() + ' ' + response.url());
  });

  console.log('\n== ' + spike.title + ' ==');
  console.log('   ' + SPIKE_BASE + spike.slug + '/index.html');

  let result = null;
  try {
    await page.goto(SPIKE_BASE + spike.slug + '/index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__spike && window.__spike.done === true, null, {
      timeout: 45_000,
    });
    result = await page.evaluate(() => window.__spike);
  } catch (error) {
    problems.push('spike 没跑完：' + String(error.message).split('\n')[0]);
  }

  const checks = result?.checks ?? [];
  const metrics = result?.metrics ?? {};
  const spikeErrors = result?.errors ?? [];
  const failed = checks.filter((check) => !check.ok);

  for (const check of checks) {
    console.log(
      '   ' +
        (check.ok ? '✓' : '✗') +
        ' ' +
        check.name +
        (check.detail ? '（' + check.detail + '）' : ''),
    );
  }
  if (Object.keys(metrics).length) {
    console.log('   metrics: ' + JSON.stringify(metrics));
  }
  for (const error of spikeErrors) console.log('   ✗ 运行时错误：' + error.split('\n')[0]);
  for (const problem of problems) console.log('   ✗ ' + problem);

  const ok =
    checks.length > 0 && failed.length === 0 && spikeErrors.length === 0 && problems.length === 0;
  summary.push({
    title: spike.title,
    ok,
    passed: checks.length - failed.length,
    total: checks.length,
  });
  console.log('   → ' + (ok ? '通过' : '失败'));
  await page.close();
}

await browser.close();

console.log('\n== 汇总 ==');
for (const item of summary) {
  console.log(
    (item.ok ? '  ✓ ' : '  ✗ ') + item.title + '：' + item.passed + '/' + item.total + ' 条断言',
  );
}

process.exitCode = summary.every((item) => item.ok) ? 0 : 1;
