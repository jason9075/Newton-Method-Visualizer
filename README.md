# Newton Method Visualizer

An interactive visualizer for Newton's method in both **2D** (single-variable) and **3D** (two-variable system with Jacobian), built with vanilla Canvas 2D API and Three.js.

**Live Demo → [jason9075.github.io/Newton-Method-Visualizer](https://jason9075.github.io/Newton-Method-Visualizer/)**

![Newton Method Visualizer](https://github.com/jason9075/Newton-Method-Visualizer/raw/main/preview.png)

---

## Features

### 2D Mode
- Step-by-step visualization of the tangent-line update rule $x_{n+1} = x_n - f(x_n)/f'(x_n)$
- Two-phase animation: tangent drawn first, then the projection drop and point move
- Drag the initial point $x_0$ directly on the canvas
- Pan the canvas by click-and-drag; zoom with scroll wheel or the bottom-left HUD slider
- Quadratic convergence highlighted in the iteration table
- Divergence detection with an overlay banner
- 5 built-in presets: $\sqrt{2}$, cubic, trig, oscillating, flat-trap

### 3D Mode (Jacobian Newton)
- Solves a 2×2 nonlinear system $\mathbf{F}(\mathbf{x}) = \mathbf{0}$ using the Jacobian matrix
- Two semi-transparent surfaces $z = f_1(x,y)$ and $z = f_2(x,y)$ rendered in Three.js
- Iteration path shown as a yellow dot trail on the $z = 0$ plane
- Live Jacobian matrix display and $\det J$ at each step
- OrbitControls: drag to rotate, scroll or HUD slider to zoom
- 3 built-in systems: Circles, Nonlinear, Mixed trig

### Shared UI
- 💡 Math modal with LaTeX (KaTeX) — content switches between 2D and 3D explanations
- **Eng / 中** language toggle in the modal (Traditional Chinese)
- Auto-play, Undo, Reset controls
- Nord color theme throughout

---

## Math

### 2D Newton's Method

Given $f: \mathbb{R} \to \mathbb{R}$, the iteration is:

$$x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}$$

Under suitable conditions the error satisfies $|e_{n+1}| \leq C|e_n|^2$ — quadratic convergence.

### 3D Newton's Method (Jacobian)

Given $\mathbf{F}: \mathbb{R}^2 \to \mathbb{R}^2$, solve $J(\mathbf{x}_n)\,\Delta\mathbf{x} = -\mathbf{F}(\mathbf{x}_n)$:

$$\mathbf{x}_{n+1} = \mathbf{x}_n - J(\mathbf{x}_n)^{-1}\,\mathbf{F}(\mathbf{x}_n)$$

where $J_{ij} = \partial F_i / \partial x_j$. For 2×2 systems the inverse is computed via Cramer's rule.

---

## Tech Stack

| Layer | Tool |
|---|---|
| 2D rendering | Canvas 2D API |
| 3D rendering | [Three.js](https://threejs.org/) r163 (ESM via importmap) |
| Math typesetting | [KaTeX](https://katex.org/) |
| Syntax highlighting | [Prism.js](https://prismjs.com/) (Nord theme) |
| Dev server | [live-server](https://github.com/tapio/live-server) |
| Task runner | [just](https://github.com/casey/just) |
| Dev environment | [Nix flake](https://nixos.wiki/wiki/Flakes) |

No build step. No bundler. Pure ES modules.

---

## Getting Started

### With Nix (recommended)

```bash
git clone https://github.com/jason9075/Newton-Method-Visualizer
cd Newton-Method-Visualizer
nix develop          # or: direnv allow
just dev             # starts live-server at http://localhost:8080
```

### Without Nix

Any static file server works:

```bash
npx live-server --port 8080 .
# or
python3 -m http.server 8080
```

---

## Controls

| Action | 2D | 3D |
|---|---|---|
| Next iteration | `→` / `Space` / Next Step button | Next Step button |
| Undo | `←` / Undo button | Undo button |
| Reset | `R` / Reset button | Reset button |
| Auto-play | `A` / Auto button | Auto button |
| Pan view | Click-drag canvas | Drag to rotate (OrbitControls) |
| Zoom | Scroll wheel / HUD slider | Scroll wheel / HUD slider |
| Move $x_0$ | Drag the yellow dot | x₀ / y₀ sliders |

---

## License

[MIT](LICENSE) © 2026 Jason Kuan
