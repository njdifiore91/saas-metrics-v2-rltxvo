import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { devices } from '@playwright/test';

// Test suite for data visualization features
test.describe('Data Visualization Tests', () => {
  let axe: AxeBuilder;

  test.beforeEach(async ({ page }) => {
    // Navigate to benchmark comparison page
    await page.goto('/benchmarks');
    
    // Wait for page to load completely
    await page.waitForSelector('[aria-label="Benchmark Comparison Tool"]');
    
    // Initialize accessibility testing
    axe = new AxeBuilder({ page });
  });

  test('chart renders correctly with data and meets accessibility standards', async ({ page }) => {
    // Input test metric data
    await page.fill('[aria-label="Company metric value"]', '1200000');
    await page.selectOption('select[aria-label="Select Metric"]', 'ARR');
    await page.selectOption('select[aria-label="Revenue Range"]', '$1M-$5M');
    await page.click('button:text("Compare Metrics")');

    // Verify chart container exists and is accessible
    const chartContainer = await page.waitForSelector('.benchmark-chart-container');
    expect(await chartContainer.getAttribute('role')).toBe('figure');
    expect(await chartContainer.getAttribute('aria-label')).toContain('Benchmark chart for');

    // Check SVG elements are present and properly labeled
    const svg = await page.waitForSelector('svg[role="img"]');
    expect(await svg.getAttribute('aria-label')).toContain('Interactive benchmark visualization');
    
    // Validate axis labels and scales
    const xAxis = await page.waitForSelector('.x-axis');
    expect(await xAxis.getAttribute('role')).toBe('graphics-document');
    expect(await xAxis.getAttribute('aria-label')).toBe('X axis');

    // Verify percentile markers are displayed and accessible
    const markers = await page.$$('.benchmark-ranges rect');
    expect(markers.length).toBe(3); // P25-P50, P50-P75, P75-P90 ranges

    // Run accessibility audit on chart elements
    const results = await axe.analyze();
    expect(results.violations.length).toBe(0);
  });

  test('chart interactions work correctly', async ({ page }) => {
    // Set up test data
    await page.fill('[aria-label="Company metric value"]', '1200000');
    await page.selectOption('select[aria-label="Select Metric"]', 'ARR');
    await page.selectOption('select[aria-label="Revenue Range"]', '$1M-$5M');
    await page.click('button:text("Compare Metrics")');

    // Test mouse hover interactions
    const companyMarker = await page.waitForSelector('.company-marker');
    await companyMarker.hover();
    const tooltip = await page.waitForSelector('.benchmark-tooltip');
    expect(await tooltip.isVisible()).toBe(true);

    // Test keyboard navigation
    await svg.focus();
    await page.keyboard.press('ArrowRight');
    const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    expect(focusedElement).toContain('percentile marker');

    // Verify touch interactions on mobile
    await page.setViewportSize(devices['iPhone 12'].viewport);
    await companyMarker.tap();
    expect(await tooltip.isVisible()).toBe(true);
  });

  test('data accuracy is maintained', async ({ page }) => {
    // Generate test data with known values
    const testValue = 1200000;
    await page.fill('[aria-label="Company metric value"]', testValue.toString());
    await page.selectOption('select[aria-label="Select Metric"]', 'ARR');
    await page.selectOption('select[aria-label="Revenue Range"]', '$1M-$5M');
    await page.click('button:text("Compare Metrics")');

    // Verify percentile calculation accuracy
    const percentileText = await page.textContent('[aria-label*="Percentile"]');
    expect(percentileText).toMatch(/\d+th percentile/);

    // Check metric value display formatting
    const valueDisplay = await page.textContent('[aria-label*="Your value"]');
    expect(valueDisplay).toContain(testValue.toLocaleString());

    // Validate comparison calculations
    const benchmarkRanges = await page.$$eval('.benchmark-ranges rect', 
      elements => elements.map(el => ({
        width: el.getAttribute('width'),
        x: el.getAttribute('x')
      }))
    );
    expect(benchmarkRanges.length).toBe(3);
    expect(benchmarkRanges.every(range => range.width && range.x)).toBe(true);
  });

  test('responsive behavior adapts to screen sizes', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    let chartWidth = await page.$eval('.benchmark-chart-container', 
      el => el.getBoundingClientRect().width
    );
    expect(chartWidth).toBeGreaterThan(800);

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    chartWidth = await page.$eval('.benchmark-chart-container', 
      el => el.getBoundingClientRect().width
    );
    expect(chartWidth).toBeLessThan(800);

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    chartWidth = await page.$eval('.benchmark-chart-container', 
      el => el.getBoundingClientRect().width
    );
    expect(chartWidth).toBeLessThan(375);

    // Verify touch targets on mobile
    const touchTargets = await page.$$eval('[role="graphics-symbol"]', 
      elements => elements.map(el => {
        const rect = el.getBoundingClientRect();
        return rect.width * rect.height;
      })
    );
    expect(touchTargets.every(area => area >= 44 * 44)).toBe(true);
  });

  test('accessibility compliance meets WCAG 2.1 AA standards', async ({ page }) => {
    // Run automated accessibility audit
    const results = await axe.analyze();
    expect(results.violations.length).toBe(0);

    // Check color contrast ratios
    const contrastViolations = results.violations.filter(
      v => v.id === 'color-contrast'
    );
    expect(contrastViolations.length).toBe(0);

    // Verify screen reader compatibility
    const ariaLabels = await page.$$eval('[aria-label]', 
      elements => elements.map(el => el.getAttribute('aria-label'))
    );
    expect(ariaLabels.every(label => label && label.length > 0)).toBe(true);

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).not.toBe('BODY');

    // Validate ARIA attributes
    const ariaRoles = await page.$$eval('[role]', 
      elements => elements.map(el => el.getAttribute('role'))
    );
    expect(ariaRoles).toContain('figure');
    expect(ariaRoles).toContain('graphics-document');
    expect(ariaRoles).toContain('graphics-symbol');
  });
});