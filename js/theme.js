const THEME_KEY = "sgnia.theme";

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  document.documentElement.dataset.theme = saved;
  document.querySelectorAll("#themeToggle").forEach((button) => {
    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
    });
  });
}
