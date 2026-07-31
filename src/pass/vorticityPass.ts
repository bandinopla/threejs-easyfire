import { Node, Vector3Like } from "three/webgpu";
import { DataTexture, EasyFireShaderContext } from "../EasyFireShaderContext";
import { cross, float, length, vec3, vec4 } from "three/tsl";

export const vorticityPass = (
	context: EasyFireShaderContext,
	textures: {
		velocity: DataTexture;
		vorticity: DataTexture;
	}
) => () => {
	const grid = context.grid.phy;
	const coord = grid.coord;
	const uvw = grid.uvw;

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
	const wx = velU.z.sub(velD.z).sub(velF.y.sub(velB.y)).mul(0.5);

	// w.y = (dVx / dz) - (dVz / dx)
	const wy = velF.x.sub(velB.x).sub(velR.z.sub(velL.z)).mul(0.5);

	// w.z = (dVy / dx) - (dVx / dy)
	const wz = velR.y.sub(velL.y).sub(velU.x.sub(velD.x)).mul(0.5);

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

	// 2. Sample neighbor magnitudes (.w channel) to find gradient N = grad(|omega|)
	const vortR = vorticityTex.sample(uvw.add(vec3(texel.x, 0, 0))).w;
	const vortL = vorticityTex.sample(uvw.sub(vec3(texel.x, 0, 0))).w;
	const vortU = vorticityTex.sample(uvw.add(vec3(0, texel.y, 0))).w;
	const vortD = vorticityTex.sample(uvw.sub(vec3(0, texel.y, 0))).w;
	const vortF = vorticityTex.sample(uvw.add(vec3(0, 0, texel.z))).w;
	const vortB = vorticityTex.sample(uvw.sub(vec3(0, 0, texel.z))).w;

	const eta = vec3(vortR.sub(vortL), vortU.sub(vortD), vortF.sub(vortB)).mul(0.5);

	// 3. Normalize gradient (add small epsilon to avoid division by zero)
	const N = eta.div(length(eta).add(0.00001));

	// 4. Calculate Confinement Force = epsilon * (N x omega)
	const confinementForce = cross(N, omega).mul(context.uVorticityConfinementStrength);

	// 5. Add to velocity
	vel.addAssign(confinementForce.mul(context.uDt));
};
