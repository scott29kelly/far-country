// Keyboard shortcuts per docs/specs/phase-1-dataset.md §3.7:
//   a approve, r reject, d discuss, e edit, j/k next/prev row.
// Shortcuts only fire when the focus is not inside a form field, so typing
// in an edit textarea doesn't approve the descriptor by mistake.

(function () {
  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function focusedRow() {
    const active = document.activeElement && document.activeElement.closest(".descriptor-row");
    if (active) return active;
    return document.querySelector(".descriptor-row");
  }

  function clickShortcut(row, key) {
    if (!row) return;
    const btn = row.querySelector(`[data-shortcut="${key}"]`);
    if (btn) btn.click();
  }

  function siblingRow(row, dir) {
    if (!row) return null;
    let candidate = dir > 0 ? row.nextElementSibling : row.previousElementSibling;
    while (candidate && !candidate.classList.contains("descriptor-row")) {
      candidate = dir > 0 ? candidate.nextElementSibling : candidate.previousElementSibling;
    }
    return candidate;
  }

  document.addEventListener("keydown", function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;

    const key = event.key.toLowerCase();
    const row = focusedRow();

    if (key === "j" || key === "k") {
      const next = siblingRow(row, key === "j" ? 1 : -1);
      if (next) {
        next.scrollIntoView({ block: "center", behavior: "smooth" });
        next.setAttribute("tabindex", "-1");
        next.focus({ preventScroll: true });
        event.preventDefault();
      }
      return;
    }

    if (["a", "r", "d", "e"].includes(key)) {
      clickShortcut(row, key);
      event.preventDefault();
    }
  });
})();
