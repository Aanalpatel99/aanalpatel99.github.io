/**
 * Skills pipeline filter — clicking a stage pill (SENSE/MODEL/OPTIMIZE/
 * DEPLOY/SERVE) dims every tag in the pool except that stage's; ALL resets.
 */
(function () {
  const stageButtons = document.querySelectorAll(".pipeline-stage");
  const tags = document.querySelectorAll(".skill-tag");
  if (!stageButtons.length) return; // section not on this page

  stageButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      stageButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const stage = btn.dataset.stage;
      tags.forEach((tag) => {
        const match = stage === "all" || tag.dataset.stage === stage;
        tag.classList.toggle("dim", !match);
      });
    });
  });
})();
