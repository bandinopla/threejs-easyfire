This directory contains compute shader passes for a fluid (fire/smoke) simulation. Each pass typically reads from one or more textures, performs some calculations, and writes the results to a target texture. 

Here is what each class/pass does and how it routes data:

* advectDyePass.ts
  - Does: Advects (moves) the dye (smoke/fire properties) along the velocity field. It applies dissipation (smoke fading over time) and cooling (temperature dropping), while preventing dye from being pulled from inside collision objects.
  - Reads from `vel.A` the `xyz` (rgb) channels for velocity.
  - Reads from `dye.A` the `rgba` channels for density (r), temperature (g), age (b), and color mass/tint (a).
  - Stores in `dye.B` the `rgba` channels with the updated dye state.

* advectVelocityPass.ts
  - Does: Advects the velocity field itself (self-advection). It applies forces like buoyancy (from temperature and density), adds curl noise turbulence, applies damping, and redirects velocity around colliders.
  - Reads from `vel.A` the `xyz` (rgb) channels for current velocity.
  - Reads from `dye.A` the `rgb` channels for density (r), temperature (g), and age (b).
  - Reads from `curlNoise` the `xyz` (rgb) channels for turbulence.
  - Reads from `vorticity` the `xyzw` (rgba) channels (via applyVorticity).
  - Stores in `vel.B` the `xyz` (rgb) channels with the new velocity.

* curlNoisePass.ts
  - Does: Generates a static 3D curl noise field that is later used to add turbulent detail to the simulation.
  - Reads from: Nothing (computes noise procedurally from spatial coordinates).
  - Stores in `curlNoise` the `xyz` (rgb) channels with the noise vector.

* divergencePass.ts
  - Does: Calculates the divergence (rate of outward flow) of the intermediate velocity field by checking neighboring cells' velocities. This is needed to calculate pressure.
  - Reads from `vel.B` the `xyz` (rgb) channels for intermediate velocity.
  - Stores in `divergence` the `x` (r) channel with the scalar divergence value.

* emitObjectPass.ts
  - Does: Emits dye (density, temperature) and velocity impulses from moving objects into the simulation volume, blending fresh fire properties with the existing dye.
  - Reads from `dye.A` the `rgba` channels for current dye values.
  - Stores in `dye.B` the `rgba` channels with the newly emitted dye.

* jacobiPass.ts
  - Does: Solves the Poisson equation for pressure iteratively using the Jacobi method. This calculates the pressure needed to make the fluid incompressible.
  - Reads from `press.A` or `press.B` (passed as `readFrom`) the `x` (r) channel for current pressure.
  - Reads from `divergence` the `x` (r) channel for velocity divergence.
  - Stores in `press.B` or `press.A` (passed as `writeTo`) the `x` (r) channel with the new pressure iteration.

* projectPass.ts
  - Does: Projects the velocity field to make it divergence-free by subtracting the pressure gradient. This ensures mass conservation (incompressibility).
  - Reads from `press.A` the `x` (r) channel for the computed pressure.
  - Reads from `vel.B` the `xyz` (rgb) channels for the intermediate velocity.
  - Stores in `vel.A` the `xyz` (rgb) channels for the final, divergence-free velocity.

* vorticityPass.ts
  - Does: Computes the vorticity (curl of velocity) and its magnitude to identify areas where the fluid is spinning. This is used to apply a confinement force that preserves rolling smoke details.
  - Reads from `vel.A` the `xyz` (rgb) channels for velocity.
  - Stores in `vorticity` the `xyz` (rgb) channels for the vorticity vector and the `w` (a) channel for its magnitude.
