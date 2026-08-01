# Compute Shaders Texture Usage

This table documents the read and write operations for each compute shader called during the `update` function in `EasyFire.ts`. Channels used are indicated in parentheses.

| Shader | `curlNoise` | `velA` | `velB` | `dyeA` | `dyeB` | `divergence` | `pressA` | `pressB` | `vorticity` | `sdf` | `sdfVelocities` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`curlPassCompute`** | write (RGB) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| **`bakeColliders`** | -- | -- | -- | -- | -- | -- | -- | -- | -- | write (RGBA) | write (RGB) |
| **`vorticityPass`** | -- | read (RGB) | -- | -- | -- | -- | -- | -- | write (RGBA) | -- | -- |
| **`advectPassCompute`** | read (RGB) | read (RGB) | write (RGB) | read (RGBA) | -- | -- | -- | -- | read (RGBA) | -- | -- |
| **`divPassCompute`** | -- | -- | read (RGB) | -- | -- | write (R) | -- | -- | -- | read (RGBA) | -- |
| **`jacobiPassABCompute`**| -- | -- | -- | -- | -- | read (R) | read (R) | write (R) | -- | read (RGBA) | -- |
| **`jacobiPassBACompute`**| -- | -- | -- | -- | -- | read (R) | write (R) | read (R) | -- | read (RGBA) | -- |
| **`projectCompute`** | -- | write (RGB) | read (RGB) | -- | -- | -- | read (R) | -- | -- | read (RGBA) | read (RGB) |
| **`advectDyeCompute`** | -- | read (RGB) | -- | read (RGBA) | write (RGBA) | -- | -- | -- | -- | -- | -- |
| **`objectsPassCompute`** | -- | -- | -- | read (RGBA) | write (RGBA) | -- | -- | -- | -- | -- | -- |

### Notes on Channels:
- **(R)**: Scalar textures like `divergence` and `pressA/B` only use the red (`.x`) channel.
- **(RGB)**: Vector textures like velocities (`velA/B`, `sdfVelocities`) and `curlNoise` use the RGB (`.xyz`) channels for X, Y, and Z components. 
- **(RGBA)**: 
  - `dyeA/B`: R (Density), G (Temperature), B (Age), A (Color Mass)
  - `vorticity`: RGB (Vorticity Vector), A (Magnitude)
  - `sdf`: RGB (Surface Normal), A (SDF Distance)
