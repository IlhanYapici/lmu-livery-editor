# Brightness curve fitted on real data

**Status:** accepted (2026-10-30)

Photoshop does not publish its modern Brightness/Contrast algorithm. One template uses it: Lexus RC F (2024), with brightness +30 and contrast −15. We measured the real curve from the composite image in that file: for each input value, the 10th percentile of the output (to remove the wireframe), with the known Levels removed.

The model `1 − (1 − v)^(1 + b/100)` (and `v^(1 + |b|/100)` to darken) fits with an RMS error of 2.1 levels. The GIMP formula gave 18.8. Any contrast model that we added made the fit worse. Thus the code applies the brightness only, and it records the contrast as unsupported.

## Consequences

If a new template uses Brightness/Contrast with other values, measure again before you change the formula. The audit shows such a template with a large difference.
