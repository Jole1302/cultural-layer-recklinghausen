import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type Fixtures = {
  makeAxeBuilder: () => AxeBuilder;
};

export const test = base.extend<Fixtures>({
  makeAxeBuilder: async ({ page }, use) => {
    const make = () =>
      new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
    await use(make);
  },
});

export { expect };
