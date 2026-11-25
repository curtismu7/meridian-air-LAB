# Spec: two videos on the Movie reel (2026-11-25)

**What.** (1) The overview video, fixed: Movie reel replaces the sequence shot. (2) A new detail video: every reel frame of every scene is clicked and explained, with what matters highlighted in color.
**For whom.** Colleagues watching a recorded walk-through of the 11 scenes in Real mode.
**UI choice.** No pop-up: the step-detail panel already sits under the reel, so the selected frame and its detail stay on one page (a pop-up would cover the reel). The detail panel gets a colored "Look at" line (the hop's key fact) and warm-highlighted important fields.
**Sequence page.** The actor-tile strip and colored progress bar above the diagram are removed (clutter); the actor boxes on the diagram itself still open the actor card.

**Acceptance.**
- Overview: per scene intro slide, hop list, reel only (no sequence); no step detail left open under the reel.
- Detail: for every frame, a caption on "What happened" (reel visible, frame lit), then a caption on the most telling visible field or the decision; both highlight their target; n of N counts steps within the scene.
- Detail panel shows "Look at <fact>" only when the hop has a fact other than "done".
- Sequence page shows no tile strip or progress bar; the actor card still opens from the diagram's boxes (tests moved to the lifeline boxes).

**Unhappy paths.** A hop with no highlighted field and no decision gets one caption only. A highlighted row hidden in a collapsed object: collapsed fields are opened first, only visible rows are picked. A long token value: shortened in the caption (and never chosen over a telling field). A run that fails to start: the take raises "the run never started" (unchanged). Skipped hops are not walked (the reel hides them).

**Out of scope.** Sequence-diagram walk-through; new captions.md wording (the detail cut uses the page's own text); publishing the videos.
