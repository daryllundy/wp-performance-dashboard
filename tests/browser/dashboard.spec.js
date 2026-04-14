const { test, expect } = require('@playwright/test');

const chartStub = `
window.Chart = function Chart() {
  return {
    data: { labels: [], datasets: [{ data: [] }] },
    update() {},
    destroy() {}
  };
};
window.Chart.defaults = { font: {}, color: '#000' };
`;

test('dashboard renders and refreshes in a real browser', async ({ page }) => {
  const dashboardRequests = [];

  await page.route('https://cdn.jsdelivr.net/npm/chart.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: chartStub });
  });
  await page.route('https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });

  page.on('request', (request) => {
    if (request.url().includes('/api/dashboard')) {
      dashboardRequests.push(request.url());
    }
  });

  await page.goto('/');

  await expect(page.getByText('WordPress Performance Dashboard')).toBeVisible();
  await expect(page.locator('#environment-label')).toHaveText('Environment: Live');
  await expect(page.locator('#slow-query-count')).toContainText('2 queries');
  await expect(page.locator('#plugin-count')).toContainText('2 plugins');
  await expect(page.locator('#health-status')).toHaveText('healthy');
  await expect(page.locator('#slowQueries .query-item')).toHaveCount(2);
  await expect(page.locator('#pluginPerformance .plugin-item')).toHaveCount(2);
  await expect(page.locator('#last-updated')).toContainText('Updated');
  await expect(page.locator('.chart-shell')).toHaveCount(2);

  const initialDocumentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

  await page.getByRole('button', { name: 'Switch to Demo' }).click();
  await expect(page.locator('#environment-label')).toHaveText('Environment: Demo');

  await page.selectOption('#timeRange', '24h');
  await expect.poll(() => dashboardRequests.length).toBeGreaterThanOrEqual(3);

  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.locator('#live-region')).toContainText('Snapshot updated');

  const refreshedDocumentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(refreshedDocumentHeight).toBe(initialDocumentHeight);
});
