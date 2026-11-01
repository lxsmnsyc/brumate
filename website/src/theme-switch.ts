// Switches the theme of the site between light and dark, and saves the choice.

/** Whether the page shows the dark theme now, chosen or from the system. */
function isDark(): boolean {
  const root = document.documentElement;
  return (
    root.dataset.theme === 'dark' ||
    (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

/**
 * Switches the theme. With a point, such as the place of a click, the new theme grows from it in a
 * circle, in a view transition. Without view transitions, or with reduced motion, it switches at once.
 */
export function switchTheme(from?: { x: number; y: number }): void {
  const root = document.documentElement;
  function apply(): void {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', root.dataset.theme);
    } catch {
      // Storage can be blocked. The theme still changes for this page.
    }
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!from || reduce || !document.startViewTransition) {
    apply();
    return;
  }
  // The circle reaches the farthest corner of the window.
  const radius = Math.hypot(
    Math.max(from.x, innerWidth - from.x),
    Math.max(from.y, innerHeight - from.y),
  );
  // While the theme switches, the whole page is one picture that the circle reveals: the fade
  // of page changes and the header's own transition are off (rules in styles.css).
  root.classList.add('theme-switching');
  const transition = document.startViewTransition(apply);
  void transition.finished.finally(() => root.classList.remove('theme-switching'));
  void transition.ready.then(() => {
    root.animate(
      {
        clipPath: [
          `circle(0 at ${from.x}px ${from.y}px)`,
          `circle(${radius}px at ${from.x}px ${from.y}px)`,
        ],
      },
      {
        duration: 520,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        pseudoElement: '::view-transition-new(root)',
      },
    );
  });
}
