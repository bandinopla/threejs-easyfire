import { Node, Vector3Like } from "three/webgpu";
import { DataTexture, EasyFireShaderContext } from "../EasyFireShaderContext";
import { cross, float, length, vec3, vec4 } from "three/tsl";

export const vorticityPass =
	(
		context: EasyFireShaderContext,
		textures: {
			velocity: DataTexture;
			vorticity: DataTexture;
		},
	) =>
	() => {
		const grid = context.grid.phy;
		const coord = grid.coord;
		const uvw = grid.uvw;
		const voxelWorldSizeX2 = grid.worldTexelSizeX2;

		const texel = grid.texel;

		// 1. Sample 6 neighboring velocity vectors
		const velR = textures.velocity.sample(uvw.add(vec3(texel.x, 0, 0))).xyz; // Right (+X)
		const velL = textures.velocity.sample(uvw.sub(vec3(texel.x, 0, 0))).xyz; // Left (-X)
		const velU = textures.velocity.sample(uvw.add(vec3(0, texel.y, 0))).xyz; // Up (+Y)
		const velD = textures.velocity.sample(uvw.sub(vec3(0, texel.y, 0))).xyz; // Down (-Y)
		const velF = textures.velocity.sample(uvw.add(vec3(0, 0, texel.z))).xyz; // Front (+Z)
		const velB = textures.velocity.sample(uvw.sub(vec3(0, 0, texel.z))).xyz; // Back (-Z)

		// 2. Compute Curl (Vorticity) using central differences:
		// w.x = (dVz / dy) - (dVy / dz)
		const wx = velU.z.sub(velD.z).div(voxelWorldSizeX2.y).sub(velF.y.sub(velB.y).div(voxelWorldSizeX2.z));

		// w.y = (dVx / dz) - (dVz / dx)
		const wy = velF.x.sub(velB.x).div(voxelWorldSizeX2.z).sub(velR.z.sub(velL.z).div(voxelWorldSizeX2.x));

		// w.z = (dVy / dx) - (dVx / dy)
		const wz = velR.y.sub(velL.y).div(voxelWorldSizeX2.x).sub(velU.x.sub(velD.x).div(voxelWorldSizeX2.y));

		const vorticity = vec3(wx, wy, wz);
		const magnitude = length(vorticity);

		// 3. Write vorticity vector (xyz) and scalar magnitude (w)
		textures.vorticity.write(coord, vec4(vorticity, magnitude));
	};

export const applyVorticity = (
	context: EasyFireShaderContext,
	uvw: Node<"vec3">,
	texel: Vector3Like,
	vel: Node<"vec3">,
	vorticityTex: DataTexture,
) => {
	// 1. Sample local vorticity vector and magnitude
	const vortData = vorticityTex.sample(uvw);
	const omega = vortData.xyz;
	const voxelWorldSizeX2 = context.grid.phy.worldTexelSizeX2;

	// 2. Sample neighbor magnitudes (.w channel) to find gradient N = grad(|omega|)
	const vortR = vorticityTex.sample(uvw.add(vec3(texel.x, 0, 0))).w;
	const vortL = vorticityTex.sample(uvw.sub(vec3(texel.x, 0, 0))).w;
	const vortU = vorticityTex.sample(uvw.add(vec3(0, texel.y, 0))).w;
	const vortD = vorticityTex.sample(uvw.sub(vec3(0, texel.y, 0))).w;
	const vortF = vorticityTex.sample(uvw.add(vec3(0, 0, texel.z))).w;
	const vortB = vorticityTex.sample(uvw.sub(vec3(0, 0, texel.z))).w;

	const eta = vec3(
		vortR.sub(vortL).div(voxelWorldSizeX2.x),
		vortU.sub(vortD).div(voxelWorldSizeX2.y),
		vortF.sub(vortB).div(voxelWorldSizeX2.z),
	);
	// 3. Normalize gradient (add small epsilon to avoid division by zero)
	const N = eta.div(length(eta).add(0.00001));

	// 4. Calculate Confinement Force = epsilon * (N x omega)
	const confinementForce = cross(N, omega).mul(context.uVorticityConfinementStrength).mul(voxelWorldSizeX2.div(2));

	// 5. Add to velocity
	vel.addAssign(confinementForce.mul(context.uDt));
};
