import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarChart } from './bar-chart';

describe('histogramme', () => {
  it('dessine une barre par jour et la part livrée', () => {
    const { container } = render(
      <BarChart
        label="Commandes"
        points={[
          { day: '2026-11-23', value: 12, secondary: 10 },
          { day: '2026-11-24', value: 20, secondary: 15 },
        ]}
      />,
    );
    expect(container.querySelectorAll('rect.bar')).toHaveLength(4);
    expect(container.querySelectorAll('rect.bar.strong')).toHaveLength(2);
    expect(container.textContent).toContain('20');
  });
});
