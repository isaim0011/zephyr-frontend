import axe from "axe-core";
import { expect } from "vitest";

/**
 * Runs axe-core (WCAG 2.1 A/AA rules) on a rendered container and fails with
 * a readable list of violations. Colour contrast is checked in the Playwright
 * test, where real CSS is applied.
 */
export async function expectNoA11yViolations(container: Element) {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
  expect(summary).toEqual([]);
}
